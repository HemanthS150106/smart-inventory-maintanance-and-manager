import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import WarehouseSVGViewer from '../components/WarehouseSVGViewer.jsx';

const drawRouteOnSVG = (containerId, route) => {
  const container = document.getElementById(containerId);
  if (!container) return;
  const svgEl = container.querySelector('svg');
  if (!svgEl) return;

  // Clear previous route elements
  const existing = svgEl.querySelectorAll('.picking-route-path');
  existing.forEach(el => el.remove());

  if (!route || route.length === 0) return;

  // Points path coordinate generator
  const points = route.map(step => `${step.x},${step.y}`).join(' ');

  // Create SVG path element
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', points);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', '#6366f1'); // Indigo 500
  polyline.setAttribute('stroke-width', '5');
  polyline.setAttribute('stroke-linecap', 'round');
  polyline.setAttribute('stroke-linejoin', 'round');
  polyline.setAttribute('stroke-dasharray', '12,8');
  polyline.setAttribute('class', 'picking-route-path');
  
  const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
  animate.setAttribute('attributeName', 'stroke-dashoffset');
  animate.setAttribute('values', '100;0');
  animate.setAttribute('dur', '4s');
  animate.setAttribute('repeatCount', 'indefinite');
  polyline.appendChild(animate);

  svgEl.appendChild(polyline);

  // Markers for points
  route.forEach((step, i) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', step.x);
    circle.setAttribute('cy', step.y);
    circle.setAttribute('r', step.type === 'pickup' ? '12' : '16');
    
    let fill = '#6366f1';
    if (step.type === 'start') fill = '#3b82f6';
    if (step.type === 'end')   fill = '#22c55e';
    
    circle.setAttribute('fill', fill);
    circle.setAttribute('stroke', 'white');
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('class', 'picking-route-path');
    svgEl.appendChild(circle);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', step.x);
    text.setAttribute('y', step.y + 3);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', 'white');
    text.setAttribute('font-size', '8');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('class', 'picking-route-path');
    text.textContent = step.step;
    svgEl.appendChild(text);
  });
};

export default function WorkerDashboard() {
  const [worker, setWorker] = useState(() => {
    const workerStr = sessionStorage.getItem('worker');
    return workerStr ? JSON.parse(workerStr) : null;
  });
  const [tasks, setTasks] = useState([]);
  const [svgContent, setSvgContent] = useState('');
  const [checkedItems, setCheckedItems] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [showRouteOnMap, setShowRouteOnMap] = useState(false);

  // Guard route on mount + polling
  useEffect(() => {
    const storedWorker = JSON.parse(
      sessionStorage.getItem('worker') || 'null'
    );
    if (!storedWorker) {
      navigate('/login');
      return;
    }
    loadTasks(false);
    fetchSVG();

    const interval = setInterval(() => {
      loadTasks(true);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const loadTasks = async (isSilent = false) => {
    const storedWorker = JSON.parse(
      sessionStorage.getItem('worker') || 'null'
    );
    if (!storedWorker) return;

    const workerId = storedWorker.worker_id || storedWorker.workerId || storedWorker.id;
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch(`/api/tasks?workerId=${workerId}`);
      const data = await res.json();
      if (data.success && data.tasks) {
        // Show all tasks except completed
        const activeTasks = (data.tasks || []).filter(
          t => t.status !== 'Completed'
        );
        setTasks(activeTasks);
        
        // Preserve checked items instead of overwriting
        setCheckedItems(prev => {
          const checks = { ...prev };
          activeTasks.forEach(task => {
            (task.shelfCoordinates || []).forEach(slot => {
              if (checks[slot.slot_id] === undefined) {
                checks[slot.slot_id] = false;
              }
            });
          });
          return checks;
        });
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Error fetching picker tasks:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const fetchSVG = () => {
    fetch('/svgs/warehouse_allocated.svg?t=' + Date.now())
      .then(r => r.text())
      .then(text => {
        setSvgContent(text);
      })
      .catch(err => console.error('Error fetching SVG:', err));
  };

  // Run SVG highlighting when tasks or SVG content changes
  useEffect(() => {
    if (svgContent) {
      setTimeout(() => {
        highlightWorkerSlots(tasks);
      }, 100);
    }
  }, [tasks, svgContent]);

  // Handle route path polyline rendering
  useEffect(() => {
    if (showRouteOnMap && tasks.length > 0 && tasks[0].route) {
      setTimeout(() => {
        drawRouteOnSVG('svg-viewer-worker', tasks[0].route);
      }, 150);
    } else {
      setTimeout(() => {
        drawRouteOnSVG('svg-viewer-worker', null);
      }, 150);
    }
  }, [showRouteOnMap, tasks, svgContent]);

  const highlightWorkerSlots = (tasks) => {
    const container = document.getElementById('svg-viewer-worker');
    if (!container) return;

    if (!tasks || tasks.length === 0) {
      container.querySelectorAll('rect[id^="rect-"]').forEach(el => {
        el.style.opacity = '1.0';
        el.style.fill = '#f8f9fa';
        el.style.stroke = '#e2e8f0';
        el.style.strokeWidth = '0.5px';
        el.style.filter = '';
      });
      container.querySelectorAll('text[id^="text-id-"], text[id^="text-wt-"]').forEach(text => {
        text.style.display = 'none';
      });
      container.querySelectorAll('text[id^="text-empty-"]').forEach(text => {
        text.style.display = '';
        const slotId = text.id.replace('text-empty-', '');
        const short_id = slotId.split('-');
        text.textContent = short_id.length >= 2 ? `${short_id[0].slice(-3)}-${short_id[1]}` : slotId;
        text.style.fill = '#94a3b8';
        text.style.fontWeight = 'normal';
      });
      return;
    }

    const allSlotIds = tasks.flatMap(t =>
      (t.shelfCoordinates || []).map(s => s.slot_id)
    );

    // Build step map from route
    const stepMap = {};
    tasks.forEach(t => {
      (t.route || []).forEach(step => {
        if (step.type === 'pickup') {
          stepMap[step.slot_id] = step.step;
        }
      });
    });

    container.querySelectorAll('rect[id^="rect-"]').forEach(el => {
      const slotId = el.id.replace('rect-', '');
      const isMine = allSlotIds.includes(slotId);

      if (isMine) {
        el.style.opacity    = '1.0';
        el.style.stroke     = '#3b82f6';
        el.style.strokeWidth = '3px';
        el.style.fill       = '#bfdbfe';  // light blue highlight
        el.style.filter     = 'drop-shadow(0px 0px 6px rgba(59,130,246,0.9))';
      } else {
        // Render as completely empty background slot for privacy
        el.style.opacity    = '1.0';
        el.style.fill       = '#f8f9fa';
        el.style.stroke     = '#e2e8f0';
        el.style.strokeWidth = '0.5px';
        el.style.filter     = 'none';
      }
    });

    container.querySelectorAll('text[id^="text-id-"], text[id^="text-wt-"], text[id^="text-empty-"]').forEach(text => {
      const slotId = text.id.replace('text-id-', '').replace('text-wt-', '').replace('text-empty-', '');
      const isMine = allSlotIds.includes(slotId);
      
      if (isMine) {
        text.style.opacity = '1.0';
        text.style.display = '';

        if (text.id.startsWith('text-empty-') && stepMap[slotId]) {
          text.textContent = `[Step ${stepMap[slotId]}] ${slotId}`;
          text.style.fill = '#1e3a8a';
          text.style.fontWeight = 'bold';
        } else if (text.id.startsWith('text-id-') && stepMap[slotId]) {
          if (!text.dataset.originalText) {
            text.dataset.originalText = text.textContent;
          }
          text.textContent = `Step ${stepMap[slotId]}: ${text.dataset.originalText}`;
          text.style.fill = '#1e3a8a';
          text.style.fontWeight = 'bold';
        }
      } else {
        // Format as completely empty background label
        text.style.opacity = '1.0';
        
        if (text.id.startsWith('text-id-') || text.id.startsWith('text-wt-')) {
          text.style.display = 'none';
        } else if (text.id.startsWith('text-empty-')) {
          text.style.display = '';
          const short_id = slotId.split('-');
          text.textContent = short_id.length >= 2 ? `${short_id[0].slice(-3)}-${short_id[1]}` : slotId;
          text.style.fill = '#94a3b8';
          text.style.fontWeight = 'normal';
        }
      }
    });
  };

  const handleToggleCheck = (slotId) => {
    setCheckedItems(prev => ({
      ...prev,
      [slotId]: !prev[slotId]
    }));
  };

  const handleLogout = () => {
    sessionStorage.removeItem('worker');
    navigate('/login');
  };

  const completeTask = async (taskId) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, { method: 'PATCH' });
      const data = await res.json();
      if (data.success) {
        alert('Task completed successfully! Please return the cart to the dispatch area.');
        setShowRouteOnMap(false);
        loadTasks();
        fetchSVG();
      } else {
        alert('Failed to complete task: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Failed to complete task: Network error');
    }
  };

  if (!worker) return null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white shadow-md">
        <div className="mx-auto max-w-7xl px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-indigo-400">Smart Picker Terminal</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-300">Welcome, {worker.name} ({worker.role})</span>
            <button
              onClick={handleLogout}
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-3 py-1.5 rounded transition font-semibold"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Map View (3/4 width on desktop) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-800">Your Picking Map (Highlighted Slots)</h2>
              {tasks.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-bold">
                  {tasks.flatMap(t => t.shelfCoordinates || []).length} active pick spots
                </span>
              )}
            </div>
            
            <div className="p-4 flex-1 relative bg-slate-50">
              {svgContent ? (
                <WarehouseSVGViewer
                  svgContent={svgContent}
                  containerId="svg-viewer-worker"
                />
              ) : (
                <div className="text-slate-400 py-20 text-center">Loading warehouse footprint...</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Todo List Panel (1/4 width on desktop) */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            
            {/* Active Task Info */}
            <div className="bg-indigo-900 text-white p-4 border-b border-indigo-950">
              <h3 className="font-bold text-base">📋 TODO LIST</h3>
              {tasks.length > 0 ? (
                <div className="mt-2 text-xs text-indigo-200 font-medium">
                  <p>Active tasks: <span className="text-white font-mono font-bold">{tasks.length}</span></p>
                </div>
              ) : (
                <p className="text-indigo-200 text-xs mt-1">No active task assigned.</p>
              )}
            </div>

            {/* Checklist */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading ? (
                <p className="text-slate-400 text-sm text-center py-10">Fetching your task...</p>
              ) : tasks.length === 0 ? (
                <div style={{
                  padding: '40px', textAlign: 'center',
                  color: '#94a3b8', background: '#f8fafc',
                  borderRadius: '12px', border: '2px dashed #e2e8f0'
                }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>
                    📭
                  </div>
                  <p style={{ margin: 0, fontSize: '16px' }}>
                    No tasks assigned yet.
                  </p>
                  <p style={{ margin: '8px 0 0', fontSize: '13px' }}>
                    The page refreshes automatically every 8 seconds.
                  </p>
                </div>
              ) : (
                tasks.map(task => {
                  const allPickedForTask = (task.shelfCoordinates || []).length > 0 &&
                    (task.shelfCoordinates || []).every(s => checkedItems[s.slot_id]);

                  return (
                    <div key={task.taskId} className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <div>
                          <span className="font-bold text-slate-800 text-sm">{task.taskId}</span>
                          <p className="text-[10px] text-slate-500">Cart: <span className="font-mono font-bold text-slate-700">{task.cartId}</span></p>
                        </div>
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">{task.status}</span>
                      </div>
                      
                      <div className="space-y-2">
                        {(task.shelfCoordinates || []).map(slot => (
                          <div 
                            key={slot.slot_id}
                            onClick={() => handleToggleCheck(slot.slot_id)}
                            className={`p-2.5 rounded-md border cursor-pointer flex items-center justify-between transition ${
                              checkedItems[slot.slot_id] 
                                ? 'bg-green-50 border-green-200 text-green-700' 
                                : 'bg-white border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            <div className="flex-1 pr-2">
                              <div className="font-bold text-xs">
                                Slot: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">{slot.slot_id}</span>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={!!checkedItems[slot.slot_id]}
                              onChange={() => {}} // handled by card click
                              className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="pt-2">
                        {allPickedForTask ? (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => setShowRouteOnMap(prev => !prev)}
                              className={`w-full font-bold py-1.5 rounded text-xs transition border ${
                                showRouteOnMap
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                  : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              {showRouteOnMap ? 'Hide Route Map' : '🗺️ Show Route to Destination'}
                            </button>
                            <button
                              onClick={() => completeTask(task.taskId)}
                              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 rounded text-xs transition"
                            >
                              Complete Task
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled
                            className="w-full bg-slate-200 text-slate-400 font-bold py-1.5 rounded text-xs cursor-not-allowed"
                          >
                            Pick All Slots to Complete
                          </button>
                        )}
                      </div>

                      {/* Route display inside each task card */}
                      {task.route && task.route.length > 0 && (
                        <div style={{
                          marginTop: '16px', borderTop: '1px solid #e2e8f0',
                          paddingTop: '16px'
                        }}>
                          <h4 style={{ margin: '0 0 12px', fontSize: '14px',
                                       color: '#334155', fontWeight: 'bold' }}>
                            🗺️ Your Picking Route
                            <span style={{ marginLeft: '8px', fontSize: '12px',
                                           color: '#94a3b8', fontWeight: 'normal' }}>
                              ~{task.totalDistance} units · {task.totalStops} stops
                            </span>
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column',
                                        gap: '6px' }}>
                            {task.route.map((step, i) => (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '8px 12px', borderRadius: '8px',
                                background: step.type === 'start' ? '#eff6ff'
                                          : step.type === 'end'   ? '#f0fdf4'
                                          : '#f8fafc',
                                border: '1px solid #e2e8f0'
                              }}>
                                <span style={{
                                  width: '24px', height: '24px', borderRadius: '50%',
                                  background: step.type === 'start' ? '#3b82f6'
                                            : step.type === 'end'   ? '#22c55e'
                                            : '#64748b',
                                  color: 'white', display: 'flex',
                                  alignItems: 'center', justifyContent: 'center',
                                  fontSize: '11px', fontWeight: 'bold',
                                  flexShrink: 0
                                }}>
                                  {step.step}
                                </span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '13px', fontWeight: '600',
                                                color: '#1e293b' }}>
                                    {step.type === 'start'
                                      ? '📍 Start — Receiving Dock'
                                      : step.type === 'end'
                                      ? '🏁 End — Dispatch Dock'
                                      : `📦 ${step.item_id || step.slot_id}`}
                                  </div>
                                  {step.type === 'pickup' && (
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                      Slot {step.slot_id}
                                    </div>
                                  )}
                                </div>
                                {step.cumulative_distance > 0 && (
                                  <span style={{ fontSize: '11px', color: '#94a3b8',
                                                 whiteSpace: 'nowrap' }}>
                                    {step.cumulative_distance} walked
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>

      </main>

    </div>
  );
}
