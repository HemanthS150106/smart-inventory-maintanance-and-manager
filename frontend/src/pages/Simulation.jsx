import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * LIVE ROUTING SIMULATION
 *
 * Displays picker workers with active dispatch tasks ('Active' status).
 * Managers select a worker on the map and drive them using keyboard WASD or Arrow keys.
 * Movements synchronize in real time to the worker's own dashboard.
 * If the worker goes off-route (>180 units from their planned path), A* rerouting dynamically triggers.
 */

const CONGESTION_THRESHOLD = 200; // SVG units
const SVG_W = 3200, SVG_H = 2500;

export default function Simulation() {
  const navigate       = useNavigate();
  const svgContainerRef= useRef(null);
  const mouseDownTime  = useRef(0);
  const mouseDownPos   = useRef({ x: 0, y: 0 });
  const lastPatchTime  = useRef(0);

  const [svgContent,   setSvgContent]   = useState('');
  const [simWorkers,   setSimWorkers]   = useState([]);
  const [selectedWorker,setSelectedWorker]=useState(null);
  const [congestionLog,setCongestionLog]=useState([]);
  const [stats,        setStats]        = useState({
    totalReroutes: 0, distanceSaved: 0, collisionsAvoided: 0
  });
  const [scale,        setScale]        = useState(1);
  const [translate,    setTranslate]    = useState({x:0, y:0});

  // Verify login and role + configure real-time syncing interval
  useEffect(() => {
    const admin = JSON.parse(
      sessionStorage.getItem('admin') || 'null'
    );
    if (!admin) { return; }
    if (admin.role !== 'simulation' && admin.role !== 'admin') {
      navigate('/home');
      return;
    }
    loadSVGAndWorkers();

    const interval = setInterval(() => {
      syncActiveWorkers();
    }, 3000); // poll active workers every 3 seconds
    return () => clearInterval(interval);
  }, []);

  async function loadSVGAndWorkers() {
    // Load warehouse SVG
    const svgRes  = await fetch(
      `/svgs/warehouse_allocated.svg?t=${Date.now()}`
    );
    const svgText = await svgRes.text();
    setSvgContent(svgText);

    // Initial sync
    await syncActiveWorkers();
    setTimeout(fitToContainer, 100);
  }

  // Real-time synchronization of active workers
  async function syncActiveWorkers() {
    try {
      const wRes  = await fetch('/api/workers');
      const wData = await wRes.json();
      
      // Include all active workers in system to support arbitrary role assignments
      const allWorkers = (wData.workers || []).filter(w => w.is_active !== false);

      const taskRes  = await fetch('/api/tasks');
      const taskData = await taskRes.json();
      const activeTasks = taskData.tasks || [];

      // Filter to workers who have an active task in 'Active' or 'In Progress — All Stops Visited' state
      const activeWorkers = allWorkers.filter(worker => {
        return activeTasks.some(
          t => (t.workerId === worker.worker_id || t.worker_id === worker.worker_id) && 
               (t.status === 'Active' || t.status === 'In Progress — All Stops Visited') && 
               t.route?.length > 0
        );
      });

      const COLORS = [
        '#1a73e8','#ea4335','#34a853','#fbbc04',
        '#9c27b0','#00bcd4','#ff5722'
      ];

      setSimWorkers(prev => {
        // Keep currently active simulation workers that are still in activeWorkers list
        const updated = prev.filter(w => 
          activeWorkers.some(aw => aw.worker_id === w.id)
        );

        // Update positions and completedStops of existing workers
        updated.forEach(w => {
          const aw = activeWorkers.find(x => x.worker_id === w.id);
          const task = activeTasks.find(t => (t.workerId === w.id || t.worker_id === w.id) && (t.status === 'Active' || t.status === 'In Progress — All Stops Visited'));
          if (aw) {
            w.x = aw.position_x ?? w.x;
            w.y = aw.position_y ?? w.y;
          }
          if (task) {
            w.completedStops = task.completedSlots || [];
            w.route = task.route;
          }
        });

        // Find newly activated workers to append
        activeWorkers.forEach((worker, idx) => {
          const alreadyListed = updated.some(w => w.id === worker.worker_id);
          if (!alreadyListed) {
            const task = activeTasks.find(
              t => (t.workerId === worker.worker_id || t.worker_id === worker.worker_id) && 
                   (t.status === 'Active' || t.status === 'In Progress — All Stops Visited') && 
                   t.route?.length > 0
            );

            let allWaypoints = [];
            if (task) {
              allWaypoints = task.route.flatMap(
                step => step.aisle_path || []
              ).filter((pt, i, arr) => {
                if (i === 0) return true;
                return pt.x !== arr[i-1].x || pt.y !== arr[i-1].y;
              });
            }

            const initialX = worker.position_x || allWaypoints[0]?.x || 3080;
            const initialY = worker.position_y || allWaypoints[0]?.y || 960;

            updated.push({
              id:          worker.worker_id,
              taskId:      task ? task.taskId : null,
              name:        worker.name || worker.worker_id,
              color:       COLORS[idx % COLORS.length],
              waypoints:   allWaypoints,
              waypointIdx: 0,
              x:           initialX,
              y:           initialY,
              originalWaypoints: [...allWaypoints],
              totalDistance:     task ? (task.totalDistance || 0) : 0,
              distanceTravelled: 0,
              rerouted:          false,
              rerouteCount:      0,
              completed:         false,
              taskType:          task ? (task.type || 'inbound') : 'idle',
              route:             task ? task.route : null,
              isRerouting:       false,
              completedStops:    task ? (task.completedSlots || []) : []
            });
          }
        });

        return updated;
      });
    } catch (err) {
      console.error('Error syncing active workers:', err);
    }
  }

  // Throttled position updater to keep worker's dashboard coordinates synchronized
  const triggerPositionPatch = (workerId, x, y) => {
    const now = Date.now();
    if (now - lastPatchTime.current >= 450) {
      lastPatchTime.current = now;
      fetch(`/api/workers/${workerId}/position`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y })
      }).catch(console.error);
    }
  };

  // Trigger off-route A* rerouting back to DISPATCH
  async function triggerReroute(workerId, currentX, currentY) {
    setSimWorkers(prev => prev.map(w => w.id === workerId ? { ...w, isRerouting: true } : w));
    setSelectedWorker(prev => prev && prev.id === workerId ? { ...prev, isRerouting: true } : prev);

    const w = simWorkers.find(x => x.id === workerId);
    const targetX = w && w.taskType === 'outbound' ? 120 : 3080;

    try {
      const res = await fetch(`/api/workers/${workerId}/plan-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetX, targetY: 960 }) // Plan new path to gate
      });
      const data = await res.json();
      if (data.success && data.path && data.path.length > 0) {
        const updateFields = {
          waypoints: data.path,
          waypointIdx: 0,
          originalWaypoints: data.path,
          rerouted: true,
          rerouteCount: (selectedWorker?.rerouteCount || 0) + 1,
          isRerouting: false
        };

        setSimWorkers(prev => prev.map(w => w.id === workerId ? { ...w, ...updateFields } : w));
        setSelectedWorker(prev => prev && prev.id === workerId ? { ...prev, ...updateFields } : prev);

        setStats(s => ({ ...s, totalReroutes: s.totalReroutes + 1 }));
        setCongestionLog(prev => [
          {
            time: new Date().toLocaleTimeString(),
            worker: selectedWorker?.name || workerId,
            other: 'Off-Route Reroute',
            distance: 180,
            action: 'Worker went off-route! Dynamically replanning A* path to DISPATCH...'
          },
          ...prev
        ].slice(0, 20));
      } else {
        setSimWorkers(prev => prev.map(w => w.id === workerId ? { ...w, isRerouting: false } : w));
        setSelectedWorker(prev => prev && prev.id === workerId ? { ...prev, isRerouting: false } : prev);
      }
    } catch (err) {
      console.error('Rerouting error:', err);
      setSimWorkers(prev => prev.map(w => w.id === workerId ? { ...w, isRerouting: false } : w));
      setSelectedWorker(prev => prev && prev.id === workerId ? { ...prev, isRerouting: false } : prev);
    }
  }

  // Keyboard listener for manual movement controls (WASD & Arrow Keys)
  useEffect(() => {
    function handleKeyDown(e) {
      if (!selectedWorker) return;

      let dx = 0, dy = 0;
      const step = 25; // units per key press

      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp')         dy = -step;
      else if (key === 's' || e.key === 'ArrowDown')  dy = step;
      else if (key === 'a' || e.key === 'ArrowLeft')   dx = -step;
      else if (key === 'd' || e.key === 'ArrowRight')  dx = step;

      if (dx === 0 && dy === 0) return;

      e.preventDefault(); // stop browser scroll

      let newX = selectedWorker.x + dx;
      let newY = selectedWorker.y + dy;

      newX = Math.max(0, Math.min(SVG_W, newX));
      newY = Math.max(0, Math.min(SVG_H, newY));

      // Push position coordinates to server database
      triggerPositionPatch(selectedWorker.id, newX, newY);

      // Auto check-in picks for any task stops nearby
      let newCompletedStops = [...(selectedWorker.completedStops || [])];
      if (selectedWorker.taskId && selectedWorker.route) {
        selectedWorker.route.forEach(step => {
          if (step.type === 'pickup' && step.slot_id) {
            if (newCompletedStops.includes(step.slot_id)) return;
            const pos = step.aisle_path?.length > 0 ? step.aisle_path[step.aisle_path.length - 1] : { x: step.x, y: step.y };
            if (pos) {
              const d = Math.sqrt(Math.pow(newX - pos.x, 2) + Math.pow(newY - pos.y, 2));
              if (d < 45) {
                newCompletedStops.push(step.slot_id);
                // Trigger backend patch for per-stop completion
                fetch(`/api/tasks/${selectedWorker.taskId}/stop/${step.slot_id}/complete`, {
                  method: 'PATCH'
                }).catch(console.error);
              }
            }
          }
        });
      }

      const updated = {
        ...selectedWorker,
        x: newX,
        y: newY,
        completedStops: newCompletedStops
      };

      setSelectedWorker(updated);
      setSimWorkers(prev => prev.map(w => w.id === selectedWorker.id ? updated : w));

      // Check final gate arrival to complete task (120 for outbound, 3080 for inbound)
      const targetGateX = selectedWorker.taskType === 'outbound' ? 120 : 3080;
      const distToGate = Math.sqrt(Math.pow(newX - targetGateX, 2) + Math.pow(newY - 960, 2));
      if (distToGate < 45 && selectedWorker.taskId) {
        console.log(`[Simulation] Worker reached gate. Completing task...`);
        fetch(`/api/tasks/${selectedWorker.taskId}/complete`, {
          method: 'PATCH'
        })
        .then(() => {
          alert(`Worker: ${selectedWorker.name} arrived at dock! Task completed successfully.`);
          setSelectedWorker(null);
          loadSVGAndWorkers();
        })
        .catch(console.error);
      }

      // Off-route check
      const waypoints = selectedWorker.waypoints || [];
      let isOffRoute = false;
      if (waypoints.length > 0) {
        let minDist = Infinity;
        waypoints.forEach(pt => {
          const d = Math.sqrt(Math.pow(pt.x - newX, 2) + Math.pow(pt.y - newY, 2));
          if (d < minDist) minDist = d;
        });
        if (minDist > 180) { // Off-route threshold (180 units)
          isOffRoute = true;
        }
      }

      if (isOffRoute && !selectedWorker.isRerouting) {
        triggerReroute(selectedWorker.id, newX, newY);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWorker]);

  // Project map click coordinates for manual plan path target
  const handleMapClick = async (e) => {
    if (!selectedWorker) return;

    // Distinguish clicking vs dragging panning
    const clickDuration = Date.now() - mouseDownTime.current;
    const moveDist = Math.sqrt(
      Math.pow(e.clientX - mouseDownPos.current.x, 2) +
      Math.pow(e.clientY - mouseDownPos.current.y, 2)
    );
    if (clickDuration > 200 || moveDist > 6) return;

    const rect = svgContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const svgX = Math.round((clickX - translate.x) / scale);
    const svgY = Math.round((clickY - translate.y) / scale);

    if (svgX < 0 || svgX > SVG_W || svgY < 0 || svgY > SVG_H) return;

    try {
      const res = await fetch(`/api/workers/${selectedWorker.id}/plan-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetX: svgX, targetY: svgY })
      });
      const data = await res.json();
      if (data.success && data.path && data.path.length > 0) {
        const updateFields = {
          waypoints: data.path,
          waypointIdx: 0,
          x: data.path[0].x,
          y: data.path[0].y,
          completed: false,
          rerouted: false,
          totalDistance: 0,
          distanceTravelled: 0
        };

        setSimWorkers(prev => prev.map(w => w.id === selectedWorker.id ? { ...w, ...updateFields } : w));
        setSelectedWorker(prev => prev && prev.id === selectedWorker.id ? { ...prev, ...updateFields } : prev);

        // Update database coordinates immediately upon manual target assign
        fetch(`/api/workers/${selectedWorker.id}/position`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: data.path[0].x, y: data.path[0].y })
        }).catch(console.error);

        setCongestionLog(prev => [
          {
            time: new Date().toLocaleTimeString(),
            worker: selectedWorker.name,
            other: 'Manual Command',
            distance: 0,
            action: `Moving dynamically to coordinates (${svgX}, ${svgY})`
          },
          ...prev
        ].slice(0, 20));
      }
    } catch (err) {
      console.error('Error executing manual pathfind:', err);
    }
  };

  // Zoom/pan handlers
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart,  setDragStart]  = useState({x:0,y:0});
  const [dragOrigin, setDragOrigin] = useState({x:0,y:0});

  function handleWheel(e) {
    e.preventDefault();
    let delta = e.deltaY;
    if (e.deltaMode===1) delta*=20;
    if (e.deltaMode===2) delta*=300;
    const zf  = Math.pow(0.97, delta/100);
    const ns  = Math.min(15, Math.max(0.05, scale*zf));
    const rect= svgContainerRef.current.getBoundingClientRect();
    const mx  = e.clientX - rect.left;
    const my  = e.clientY - rect.top;
    setTranslate(t => ({
      x: mx - (mx - t.x) * (ns/scale),
      y: my - (my - t.y) * (ns/scale)
    }));
    setScale(ns);
  }

  function handleMouseDown(e) {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({x:e.clientX, y:e.clientY});
    setDragOrigin({...translate});
    mouseDownTime.current = Date.now();
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  }
  function handleMouseMove(e) {
    if (!isDragging) return;
    setTranslate({
      x: dragOrigin.x + (e.clientX - dragStart.x),
      y: dragOrigin.y + (e.clientY - dragStart.y)
    });
  }
  function handleMouseUp() { setIsDragging(false); }

  function fitToContainer() {
    const c = svgContainerRef.current;
    if (!c) return;
    const cw = c.clientWidth||1000, ch=c.clientHeight||600;
    const s  = Math.min(cw/SVG_W, ch/SVG_H)*0.92;
    setScale(s);
    setTranslate({
      x:(cw-SVG_W*s)/2, y:(ch-SVG_H*s)/2
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-40px)] gap-5 font-sans">
      
      {/* Title & Controls */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[#162536]">Inventory Simulation</h1>
          <p className="text-slate-500 text-sm mt-1">Live routing and dynamic rerouting demonstration.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fitToContainer}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition shadow-sm">
            Fit Map
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col justify-center">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Reroutes</span>
          <span className="text-2xl font-bold text-[#B7791F] mt-1">{stats.totalReroutes}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col justify-center">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Workers</span>
          <span className="text-2xl font-bold text-[#2F8F83] mt-1">{simWorkers.length}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex gap-6 flex-1 min-h-0">
        
        {/* Map Container */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 relative overflow-hidden flex flex-col">
          <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur px-3 py-1.5 rounded-md shadow-sm border border-slate-200 text-xs font-semibold text-slate-600">
            Select a worker to drive (WASD)
          </div>
          <div
            ref={svgContainerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleMapClick}
            className="w-full h-full relative overflow-hidden bg-slate-50"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <div style={{
              transform:`translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transformOrigin:'0 0', position:'absolute', top:0, left:0
            }}>
              {/* Background SVG */}
              <div dangerouslySetInnerHTML={{__html:svgContent}} style={{pointerEvents:'none'}} />

              {/* SVG overlay for routes and markers */}
              <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ position: 'absolute', top: 0, left: 0, width: SVG_W, height: SVG_H, pointerEvents: 'none' }}>
                {/* ── PLANNED ROUTE PATHS ── */}
                {simWorkers.map(w => {
                  if (w.completed) return null;
                  const remaining = w.waypoints.slice(w.waypointIdx);
                  if (remaining.length < 2) return null;
                  const pts = remaining.map(p=>`${p.x},${p.y}`).join(' ');
                  return (
                    <g key={`route-${w.id}`}>
                      <polyline points={pts} fill="none" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
                      <polyline points={pts} fill="none" stroke={w.color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={w.rerouted ? "none" : "14,8"} opacity={w.rerouted ? 0.9 : 0.6} />
                    </g>
                  );
                })}

                {/* ── PICKUP STOP MARKERS ── */}
                {simWorkers.map(w => {
                  if (!w.route) return null;
                  return w.route.filter(step => step.type === 'pickup').map((step, i) => {
                    const pos = step.aisle_path?.length > 0 ? step.aisle_path[step.aisle_path.length - 1] : { x: step.x, y: step.y };
                    const isCompleted = (w.completedStops || []).includes(step.slot_id);
                    const stopColor = isCompleted ? '#94a3b8' : w.color;
                    return (
                      <g key={`stop-${w.id}-${step.slot_id}`}>
                        <circle cx={pos.x} cy={pos.y} r="14" fill="white" opacity="0.9" />
                        <circle cx={pos.x} cy={pos.y} r="11" fill={stopColor} opacity="0.9" />
                        <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">
                          {isCompleted ? '✓' : String(i + 1)}
                        </text>
                        <text x={pos.x} y={pos.y + 28} textAnchor="middle" fontSize="8" fill={w.color} fontWeight="bold" opacity="0.8">
                          {step.slot_id}
                        </text>
                      </g>
                    );
                  });
                })}

                {/* ── ENTRANCE DOCK ── */}
                <circle cx={120} cy={960} r="18" fill="white" opacity="0.9" />
                <circle cx={120} cy={960} r="14" fill="#34a853" />
                <text x={120} y={964} textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">IN</text>

                {/* ── DISPATCH DOCK ── */}
                <circle cx={3080} cy={960} r="18" fill="white" opacity="0.9" />
                <circle cx={3080} cy={960} r="14" fill="#2F5D8C" />
                <text x={3080} y={964} textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">OUT</text>

                {/* ── WORKER POSITION PINS ── */}
                {simWorkers.map(w => {
                  const isSelected = selectedWorker?.id === w.id;
                  if (w.completed) {
                    return (
                      <g key={`worker-${w.id}`}>
                        <circle cx={w.x} cy={w.y} r="12" fill="#94a3b8" stroke="white" strokeWidth="2" opacity="0.5" />
                        <text x={w.x} y={w.y+4} textAnchor="middle" fontSize="8" fill="white">✓</text>
                      </g>
                    );
                  }
                  return (
                    <g key={`worker-${w.id}`} style={{ cursor: 'pointer', pointerEvents: 'auto' }} onClick={(e) => { e.stopPropagation(); setSelectedWorker(isSelected ? null : w); }}>
                      {isSelected && <circle cx={w.x} cy={w.y} r="28" fill="none" stroke="#2F5D8C" strokeWidth="3" strokeDasharray="4,4" opacity="0.85" />}
                      {w.waypointIdx < w.waypoints.length - 1 && (() => {
                        const next = w.waypoints[w.waypointIdx + 1];
                        const dx = next.x - w.x, dy = next.y - w.y;
                        const len = Math.sqrt(dx*dx+dy*dy) || 1;
                        const nx = (dx/len) * 28, ny = (dy/len) * 28;
                        return <line x1={w.x} y1={w.y} x2={w.x+nx} y2={w.y+ny} stroke={w.color} strokeWidth="3" strokeLinecap="round" opacity="0.7" markerEnd={`url(#arrow-${w.id})`} />;
                      })()}
                      <circle cx={w.x} cy={w.y} r="20" fill={w.rerouted ? '#B7791F' : w.color} stroke="white" strokeWidth="3" />
                      <text x={w.x} y={w.y+4} textAnchor="middle" fontSize="10" fill="white" fontWeight="bold" style={{ userSelect: 'none' }}>
                        {w.name.split(' ')[0].slice(0,4)}
                      </text>
                    </g>
                  );
                })}

                <defs>
                  {simWorkers.map(w => (
                    <marker key={`arrow-def-${w.id}`} id={`arrow-${w.id}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L6,3 z" fill={w.rerouted ? '#B7791F' : w.color} />
                    </marker>
                  ))}
                </defs>
              </svg>
            </div>
            
            {/* Zoom indicator */}
            <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur text-slate-600 px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm border border-slate-200 pointer-events-none">
              {Math.round(scale*100)}%
            </div>
          </div>
        </div>

        {/* Right Panels */}
        <div className="w-[320px] flex flex-col gap-4 shrink-0 overflow-y-auto pr-1 pb-4">
          
          {/* Selected Worker Details */}
          {selectedWorker && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h3 className="font-semibold text-[#162536] flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full" style={{ background: selectedWorker.color }}></span>
                {selectedWorker.name}
              </h3>
              <div className="text-xs text-slate-600 space-y-2">
                <div className="flex justify-between"><span className="text-slate-400">Task</span><span className="font-medium text-[#162536]">{selectedWorker.taskId || 'None'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Type</span><span className="font-medium text-[#162536]">{selectedWorker.taskType.toUpperCase()}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Pos</span><span className="font-medium text-[#162536]">({Math.round(selectedWorker.x)}, {Math.round(selectedWorker.y)})</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Status</span>
                  <span className="font-medium text-[#162536]">
                    {!selectedWorker.taskId ? 'Idle' : selectedWorker.isRerouting ? 'Rerouting...' : selectedWorker.rerouted ? 'Rerouted' : selectedWorker.taskType === 'outbound' ? 'Active Dispatch' : 'Active Return'}
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-slate-400">Reroutes</span><span className="font-medium text-[#B7791F]">{selectedWorker.rerouteCount}</span></div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-medium">
                Drive using WASD or click the map to re-route dynamically.
              </div>
            </div>
          )}

          {/* Active Workers List */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col max-h-[300px]">
            <div className="p-4 border-b border-slate-100">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Workers ({simWorkers.length})</h4>
            </div>
            <div className="overflow-y-auto p-2">
              {simWorkers.length === 0 ? (
                <div className="p-4 text-xs text-slate-400 text-center">No active workers.</div>
              ) : (
                simWorkers.map(w => (
                  <div key={w.id} 
                    onClick={() => setSelectedWorker(selectedWorker?.id===w.id ? null : w)}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${selectedWorker?.id===w.id ? 'bg-slate-100' : 'hover:bg-slate-50'} ${w.rerouted ? 'border border-[#E8C77B] bg-[#FFF7E6]' : 'border border-transparent'}`}>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: w.color }}></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-[#162536] truncate">{w.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{w.taskId || 'Idle'}</div>
                    </div>
                    {w.rerouteCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-[#FFF7E6] text-[#B7791F] rounded-md text-[9px] font-bold border border-[#E8C77B]">
                        {w.rerouteCount}×
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Simulation Log */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-[200px]">
            <div className="p-4 border-b border-slate-100">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Simulation Log</h4>
            </div>
            <div className="p-3 overflow-y-auto">
              {congestionLog.length === 0 ? (
                <div className="text-xs text-slate-400 text-center p-2">No events logged.</div>
              ) : (
                <div className="space-y-3">
                  {congestionLog.map((e, i) => (
                    <div key={i} className={`pl-3 border-l-2 text-xs ${e.other === 'Manual Command' ? 'border-l-[#2F5D8C]' : 'border-l-[#B7791F]'}`}>
                      <div className={`font-medium ${e.other === 'Manual Command' ? 'text-[#2F5D8C]' : 'text-[#B7791F]'}`}>
                        {e.time} — {e.worker}
                      </div>
                      <div className="text-slate-600 mt-0.5">{e.action}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
