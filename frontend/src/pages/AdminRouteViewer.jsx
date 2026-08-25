import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ADMIN ROUTE VIEWER
 *
 * Allows administrators/managers to view any active worker's picking route,
 * with thick travel aisle highlight corridors and step indicators.
 */
export default function AdminRouteViewer() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [svgContent, setSvgContent] = useState('');
  const [svgLoaded, setSvgLoaded] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'completed', 'stale'
  const [loading, setLoading] = useState(true);
  
  // Use a ref so the interval closure doesn't overwrite selectedTaskId
  const selectedTaskIdRef = useRef(selectedTaskId);
  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);


  // Zoom/pan state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const admin = JSON.parse(sessionStorage.getItem('admin') || 'null');
    loadTasks();
    fetchSVG();

    const interval = setInterval(() => {
      loadTasks();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.success && data.tasks) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-select task when tasks or tabs change
  useEffect(() => {
    const visibleTasks = getFilteredTasks();
    if (visibleTasks.length > 0 && !visibleTasks.some(t => t.taskId === selectedTaskId)) {
      setSelectedTaskId(visibleTasks[0].taskId);
    } else if (visibleTasks.length === 0) {
      setSelectedTaskId(null);
    }
  }, [tasks, activeTab]);

  const getFilteredTasks = () => {
    if (activeTab === 'active') {
      return tasks.filter(t => t.status !== 'Completed' && t.status !== 'Abandoned');
    } else if (activeTab === 'completed') {
      return tasks.filter(t => t.status === 'Completed');
    } else if (activeTab === 'stale') {
      return tasks.filter(t => t.status === 'Abandoned');
    }
    return [];
  };

  const fetchSVG = async () => {
    try {
      const res = await fetch('/svgs/warehouse_allocated.svg?t=' + Date.now());
      const text = await res.text();
      setSvgContent(text);
      setSvgLoaded(true);
      setTimeout(fitToContainer, 100);
    } catch (err) {
      console.error('Error fetching SVG:', err);
    }
  };

  const fitToContainer = () => {
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth || 800;
    const ch = container.clientHeight || 500;
    const fitScale = Math.min(cw / 3200, ch / 2000) * 0.95;
    setScale(fitScale);
    setTranslate({
      x: (cw - 3200 * fitScale) / 2,
      y: (ch - 2000 * fitScale) / 2
    });
  };

  // Re-run route drawing whenever selected task or SVG content updates
  useEffect(() => {
    const viewer = document.getElementById('admin-route-viewer');
    if (viewer && svgContent) {
      viewer.innerHTML = svgContent;
      const selectedTask = tasks.find(t => t.taskId === selectedTaskId);
      if (selectedTask) {
        highlightTaskSlots(selectedTask);
        drawRoutePath(selectedTask);
      }
    }
  }, [selectedTaskId, tasks, svgContent]);

  function highlightTaskSlots(task) {
    const viewer = document.getElementById('admin-route-viewer');
    if (!viewer) return;

    const allSlotIds = (task.shelfCoordinates || []).map(s => s.slot_id);
    const stepMap = {};
    (task.route || []).forEach(step => {
      if (step.type === 'pickup') {
        stepMap[step.slot_id] = step.step;
      }
    });

    // Highlight slots
    viewer.querySelectorAll('rect[id^="rect-"]').forEach(el => {
      const slotId = el.id.replace('rect-', '');
      if (allSlotIds.includes(slotId)) {
        el.style.opacity = '1.0';
        el.style.stroke = '#2563eb';
        el.style.strokeWidth = '3px';
        el.style.fill = '#bfdbfe';
        el.style.filter = 'drop-shadow(0px 0px 6px rgba(37,99,235,0.9))';
      } else {
        el.style.opacity = '0.5';
        el.style.fill = '#f8f9fa';
        el.style.stroke = '#cbd5e1';
        el.style.strokeWidth = '0.5px';
        el.style.filter = 'none';
      }
    });

    // Highlight text labels
    viewer.querySelectorAll('text[id^="text-id-"], text[id^="text-wt-"], text[id^="text-empty-"]').forEach(text => {
      const slotId = text.id.replace('text-id-', '').replace('text-wt-', '').replace('text-empty-', '');
      if (allSlotIds.includes(slotId)) {
        text.style.opacity = '1.0';
        text.style.display = '';
        if (text.id.startsWith('text-empty-') && stepMap[slotId]) {
          text.textContent = `[Step ${stepMap[slotId]}] ${slotId}`;
          text.style.fill = '#1e3a8a';
          text.style.fontWeight = 'bold';
        }
      } else {
        if (text.id.startsWith('text-id-') || text.id.startsWith('text-wt-')) {
          text.style.display = 'none';
        } else if (text.id.startsWith('text-empty-')) {
          text.style.opacity = '0.3';
        }
      }
    });
  }

  function drawRoutePath(task) {
    const viewer = document.getElementById('admin-route-viewer');
    const svgEl = viewer?.querySelector('svg');
    if (!svgEl) return;

    // Clear previous routes
    svgEl.querySelectorAll('.picking-route-path').forEach(el => el.remove());

    const allPathPoints = (task.route || []).flatMap(step => step.aisle_path || []);
    if (allPathPoints.length === 0) return;

    const pointsStr = allPathPoints.map(p => `${p.x},${p.y}`).join(' ');

    // 1. Draw thick glowing aisle corridor highlight
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    highlight.setAttribute('points', pointsStr);
    highlight.setAttribute('fill', 'none');
    highlight.setAttribute('stroke', '#60a5fa');
    highlight.setAttribute('stroke-width', '28');
    highlight.setAttribute('opacity', '0.3');
    highlight.setAttribute('pointer-events', 'none');
    highlight.setAttribute('class', 'picking-route-path');
    svgEl.appendChild(highlight);

    // 2. Draw dashed center line path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    path.setAttribute('points', pointsStr);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#1e40af');
    path.setAttribute('stroke-width', '4');
    path.setAttribute('stroke-dasharray', '10,6');
    path.setAttribute('opacity', '0.9');
    path.setAttribute('pointer-events', 'none');
    path.setAttribute('class', 'picking-route-path');
    svgEl.appendChild(path);

    // 3. Draw step number indicators
    (task.route || []).forEach(step => {
      if (step.type !== 'pickup') return;
      const pos = step.aisle_path?.[step.aisle_path.length - 1] || { x: step.x, y: step.y };

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
      circle.setAttribute('r', '12');
      circle.setAttribute('fill', '#1e40af');
      circle.setAttribute('opacity', '0.9');
      circle.setAttribute('pointer-events', 'none');
      circle.setAttribute('class', 'picking-route-path');

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', pos.x);
      label.setAttribute('y', pos.y + 4);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', 'white');
      label.setAttribute('font-weight', 'bold');
      label.setAttribute('pointer-events', 'none');
      label.setAttribute('class', 'picking-route-path');
      label.textContent = step.step;

      svgEl.appendChild(circle);
      svgEl.appendChild(label);
    });
  }

  function handleWheel(e) {
    e.preventDefault();
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 20;
    if (e.deltaMode === 2) delta *= 300;
    const zoomFactor = Math.pow(0.97, delta / 100);
    const newScale = Math.min(15, Math.max(0.05, scale * zoomFactor));

    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    setTranslate(t => ({
      x: mx - (mx - t.x) * (newScale / scale),
      y: my - (my - t.y) * (newScale / scale)
    }));
    setScale(newScale);
  }

  function handleMouseDown(e) {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragOrigin({ ...translate });
  }

  function handleMouseMove(e) {
    if (!isDragging) return;
    setTranslate({
      x: dragOrigin.x + (e.clientX - dragStart.x),
      y: dragOrigin.y + (e.clientY - dragStart.y)
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="si-page-title">Admin Route Viewer</h1>
          <p className="text-slate-500 text-sm">
            View active picking routes and travel aisle highlight corridors.
          </p>
        </div>
        <button
          onClick={fitToContainer}
          className="si-btn si-btn--secondary flex items-center gap-1.5"
        >
          ⊡ Reset View
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Map Display (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <span className="font-semibold text-slate-700">Warehouse Picking Map</span>
            <span className="text-xs text-slate-400">Scroll to zoom · Drag to pan</span>
          </div>

          <div className="p-4 bg-slate-50 relative flex-1 min-h-[600px] overflow-hidden">
            {!svgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-400 z-10">
                Loading footprint...
              </div>
            )}
            <div
              ref={containerRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                width: '100%',
                height: '70vh',
                cursor: isDragging ? 'grabbing' : 'grab',
                position: 'relative',
                overflow: 'hidden',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '16px'
              }}
            >
              {/* SVG Layer */}
              <div
                id="admin-route-viewer"
                style={{
                  transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                  transformOrigin: '0 0',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  overflow: 'visible',
                  transition: isDragging ? 'none' : 'transform 0.1s'
                }}
              />

              {/* Zoom percentage overlay */}
              <div className="absolute bottom-4 right-4 bg-white/90 border border-slate-200 px-3 py-1.5 rounded-lg text-xs text-slate-500 pointer-events-none shadow-sm">
                {Math.round(scale * 100)}%
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Task List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[70vh] lg:h-auto">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-700">Tasks ({tasks.length})</h3>
            <div className="flex gap-2 mt-3 border-b border-slate-200 pb-2">
              <button
                className={`text-sm px-3 py-1.5 rounded-lg font-medium transition ${activeTab === 'active' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                onClick={() => setActiveTab('active')}
              >
                Active
              </button>
              <button
                className={`text-sm px-3 py-1.5 rounded-lg font-medium transition ${activeTab === 'completed' ? 'bg-green-100 text-green-700' : 'text-slate-600 hover:bg-slate-100'}`}
                onClick={() => setActiveTab('completed')}
              >
                Completed
              </button>
              <button
                className={`text-sm px-3 py-1.5 rounded-lg font-medium transition ${activeTab === 'stale' ? 'bg-amber-100 text-amber-700' : 'text-slate-600 hover:bg-slate-100'}`}
                onClick={() => setActiveTab('stale')}
              >
                Stale
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="text-slate-400 text-sm text-center py-10">Loading tasks...</div>
            ) : getFilteredTasks().length === 0 ? (
              <div className="text-slate-400 text-sm text-center py-10">No {activeTab} tasks found.</div>
            ) : (
              getFilteredTasks().map(t => {
                const isSelected = t.taskId === selectedTaskId;
                return (
                  <button
                    key={t.taskId}
                    onClick={() => setSelectedTaskId(t.taskId)}
                    className={`w-full text-left p-4 rounded-2xl border transition duration-150 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-slate-900 flex justify-between">
                      <span>Task #{t.taskId.slice(-4)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        t.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                        t.status === 'Completed' ? 'bg-green-100 text-green-800' :
                        t.status === 'Abandoned' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-2 space-y-1">
                      <div> Worker: <span className="font-semibold text-slate-700">{t.workerName || t.workerId}</span></div>
                      <div> Cart ID: <span className="font-semibold text-slate-700">{t.cartId}</span></div>
                      <div> Stops: <span className="font-semibold text-slate-700">{t.shelfCoordinates?.length || 0} slots</span></div>
                      <div>📏 Distance: <span className="font-semibold text-slate-700">{t.totalDistance || 0} units</span></div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
