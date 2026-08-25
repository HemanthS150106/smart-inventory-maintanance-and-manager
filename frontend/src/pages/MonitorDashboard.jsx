import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * MONITOR DASHBOARD
 *
 * Shows all active workers as draggable pins on the warehouse SVG.
 * Admin can drag a worker pin to simulate their movement.
 * When workers get close, congestion alert fires and affected
 * worker's route suggestion updates on their own dashboard.
 */
// Copy of AISLE_SEGMENTS for frontend use
const AISLE_SEGMENTS_CLIENT = [
  { id: 'MAIN_HORIZONTAL', type: 'main', bounds: { x1: 40, y1: 980, x2: 3160, y2: 1080 } },
  { id: 'CENTER_VERTICAL', type: 'main', bounds: { x1: 1540, y1: 40, x2: 1660, y2: 1960 } },
  { id: 'ZONE_A_WALK_P1', type: 'walking', bounds: { x1: 60, y1: 370, x2: 1530, y2: 418 } },
  { id: 'ZONE_A_WALK_P2', type: 'walking', bounds: { x1: 60, y1: 808, x2: 1530, y2: 856 } },
  { id: 'ZONE_A_WALK_P3', type: 'walking', bounds: { x1: 60, y1: 1246, x2: 1530, y2: 1294 } },
  { id: 'ZONE_A_WALK_P4', type: 'walking', bounds: { x1: 60, y1: 1684, x2: 1530, y2: 1732 } },
  { id: 'ZONE_B_WALK_P1', type: 'walking', bounds: { x1: 1680, y1: 370, x2: 3140, y2: 418 } },
  { id: 'ZONE_B_WALK_P2', type: 'walking', bounds: { x1: 1680, y1: 808, x2: 3140, y2: 856 } },
  { id: 'ZONE_B_WALK_P3', type: 'walking', bounds: { x1: 1680, y1: 1246, x2: 3140, y2: 1294 } },
  { id: 'ZONE_B_WALK_P4', type: 'walking', bounds: { x1: 1680, y1: 1684, x2: 3140, y2: 1732 } },
  { id: 'ZONE_C_WALK_P1', type: 'walking', bounds: { x1: 60, y1: 1270, x2: 1530, y2: 1318 } },
  { id: 'ZONE_C_WALK_P2', type: 'walking', bounds: { x1: 60, y1: 1708, x2: 1530, y2: 1756 } },
  { id: 'ZONE_C_WALK_P3', type: 'walking', bounds: { x1: 60, y1: 2146, x2: 1530, y2: 2194 } },
  { id: 'ZONE_D_WALK_P1', type: 'walking', bounds: { x1: 1680, y1: 1270, x2: 3140, y2: 1318 } },
  { id: 'ZONE_D_WALK_P2', type: 'walking', bounds: { x1: 1680, y1: 1708, x2: 3140, y2: 1756 } },
  { id: 'ZONE_D_WALK_P3', type: 'walking', bounds: { x1: 1680, y1: 2146, x2: 3140, y2: 2194 } }
];

export default function MonitorDashboard() {
  const navigate      = useNavigate();
  const svgContainerRef = useRef(null);
  const [svgContent,   setSvgContent]   = useState('');
  const [workerPositions, setWorkerPositions] = useState([]);
  const [scale,        setScale]        = useState(1);
  const [translate,    setTranslate]    = useState({ x: 0, y: 0 });
  const [isDragging,   setIsDragging]   = useState(false);
  const [dragState,    setDragState]    = useState(null);
  const [aisleStates,  setAisleStates]  = useState([]);
  const [reroutedTasks, setReroutedTasks] = useState([]);

  // Verify monitor session
  useEffect(() => {
    const admin = JSON.parse(
      sessionStorage.getItem('admin') || 'null'
    );
    if (!admin) { return; }
    loadSVG();
    loadPositions();
    checkCongestion();
    const interval = setInterval(() => {
      loadPositions();
      checkCongestion();
    }, 3000);  // refresh every 3 seconds
    return () => clearInterval(interval);
  }, []);

  async function loadSVG() {
    const res  = await fetch(
      `/svgs/warehouse_allocated.svg?t=${Date.now()}`
    );
    const text = await res.text();
    setSvgContent(text);
    // Fit to container after SVG loads
    setTimeout(fitToContainer, 100);
  }

  async function loadPositions() {
    const res  = await fetch('/api/workers/positions');
    const data = await res.json();
    if (data.success) setWorkerPositions(data.positions);
  }

  async function checkCongestion() {
    const res  = await fetch('/api/workers/congestion-check');
    const data = await res.json();
    if (data.success) {
      setReroutedTasks(data.rerouted || []);
      setAisleStates(data.aisle_states || []);
    }
  }

  function fitToContainer() {
    const container = svgContainerRef.current;
    if (!container) return;
    const cw = container.clientWidth  || 1000;
    const ch = container.clientHeight || 600;
    const fitScale = Math.min(cw/3200, ch/2000) * 0.92;
    setScale(fitScale);
    setTranslate({
      x: (cw - 3200 * fitScale) / 2,
      y: (ch - 2000 * fitScale) / 2
    });
  }

  // Convert screen coordinates to SVG coordinates
  function screenToSVG(screenX, screenY) {
    const rect = svgContainerRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - translate.x) / scale,
      y: (screenY - rect.top  - translate.y) / scale
    };
  }

  function handleMouseDown(e) {
    // Check if clicking on a worker pin
    const pinEl = e.target.closest('[data-worker-id]');
    if (pinEl) {
      e.stopPropagation();
      const workerId = pinEl.dataset.workerId;
      setDragState({
        type: 'worker', workerId,
        startX: e.clientX, startY: e.clientY
      });
    } else {
      // Dragging the map
      setIsDragging(true);
      setDragState({
        type: 'map',
        startX: e.clientX, startY: e.clientY,
        originX: translate.x, originY: translate.y
      });
    }
  }

  function handleMouseMove(e) {
    if (!dragState) return;

    if (dragState.type === 'map') {
      setTranslate({
        x: dragState.originX + (e.clientX - dragState.startX),
        y: dragState.originY + (e.clientY - dragState.startY)
      });
    } else if (dragState.type === 'worker') {
      // Update worker pin position visually while dragging
      const svgPos = screenToSVG(e.clientX, e.clientY);
      setWorkerPositions(prev =>
        prev.map(w =>
          w.worker_id === dragState.workerId
            ? { ...w, position_x: svgPos.x, position_y: svgPos.y }
            : w
        )
      );
    }
  }

  async function handleMouseUp(e) {
    if (!dragState) return;

    if (dragState.type === 'worker') {
      // Persist new worker position to backend
      const svgPos = screenToSVG(e.clientX, e.clientY);
      
      // Determine what zone they are in based on SVG coordinate ranges
      let zone = null;
      const x = svgPos.x;
      const y = svgPos.y;
      if (x >= 60 && x <= 1520 && y >= 190 && y <= 970) zone = 'A';
      else if (x >= 1680 && x <= 3140 && y >= 190 && y <= 970) zone = 'B';
      else if (x >= 60 && x <= 1520 && y >= 1090 && y <= 1960) zone = 'C';
      else if (x >= 1680 && x <= 3140 && y >= 1090 && y <= 1960) zone = 'D';

      await fetch(
        `/api/workers/${dragState.workerId}/position`,
        {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            x: Math.round(svgPos.x),
            y: Math.round(svgPos.y),
            zone
          })
        }
      );
      // Immediately check congestion after move
      checkCongestion();
    }

    setDragState(null);
    setIsDragging(false);
  }

  function handleWheel(e) {
    e.preventDefault();
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 20;
    if (e.deltaMode === 2) delta *= 300;
    const zoomFactor = Math.pow(0.97, delta / 100);
    const newScale   = Math.min(15, Math.max(0.05,
                       scale * zoomFactor));
    const rect = svgContainerRef.current.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    setTranslate(t => ({
      x: mx - (mx - t.x) * (newScale / scale),
      y: my - (my - t.y) * (newScale / scale)
    }));
    setScale(newScale);
  }

  function logout() {
    sessionStorage.removeItem('admin');
    sessionStorage.removeItem('worker');
    navigate('/login');
  }

  // Worker pin colors by status/conflict
  // Worker pin styles by status/conflict
  function getWorkerPinStyle(worker) {
    const isRerouting = reroutedTasks.some(
      r => r.workerId === worker.worker_id
    );
    const isCongestedAisle = aisleStates.some(s =>
      s.over && s.present?.includes(worker.worker_id)
    );
    const isCompleted = worker.active_tasks === 0;

    if (isRerouting) {
      return {
        bg:     '#ef4444',   // red — being rerouted
        border: '#fbbf24',   // gold border
        pulse:  true,
        label:  ''
      };
    }
    if (isCongestedAisle) {
      return {
        bg:     '#f97316',   // orange — in congested aisle
        border: '#fff',
        pulse:  false,
        label:  ''
      };
    }
    if (isCompleted) {
      return {
        bg:     '#22c55e',   // green — all stops done
        border: '#fff',
        pulse:  false,
        label:  ''
      };
    }
    // Normal active worker
    return {
      bg:     '#3b82f6',   // blue — working normally
      border: '#fff',
      pulse:  false,
      label:  ''
    };
  }

  return (
    <div style={{ height: '100vh', display: 'flex',
                  flexDirection: 'column', background: '#f1f5f9',
                  overflow: 'hidden' }}>
      <style>{`
        @keyframes pin-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(239,68,68,0.4); }
          70%  { box-shadow: 0 0 0 12px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0   rgba(239,68,68,0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        background: '#1e293b', color: 'white',
        padding: '12px 24px',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexShrink: 0
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px' }}>
             Warehouse Monitor
          </h1>
          <p style={{ margin: 0, fontSize: '12px',
                      color: '#94a3b8' }}>
            {workerPositions.length} active workers ·
            {reroutedTasks.length > 0
              ? `  ${reroutedTasks.length} congestion alert(s)`
              : '  No congestion'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px',
                      alignItems: 'center' }}>
          <button onClick={fitToContainer}
            style={{ padding: '6px 14px', background: '#334155',
                     color: 'white', border: 'none',
                     borderRadius: '6px', cursor: 'pointer',
                     fontSize: '13px' }}>
            ⊡ Reset View
          </button>
          <button onClick={logout}
            style={{ padding: '6px 14px', background: '#ef4444',
                     color: 'white', border: 'none',
                     borderRadius: '6px', cursor: 'pointer',
                     fontSize: '13px' }}>
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* SVG Map */}
        <div style={{ flex: 1, position: 'relative',
                      overflow: 'hidden' }}>
          <div
            ref={svgContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            style={{
              width: '100%', height: '100%',
              cursor: dragState?.type === 'worker'
                ? 'grabbing'
                : isDragging ? 'grabbing' : 'grab',
              position: 'relative', overflow: 'hidden'
            }}
          >
            {/* Transformed SVG layer */}
            <div style={{
              transform:
                `translate(${translate.x}px,${translate.y}px)
                 scale(${scale})`,
              transformOrigin: '0 0',
              position: 'absolute', top: 0, left: 0
            }}>
              {/* Warehouse SVG */}
              <div dangerouslySetInnerHTML={{ __html: svgContent }}
                   style={{ pointerEvents: 'none' }} />

              {/* Aisle capacity overlay — drawn on top of warehouse SVG */}
              <svg viewBox="0 0 3200 2500"
                style={{
                  position:'absolute', top:0, left:0,
                  width:3200, height:2500, pointerEvents:'none'
                }}>
                {aisleStates.map(state => {
                  if (state.occupancy === 0 && !state.over) return null;
                  const seg = AISLE_SEGMENTS_CLIENT.find(s => s.id === state.id);
                  if (!seg) return null;

                  // Color scale based on fill percentage
                  const fillPct = state.allowed > 0
                    ? state.occupancy / state.allowed : 0;

                  const fillColor =
                    fillPct >= 1.0 ? 'rgba(239,68,68,0.30)'   // RED — over capacity
                    : fillPct >= 0.75 ? 'rgba(249,115,22,0.25)' // ORANGE — near full
                    : fillPct >= 0.5  ? 'rgba(251,191,36,0.20)' // AMBER — half full
                    : 'rgba(34,197,94,0.15)';                    // GREEN — light use

                  const strokeColor =
                    fillPct >= 1.0 ? '#ef4444'
                    : fillPct >= 0.75 ? '#f97316'
                    : fillPct >= 0.5  ? '#fbbf24'
                    : '#22c55e';

                  const strokeWidth = fillPct >= 1.0 ? '4' : '2';
                  const dashArray   = fillPct >= 1.0 ? 'none' : '10,6';

                  return (
                    <g key={state.id}>
                      <rect
                        x={seg.bounds.x1}      y={seg.bounds.y1}
                        width={seg.bounds.x2  - seg.bounds.x1}
                        height={seg.bounds.y2 - seg.bounds.y1}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={dashArray}
                      />
                      {/* Capacity badge */}
                      <rect
                        x={(seg.bounds.x1+seg.bounds.x2)/2 - 20}
                        y={(seg.bounds.y1+seg.bounds.y2)/2 - 10}
                        width="40" height="20" rx="10"
                        fill={strokeColor} opacity="0.9"
                      />
                      <text
                        x={(seg.bounds.x1+seg.bounds.x2)/2}
                        y={(seg.bounds.y1+seg.bounds.y2)/2 + 5}
                        textAnchor="middle"
                        fontSize={seg.type==='main' ? '12' : '9'}
                        fill="white" fontWeight="bold"
                      >
                        {state.occupancy}/{state.allowed}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Worker pins overlaid on SVG */}
              {workerPositions.map(worker => {
                const style = getWorkerPinStyle(worker);
                return (
                  <div
                    key={worker.worker_id}
                    data-worker-id={worker.worker_id}
                    title={`${worker.name} — drag to move`}
                    style={{
                      position:  'absolute',
                      left:      worker.position_x - 20,
                      top:       worker.position_y - 20,
                      width:     '40px',
                      height:    '40px',
                      borderRadius: '50% 50% 50% 0',
                      transform: 'rotate(-45deg)',
                      background: style.bg,
                      border:    `3px solid ${style.border}`,
                      boxShadow: style.pulse
                        ? '0 0 0 4px rgba(239,68,68,0.3)'
                        : '0 2px 8px rgba(0,0,0,0.25)',
                      cursor:    'grab',
                      zIndex:    100,
                      display:   'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      animation: style.pulse ? 'pin-pulse 1s infinite' : 'none',
                      transition:'background 0.3s, box-shadow 0.3s'
                    }}
                  >
                    <span style={{
                      transform:  'rotate(45deg)',
                      fontSize:   '14px',
                      userSelect: 'none'
                    }}>
                      {style.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Zoom % indicator */}
            <div style={{
              position: 'absolute', bottom: '12px', right: '12px',
              background: 'rgba(255,255,255,0.9)',
              padding: '4px 10px', borderRadius: '6px',
              fontSize: '12px', color: '#64748b',
              border: '1px solid #e2e8f0',
              pointerEvents: 'none'
            }}>
              {Math.round(scale * 100)}%
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{
          width: '300px', background: 'white',
          borderLeft: '1px solid #e2e8f0',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', flexShrink: 0
        }}>

          {/* Congestion Alerts */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #e2e8f0',
            background: reroutedTasks.length > 0 ? '#fef2f2' : '#f0fdf4'
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '14px',
                         color: reroutedTasks.length > 0
                           ? '#dc2626' : '#16a34a' }}>
              {reroutedTasks.length > 0
                ? ` ${reroutedTasks.length} Congestion Alert(s)`
                : ' No Congestion Detected'}
            </h3>
            {reroutedTasks.map((c, i) => (
              <div key={i} style={{
                background: 'white', borderRadius: '8px',
                padding: '10px', marginBottom: '8px',
                border: '1px solid #fecaca', fontSize: '12px'
              }}>
                <strong>Worker Rerouted:</strong><br/>
                {c.workerId}<br/>
                <span style={{ color: '#ef4444' }}>
                  Avoided: {c.aisleAvoided}
                </span><br/>
                <span style={{ color: '#64748b' }}>{c.reason}</span>
              </div>
            ))}
          </div>

          {/* Color Legend */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc'
          }}>
            <h4 style={{
              margin: '0 0 10px', color: '#475569',
              fontSize: '11px', textTransform: 'uppercase',
              letterSpacing: '0.05em', fontWeight: 'bold'
            }}>
              Legend
            </h4>
            {[
              { color: '#3b82f6', label: ' Working normally' },
              { color: '#f97316', label: ' In congested aisle' },
              { color: '#ef4444', label: ' Being rerouted' },
              { color: '#22c55e', label: ' All stops complete' },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center',
                gap: '8px', marginBottom: '6px'
              }}>
                <div style={{
                  width: '14px', height: '14px', borderRadius: '50%',
                  background: item.color, flexShrink: 0
                }}/>
                <span style={{ color: '#475569', fontSize: '11px' }}>
                  {item.label}
                </span>
              </div>
            ))}
            <div style={{
              marginTop: '10px', paddingTop: '10px',
              borderTop: '1px solid #e2e8f0'
            }}>
              <div style={{
                fontSize: '10px', color: '#475569',
                marginBottom: '4px', fontWeight: '600'
              }}>
                Aisle Capacity Colors:
              </div>
              {[
                { color: '#22c55e', label: 'Light use (< 50%)' },
                { color: '#fbbf24', label: 'Half full (50–75%)' },
                { color: '#f97316', label: 'Nearly full (75–99%)' },
                { color: '#ef4444', label: 'Over capacity (100%+)' },
              ].map(item => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center',
                  gap: '8px', marginBottom: '4px'
                }}>
                  <div style={{
                    width: '10px', height: '10px',
                    borderRadius: '2px',
                    background: item.color, flexShrink: 0
                  }}/>
                  <span style={{ color: '#64748b', fontSize: '10px' }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Aisle Capacity */}
          <div style={{padding:'12px', borderBottom:'1px solid #334155'}}>
            <h4 style={{margin:'0 0 8px', color:'#94a3b8',
                        fontSize:'12px', textTransform:'uppercase'}}>
              Aisle Capacity
            </h4>
            {aisleStates.filter(s => s.occupancy > 0).map(s => (
              <div key={s.id} style={{
                display:'flex', alignItems:'center', gap:'8px',
                padding:'4px 0', fontSize:'11px'
              }}>
                <div style={{
                  width:'8px', height:'8px', borderRadius:'50%',
                  background: s.over ? '#ef4444' : '#fbbf24',
                  flexShrink:0
                }}/>
                <span style={{color:'#94a3b8', flex:1,
                              overflow:'hidden', textOverflow:'ellipsis',
                              whiteSpace:'nowrap'}}>
                  {s.id.replace(/_/g,' ')}
                </span>
                <span style={{
                  color: s.over ? '#ef4444' : '#fbbf24',
                  fontWeight:'600'
                }}>
                  {s.occupancy}/{s.allowed}
                </span>
              </div>
            ))}
            {aisleStates.filter(s => s.occupancy > 0).length === 0 && (
              <p style={{color:'#475569', fontSize:'11px', margin:0}}>
                All aisles clear
              </p>
            )}
          </div>

          {/* Worker List */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px',
                         color: '#334155' }}>
              Active Workers ({workerPositions.length})
            </h3>
            {workerPositions.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>
                No workers currently active.
              </p>
            ) : (
              workerPositions.map(w => {
                const isRerouted = reroutedTasks.some(
                  r => r.workerId === w.worker_id
                );
                return (
                  <div key={w.worker_id} style={{
                    padding: '10px 12px', borderRadius: '8px',
                    marginBottom: '8px',
                    border: isRerouted
                      ? '1px solid #fca5a5'
                      : '1px solid #e2e8f0',
                    background: isRerouted ? '#fef2f2' : '#f8fafc',
                    fontSize: '13px'
                  }}>
                    <div style={{ fontWeight: '600',
                                  color: '#1e293b' }}>
                       {w.name}
                    </div>
                    <div style={{ color: '#64748b',
                                  fontSize: '12px',
                                  marginTop: '4px' }}>
                      ID: {w.worker_id}<br/>
                      Zone: {w.position_zone || 'Transit'}<br/>
                      Tasks: {w.active_tasks}
                    </div>
                    {isRerouted && (
                      <div style={{
                        marginTop: '6px', fontSize: '11px',
                        color: '#dc2626', fontWeight: '600'
                      }}>
                         Path being rerouted
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Instructions */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            fontSize: '11px', color: '#94a3b8'
          }}>
            Drag worker pins to simulate movement.<br/>
            Congestion alerts update every 3 seconds.<br/>
            Rerouted workers see updated paths on their dashboard.
          </div>
        </div>
      </div>
    </div>
  );
}
