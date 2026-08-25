import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function drawGoogleMapsStyleRoute(tasks, workerPosition) {
  const svgEl = document.querySelector('#worker-svg-viewer svg');
  if (!svgEl) {
    console.warn('SVG not ready for route drawing');
    return;
  }

  // Remove all old route elements first
  svgEl.querySelectorAll(
    '.worker-route-element, #worker-route-group'
  ).forEach(el => el.remove());

  if (!tasks || tasks.length === 0) return;

  // ── CRITICAL: Build ONE continuous path across all tasks ──
  // If worker has multiple tasks, chain them:
  //   Task 1: ENTRANCE → stops → DISPATCH
  //   Task 2: ENTRANCE → stops → DISPATCH
  // Combined: ENTRANCE → task1 stops → task2 stops → DISPATCH
  // (We drop intermediate DISPATCH/ENTRANCE markers between tasks)

  // Collect all path points as a single continuous array
  const allPathPoints  = [];
  const allStopMarkers = []; // { step, type, pos, slot_id, item_id }
  let   globalStep     = 1;

  const activeTask = tasks[0];
  if (!activeTask || !activeTask.route || activeTask.route.length === 0) return;

  activeTask.route.forEach((step, stepIndex) => {
    const isFirstStepOfFirstTask = stepIndex === 0;
    const isLastStepOfLastTask   = stepIndex === activeTask.route.length - 1;

    // Only include START marker for very first step
    // Only include END marker for very last step
    if (step.type === 'start' && !isFirstStepOfFirstTask) return;
    if (step.type === 'end'   && !isLastStepOfLastTask)   return;

    // Add aisle path points to the continuous path
    if (step.aisle_path && step.aisle_path.length > 0) {
      step.aisle_path.forEach(pt => {
          const last = allPathPoints[allPathPoints.length - 1];
          // Deduplicate consecutive identical points
          if (!last || last.x !== pt.x || last.y !== pt.y) {
            allPathPoints.push(pt);
          }
        });
      }

      // Add stop marker for start, end, and pickup steps
      if (step.type === 'start' || step.type === 'end' ||
          step.type === 'pickup') {
        const lastPt = step.aisle_path?.length > 0
          ? step.aisle_path[step.aisle_path.length - 1]
          : { x: step.x, y: step.y };

        allStopMarkers.push({
          step:    globalStep,
          type:    step.type,
          pos:     lastPt,
          slot_id: step.slot_id,
          item_id: step.item_id,
          taskId:  activeTask.taskId,
          // Whether this stop is completed
          completed: activeTask.completedSlots?.includes(step.slot_id)
        });

        if (step.type === 'pickup') globalStep++;
      }
    });

  if (allPathPoints.length < 2 && allStopMarkers.length === 0) {
    console.warn('No aisle_path data to draw');
    return;
  }

  const routeGroup = document.createElementNS(
    'http://www.w3.org/2000/svg', 'g'
  );
  routeGroup.setAttribute('id', 'worker-route-group');
  routeGroup.setAttribute('pointer-events', 'none');

  // ── DRAW UNIFIED PATH ────────────────────────────────────
  if (allPathPoints.length >= 2) {
    const pointsStr = allPathPoints
      .map(p => `${Math.round(p.x)},${Math.round(p.y)}`)
      .join(' ');

    // Layer 1: white border
    const outline = document.createElementNS(
      'http://www.w3.org/2000/svg', 'polyline'
    );
    outline.setAttribute('points',          pointsStr);
    outline.setAttribute('fill',            'none');
    outline.setAttribute('stroke',          'white');
    outline.setAttribute('stroke-width',    '18');
    outline.setAttribute('stroke-linecap',  'round');
    outline.setAttribute('stroke-linejoin', 'round');
    outline.setAttribute('opacity',         '0.85');
    outline.setAttribute('class',           'worker-route-element');
    routeGroup.appendChild(outline);

    // Layer 2: main blue route
    const mainLine = document.createElementNS(
      'http://www.w3.org/2000/svg', 'polyline'
    );
    mainLine.setAttribute('points',          pointsStr);
    mainLine.setAttribute('fill',            'none');
    mainLine.setAttribute('stroke',          '#1a73e8');
    mainLine.setAttribute('stroke-width',    '12');
    mainLine.setAttribute('stroke-linecap',  'round');
    mainLine.setAttribute('stroke-linejoin', 'round');
    mainLine.setAttribute('opacity',         '0.9');
    mainLine.setAttribute('class',           'worker-route-element');
    routeGroup.appendChild(mainLine);

    // Layer 3: animated flow dots
    const flowLine = document.createElementNS(
      'http://www.w3.org/2000/svg', 'polyline'
    );
    flowLine.setAttribute('points',           pointsStr);
    flowLine.setAttribute('fill',             'none');
    flowLine.setAttribute('stroke',           'white');
    flowLine.setAttribute('stroke-width',     '4');
    flowLine.setAttribute('stroke-dasharray', '8,24');
    flowLine.setAttribute('stroke-linecap',   'round');
    flowLine.setAttribute('opacity',          '0.9');
    flowLine.setAttribute('class',           'worker-route-element');

    const anim = document.createElementNS(
      'http://www.w3.org/2000/svg', 'animate'
    );
    anim.setAttribute('attributeName', 'stroke-dashoffset');
    anim.setAttribute('from',          '0');
    anim.setAttribute('to',            '-32');
    anim.setAttribute('dur',           '0.8s');
    anim.setAttribute('repeatCount',   'indefinite');
    flowLine.appendChild(anim);
    routeGroup.appendChild(flowLine);
  }

  // ── DRAW STOP MARKERS ────────────────────────────────────
  // ONE start marker, ONE end marker, numbered pickup markers
  // Completed stops are shown greyed out with a checkmark

  const startMarker = allStopMarkers.find(m => m.type === 'start');
  const endMarker   = allStopMarkers.find(m => m.type === 'end');
  const pickups     = allStopMarkers.filter(m => m.type === 'pickup');

  function drawMarker(pos, label, color, borderColor) {
    if (!pos) return;

    const ring = document.createElementNS(
      'http://www.w3.org/2000/svg', 'circle'
    );
    ring.setAttribute('cx',    pos.x);
    ring.setAttribute('cy',    pos.y);
    ring.setAttribute('r',     '18');
    ring.setAttribute('fill',  borderColor || 'white');
    ring.setAttribute('class', 'worker-route-element');
    ring.setAttribute('pointer-events', 'none');
    routeGroup.appendChild(ring);

    const circle = document.createElementNS(
      'http://www.w3.org/2000/svg', 'circle'
    );
    circle.setAttribute('cx',   pos.x);
    circle.setAttribute('cy',   pos.y);
    circle.setAttribute('r',    '14');
    circle.setAttribute('fill', color);
    circle.setAttribute('class', 'worker-route-element');
    circle.setAttribute('pointer-events', 'none');
    routeGroup.appendChild(circle);

    const text = document.createElementNS(
      'http://www.w3.org/2000/svg', 'text'
    );
    text.setAttribute('x',            pos.x);
    text.setAttribute('y',            pos.y + 5);
    text.setAttribute('text-anchor',  'middle');
    text.setAttribute('font-size',    '12');
    text.setAttribute('font-weight',  'bold');
    text.setAttribute('fill',         'white');
    text.setAttribute('class',        'worker-route-element');
    text.setAttribute('pointer-events', 'none');
    text.textContent = label;
    routeGroup.appendChild(text);
  }

  // Draw START — exactly one green S marker
  if (startMarker?.pos) {
    drawMarker(startMarker.pos, 'S', '#34a853', 'white');
  }

  // Draw END — exactly one red E marker
  if (endMarker?.pos) {
    drawMarker(endMarker.pos, 'E', '#ea4335', 'white');
  }

  // Draw PICKUP stops — numbered, grey if completed
  pickups.forEach((m, i) => {
    if (!m.pos) return;
    const color = m.completed ? '#9ca3af' : '#1a73e8';
    drawMarker(m.pos, m.completed ? '✓' : String(i + 1),
               color, 'white');

    // Slot label below marker
    if (m.slot_id) {
      const label = document.createElementNS(
        'http://www.w3.org/2000/svg', 'text'
      );
      label.setAttribute('x',           m.pos.x);
      label.setAttribute('y',           m.pos.y + 34);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size',   '9');
      label.setAttribute('fill',        m.completed ? '#9ca3af' : '#1a73e8');
      label.setAttribute('font-weight', 'bold');
      label.setAttribute('class',        'worker-route-element');
      label.setAttribute('pointer-events', 'none');
      label.textContent = m.slot_id;
      routeGroup.appendChild(label);
    }
  });

  // Pulsating Blue Location Pin (like Google Maps)
  if (workerPosition) {
    const pulseRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pulseRing.setAttribute('cx', workerPosition.x);
    pulseRing.setAttribute('cy', workerPosition.y);
    pulseRing.setAttribute('r', '20');
    pulseRing.setAttribute('fill', '#1a73e8');
    pulseRing.setAttribute('opacity', '0.35');
    pulseRing.setAttribute('class', 'worker-route-element');
    
    const scaleAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    scaleAnim.setAttribute('attributeName', 'r');
    scaleAnim.setAttribute('values', '12;28;12');
    scaleAnim.setAttribute('dur', '1.8s');
    scaleAnim.setAttribute('repeatCount', 'indefinite');
    pulseRing.appendChild(scaleAnim);
    routeGroup.appendChild(pulseRing);

    const mainPin = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    mainPin.setAttribute('cx', workerPosition.x);
    mainPin.setAttribute('cy', workerPosition.y);
    mainPin.setAttribute('r', '9');
    mainPin.setAttribute('fill', '#1a73e8');
    mainPin.setAttribute('stroke', 'white');
    mainPin.setAttribute('stroke-width', '2.5');
    mainPin.setAttribute('class', 'worker-route-element');
    routeGroup.appendChild(mainPin);
  }

  svgEl.appendChild(routeGroup);
  console.log(
    `Route drawn: ${allPathPoints.length} waypoints,`,
    `${pickups.length} stops,`,
    `${pickups.filter(p=>p.completed).length} completed`
  );
}

function SlotRow({ isCompleted, labelText, itemText, onToggle }) {
  return (
    <div
      onClick={onToggle}
      className={`p-2.5 rounded-md border cursor-pointer flex items-center justify-between transition ${
        isCompleted 
          ? 'bg-green-50 border-green-200 text-green-700 opacity-70' 
          : 'bg-white border-slate-200 hover:border-indigo-300'
      }`}
    >
      {/* Checkbox */}
      <div
        className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
          isCompleted ? 'bg-green-500 border-green-500' : 'bg-white border-slate-300'
        }`}
      >
        {isCompleted && (
          <span className="text-white text-xs font-bold">✓</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 pr-2 ml-3">
        <div className={`font-bold text-xs ${isCompleted ? 'line-through text-slate-500' : 'text-slate-800'}`}>
          {labelText}
        </div>
        {itemText && (
          <div className="text-[10px] text-slate-400 mt-1 font-semibold">
            {itemText}
          </div>
        )}
      </div>

      {isCompleted && (
        <span className="text-[10px] text-green-600 font-bold">
           Done
        </span>
      )}
    </div>
  );
}

export default function WorkerDashboard() {
  const [worker, setWorker] = useState(() => {
    const workerStr = sessionStorage.getItem('worker');
    return workerStr ? JSON.parse(workerStr) : null;
  });
  const [tasks, setTasks] = useState([]);
  const [svgLoaded, setSvgLoaded] = useState(false);
  const svgContentRef = useRef('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [showRouteOnMap, setShowRouteOnMap] = useState(true);
  const [currentPos, setCurrentPos] = useState(null);

  // Persistent cart loading checklist state
  const [loadedItems, setLoadedItems] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('loadedItems') || '{}');
    } catch (e) {
      return {};
    }
  });

  const updateLoadedItems = (taskId, slotId, val) => {
    setLoadedItems(prev => {
      const next = { ...prev };
      if (!next[taskId]) next[taskId] = [];
      if (val) {
        if (!next[taskId].includes(slotId)) next[taskId].push(slotId);
      } else {
        next[taskId] = next[taskId].filter(id => id !== slotId);
      }
      sessionStorage.setItem('loadedItems', JSON.stringify(next));
      return next;
    });
  };

  function handleSlotComplete(taskId, slotId) {
    // Merge into tasks for route redrawing and slot highlights
    const updatedTasks = window._currentWorkerTasks?.map(t =>
      t.taskId === taskId
        ? { ...t, completedSlots: [
              ...(t.completedSlots || []), slotId
            ]}
        : t
    ) || [];
    window._currentWorkerTasks = updatedTasks;

    setTasks(prev => prev.map(t =>
      t.taskId === taskId
        ? { ...t, completedSlots: [
              ...(t.completedSlots || []), slotId
            ]}
        : t
    ));

    // Redraw route and update slot highlights
    setTimeout(() => {
      const svgEl = document.querySelector('#worker-svg-viewer svg');
      if (svgEl && window._currentWorkerTasks) {
        drawGoogleMapsStyleRoute(window._currentWorkerTasks, currentPos);
        highlightWorkerSlots(window._currentWorkerTasks);
      }
    }, 100);
  }

  // Zoom/pan state
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });

  // Guard route on mount + polling (updated to 1.5s for real-time tracking)
  useEffect(() => {
    const storedWorker = JSON.parse(
      sessionStorage.getItem('worker') || 'null'
    );
    if (!storedWorker) {
      return;
    }
    loadTasks(false);
    loadSVG();

    const interval = setInterval(() => {
      loadTasks(true);
    }, 3000);
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
      // 1. Fetch current worker position coordinates
      const wRes = await fetch('/api/workers');
      const wData = await wRes.json();
      const currentWorker = (wData.workers || []).find(w => w.worker_id === workerId);
      const workerPos = currentWorker ? { x: currentWorker.position_x, y: currentWorker.position_y } : null;
      setCurrentPos(workerPos);

      // 2. Fetch tasks
      const res = await fetch(`/api/tasks?workerId=${workerId}`);
      const data = await res.json();
      console.log('Raw tasks response:', data);

      if (data.success && data.tasks) {
        const now = Date.now();
        const activeTasks = (data.tasks || []).filter(t => {
          if (t.status === 'Completed' || t.status === 'Abandoned') {
            return false;
          }
          if (t.assignedAt) {
            const ageHrs = (now - new Date(t.assignedAt)) / 3600000;
            if (ageHrs > 12) return false;
          }
          return true;
        });

        console.log(`Active tasks: ${activeTasks.length}`);
        activeTasks.forEach(t => {
          console.log(
            `  Task ${t.taskId}: ${t.route?.length || 0} route steps, ` +
            `aisle_path in step[1]: ` +
            `${t.route?.[1]?.aisle_path?.length || 0} points`
          );
        });

        window._currentWorkerTasks = activeTasks;
        setTasks(activeTasks);

        // Highlight slots
        highlightWorkerSlots(activeTasks);

        // Draw route if SVG is already loaded
        const svgEl = document.querySelector('#worker-svg-viewer svg');
        if (svgEl && activeTasks.length > 0 && showRouteOnMap) {
          drawGoogleMapsStyleRoute(activeTasks, workerPos);
        }
      } else {
        window._currentWorkerTasks = [];
        setTasks([]);
        highlightWorkerSlots([]);
      }
    } catch (err) {
      console.error('Error fetching picker tasks:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const loadSVG = async () => {
    try {
      const res = await fetch('/svgs/warehouse_allocated.svg?t=' + Date.now());
      const text = await res.text();
      svgContentRef.current = text;
      setSvgLoaded(true);

      const viewer = document.getElementById('worker-svg-viewer');
      if (viewer) {
        viewer.innerHTML = text;

        // Wait one frame for DOM to settle, then draw
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const currentTasks = window._currentWorkerTasks || [];
            highlightWorkerSlots(currentTasks);
            if (showRouteOnMap && currentTasks.length > 0) {
              drawGoogleMapsStyleRoute(currentTasks, currentPos);
            }
          });
        });
      }
    } catch (err) {
      console.error('Error fetching SVG:', err);
    }
  };

  // Reset/fit view on SVG load
  useEffect(() => {
    if (svgLoaded && containerRef.current) {
      const container = containerRef.current;
      const cw = container.clientWidth || 800;
      const ch = container.clientHeight || 500;
      const fitScale = Math.min(cw / 3200, ch / 2500) * 0.95;
      setScale(fitScale);
      setTranslate({
        x: (cw - 3200 * fitScale) / 2,
        y: (ch - 2500 * fitScale) / 2
      });
    }
  }, [svgLoaded]);

  // Run SVG highlighting when tasks, showRouteOnMap or position shifts
  useEffect(() => {
    const viewer = document.getElementById('worker-svg-viewer');
    if (viewer && viewer.innerHTML) {
      highlightWorkerSlots(tasks);
      if (showRouteOnMap) {
        drawGoogleMapsStyleRoute(tasks, currentPos);
      } else {
        // Clear route path
        const svgEl = viewer.querySelector('svg');
        if (svgEl) {
          svgEl.querySelectorAll('.worker-route-element').forEach(el => el.remove());
        }
      }
    }
  }, [tasks, showRouteOnMap, svgLoaded, currentPos]);

  function handleWheel(e) {
    e.preventDefault();
    e.stopPropagation();

    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 20;   // line mode
    if (e.deltaMode === 2) delta *= 300;  // page mode

    const zoomFactor = Math.pow(0.97, delta / 100);
    const newScale   = Math.min(15, Math.max(0.05, scale * zoomFactor));

    const rect = containerRef.current.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;

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

  function resetView() {
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth || 800;
    const ch = container.clientHeight || 500;
    const fitScale = Math.min(cw / 3200, ch / 2500) * 0.95;
    setScale(fitScale);
    setTranslate({
      x: (cw - 3200 * fitScale) / 2,
      y: (ch - 2500 * fitScale) / 2
    });
  }

  const highlightWorkerSlots = (tasks) => {
    const container = document.getElementById('worker-svg-viewer');
    if (!container) return;

    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    if (!tasks || tasks.length === 0) {
      // Restore normal background slots
      svgEl.querySelectorAll('[data-slot-id]').forEach(el => {
        el.setAttribute('opacity', '1.0');
        el.setAttribute('fill', '#f8f9fa');
        el.setAttribute('stroke', '#e2e8f0');
        el.setAttribute('stroke-width', '0.5');
        el.style.animation = '';
      });
      // Restore uprights and shelves
      svgEl.querySelectorAll('[fill="#1e3a5f"]').forEach(el => {
        el.setAttribute('opacity', '1.0');
      });
      svgEl.querySelectorAll('[fill="#94a3b8"]').forEach(el => {
        el.setAttribute('opacity', '1.0');
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

    const activeTasks = tasks || [];
    const assignedSet = new Set(
      activeTasks.flatMap(t => (t.shelfCoordinates || []).map(s => s.slot_id))
    );
    const completedSet = new Set(
      activeTasks.flatMap(t => t.completedSlots || [])
    );

    // Build step map from route
    const stepMap = {};
    activeTasks.forEach(t => {
      (t.route || []).forEach(step => {
        if (step.type === 'pickup') {
          stepMap[step.slot_id] = step.step;
        }
      });
    });

    // Apply to every rect with data-slot-id
    svgEl.querySelectorAll('[data-slot-id]').forEach(el => {
      const slotId = el.getAttribute('data-slot-id');
      const isAssigned = assignedSet.has(slotId);
      const isDone = completedSet.has(slotId);

      if (isAssigned && !isDone) {
        // ASSIGNED + NOT YET DONE: bright highlight
        el.setAttribute('fill', '#bfdbfe'); // light blue
        el.setAttribute('opacity', '1');
        el.setAttribute('stroke', '#1a73e8');
        el.setAttribute('stroke-width', '2');
        // Add pulsing animation via style
        el.style.animation = 'slot-pulse 2s ease-in-out infinite';
      } else if (isAssigned && isDone) {
        // ASSIGNED + COMPLETED: green done state
        el.setAttribute('fill', '#bbf7d0'); // light green
        el.setAttribute('opacity', '0.9');
        el.setAttribute('stroke', '#22c55e');
        el.setAttribute('stroke-width', '1.5');
        el.style.animation = '';
      } else {
        // NOT ASSIGNED: nearly invisible
        el.setAttribute('opacity', '0.06');
        el.style.animation = '';
      }
    });

    // Keep upright columns visible but very faint
    svgEl.querySelectorAll('[fill="#1e3a5f"]').forEach(el => {
      el.setAttribute('opacity', '0.3');
    });

    // Keep shelf boards visible but faint
    svgEl.querySelectorAll('[fill="#94a3b8"]').forEach(el => {
      el.setAttribute('opacity', '0.2');
    });

    // Keep zone labels, aisle text and IN/OUT gate labels fully visible
    svgEl.querySelectorAll('text').forEach(el => {
      const txt = el.textContent.trim();
      const slotId = el.id.replace('text-id-', '').replace('text-wt-', '').replace('text-empty-', '');
      const isSlotLabel = el.id.startsWith('text-id-') || el.id.startsWith('text-wt-') || el.id.startsWith('text-empty-');

      if (!isSlotLabel) {
        // structural labels (ZONE, AISLE, gates)
        el.setAttribute('opacity', '1.0');
      } else {
        const isMine = assignedSet.has(slotId);
        if (isMine) {
          el.style.opacity = '1.0';
          el.style.display = '';

          if (el.id.startsWith('text-empty-') && stepMap[slotId]) {
            el.textContent = `[Step ${stepMap[slotId]}] ${slotId}`;
            el.style.fill = '#1e3a8a';
            el.style.fontWeight = 'bold';
          } else if (el.id.startsWith('text-id-') && stepMap[slotId]) {
            if (!el.dataset.originalText) {
              el.dataset.originalText = el.textContent;
            }
            el.textContent = `Step ${stepMap[slotId]}: ${el.dataset.originalText}`;
            el.style.fill = '#1e3a8a';
            el.style.fontWeight = 'bold';
          }
        } else {
          // Format as completely empty background label
          el.style.opacity = '1.0';
          if (el.id.startsWith('text-id-') || el.id.startsWith('text-wt-')) {
            el.style.display = 'none';
          } else if (el.id.startsWith('text-empty-')) {
            el.style.display = '';
            const short_id = slotId.split('-');
            el.textContent = short_id.length >= 2 ? `${short_id[0].slice(-3)}-${short_id[1]}` : slotId;
            el.style.fill = '#94a3b8';
            el.style.fontWeight = 'normal';
          }
        }
      }
    });

    // Add CSS animation keyframes if not already present
    if (!document.getElementById('slot-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'slot-pulse-style';
      style.textContent = `
        @keyframes slot-pulse {
          0%   { stroke-opacity: 1;   stroke-width: 2px; }
          50%  { stroke-opacity: 0.4; stroke-width: 3px; }
          100% { stroke-opacity: 1;   stroke-width: 2px; }
        }
      `;
      document.head.appendChild(style);
    }
  };

  const handleToggleCheck = (slotId) => {
    setCheckedItems(prev => ({
      ...prev,
      [slotId]: !prev[slotId]
    }));
  };

  const handleLogout = () => {
    sessionStorage.removeItem('worker');
    sessionStorage.removeItem('admin');
    sessionStorage.removeItem('worker');
    navigate('/login');
  };

  const completeTask = async (taskId) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, { method: 'PATCH' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server returned status ${res.status}: ${text}`);
      }
      const data = await res.json();
      if (data.success) {
        alert('Task completed successfully! Please return the cart to the dispatch area.');
        setShowRouteOnMap(false);
        loadTasks();
        loadSVG();
      } else {
        alert('Failed to complete task: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Failed to complete task: ' + err.message);
    }
  };

  const activateTask = async (taskId) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/activate`, { method: 'PATCH' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server returned status ${res.status}: ${text}`);
      }
      const data = await res.json();
      if (data.success) {
        alert('All items picked! Please start moving to dispatch dock. Use Simulation keyboard WASD controls.');
        loadTasks();
      } else {
        alert('Failed to activate task: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Failed to activate task: ' + err.message);
    }
  };

  if (!worker) return null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white shadow-md">
        <div className="mx-auto max-w-7xl px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-[#F4F6F8]">Smart Picker Terminal</span>
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
              {!svgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-20">
                  <div style={{ textAlign: 'center' }}>
                    <div className="loading-spinner" style={{
                      width: '48px', height: '48px',
                      border: '4px solid #e2e8f0',
                      borderTopColor: '#2F6B8A',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      margin: '0 auto 16px'
                    }} />
                    <p style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>Loading warehouse map…</p>
                  </div>
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
                  width: '100%', height: '70vh',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  position: 'relative', overflow: 'hidden',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px'
                }}
              >
                {/* Zoom controls */}
                <div style={{
                  position: 'absolute', top: '12px', right: '12px',
                  zIndex: 10, display: 'flex', gap: '6px',
                  flexDirection: 'column'
                }}>
                  {[
                    { label: '+',    action: () => setScale(s => Math.min(15, s * 1.25)) },
                    { label: '−',    action: () => setScale(s => Math.max(0.05, s / 1.25)) },
                    { label: '⊡',    action: resetView },
                  ].map(btn => (
                    <button key={btn.label} type="button" onClick={btn.action}
                      style={{
                        width: '36px', height: '36px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px', background: 'white',
                        color: 'black',
                        cursor: 'pointer', fontSize: '18px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Zoom level indicator */}
                <div style={{
                  position: 'absolute', bottom: '12px', right: '12px',
                  zIndex: 10, background: 'rgba(255,255,255,0.9)',
                  padding: '4px 10px', borderRadius: '6px',
                  fontSize: '12px', color: '#64748b',
                  border: '1px solid #e2e8f0', pointerEvents: 'none'
                }}>
                  {Math.round(scale * 100)}%
                </div>

                {/* Instruction hint */}
                <div style={{
                  position: 'absolute', bottom: '12px', left: '12px',
                  zIndex: 10, background: 'rgba(255,255,255,0.85)',
                  padding: '4px 10px', borderRadius: '6px',
                  fontSize: '11px', color: '#94a3b8',
                  border: '1px solid #e2e8f0', pointerEvents: 'none'
                }}>
                  Scroll to zoom · Drag to pan
                </div>

                {/* Transformed SVG layer */}
                <div
                  id="worker-svg-viewer"
                  style={{
                    transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                    transformOrigin: '0 0',
                    position: 'absolute', top: 0, left: 0,
                    width: '100%', overflow: 'visible',
                    transition: isDragging ? 'none' : 'transform 0.1s'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Todo List Panel (1/4 width on desktop) */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            
            {/* Active Task Info */}
            <div className="bg-[#1E3A5F] text-white p-4 border-b border-[#162D4A]">
              <h3 className="font-bold text-base"> TODO LIST</h3>
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
                  const isAssigned     = task.status === 'Assigned';
                  const totalStops     = task.shelfCoordinates?.length || 0;
                  const completedCount = isAssigned
                    ? (loadedItems[task.taskId] || []).length
                    : (task.completedSlots || []).length;

                  const progressPct    = totalStops > 0
                    ? Math.round((completedCount / totalStops) * 100) : 0;
                  const allDoneForStage = totalStops > 0 && completedCount === totalStops;

                  return (
                    <div key={task.taskId} className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <div>
                          <span className="font-bold text-slate-800 text-sm">{task.taskId}</span>
                          <div className="text-xs font-semibold text-slate-500 my-0.5">
                            {task.type === 'outbound' ? " Pick & Dispatch Task" : " Put-Away Task"}
                          </div>
                          <p className="text-[10px] text-slate-500">Cart: <span className="font-mono font-bold text-slate-700">{task.cartId}</span></p>
                        </div>
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                          {task.status === 'In Progress — All Stops Visited' ? 'At Return Leg' : task.status}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex justify-between mb-1.5 text-xs">
                          <span className="text-slate-600 font-semibold">
                            {isAssigned ? 'Cart Loading Progress' : 'Warehouse Stops Progress'}
                          </span>
                          <span className="text-green-600 font-bold">
                            {completedCount} / {totalStops} {isAssigned ? 'loaded' : 'visited'}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              progressPct === 100 ? 'bg-green-500' : 'bg-[#2F6B8A]'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        {progressPct === 100 && (
                          <p className="mt-2 text-[10px] text-green-600 font-bold text-center">
                            {isAssigned
                              ? ' All items loaded in cart — start route'
                              : task.type === 'outbound'
                              ? ' All stops visited — proceed to DISPATCH gate'
                              : ' All stops visited — return to ENTRANCE dock'}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        {(task.shelfCoordinates || []).map(slot => {
                          const isSlotDone = isAssigned
                            ? (loadedItems[task.taskId] || []).includes(slot.slot_id)
                            : (task.completedSlots || []).includes(slot.slot_id);

                          const labelText = isAssigned
                            ? `Load Cart: ${slot.slot_id}`
                            : `${task.type === 'outbound' ? 'Pick Slot' : 'Place Slot'}: ${slot.slot_id}`;

                          const handleToggle = async () => {
                            if (isSlotDone) return;
                            if (isAssigned) {
                              updateLoadedItems(task.taskId, slot.slot_id, true);
                            } else {
                              try {
                                const res = await fetch(
                                  `/api/tasks/${task.taskId}/stop/${slot.slot_id}/complete`,
                                  { method: 'PATCH' }
                                );
                                const data = await res.json();
                                if (data.success) {
                                  handleSlotComplete(task.taskId, slot.slot_id);
                                }
                              } catch (err) {
                                console.error('Failed to mark slot complete:', err);
                              }
                            }
                          };

                          return (
                            <SlotRow
                              key={slot.slot_id}
                              isCompleted={isSlotDone}
                              labelText={labelText}
                              itemText={slot.item_id}
                              onToggle={handleToggle}
                            />
                          );
                        })}
                      </div>

                      <div className="pt-2">
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => setShowRouteOnMap(prev => !prev)}
                            className={`w-full font-bold py-1.5 rounded text-xs transition border ${
                              showRouteOnMap
                                ? 'bg-[#F4F6F8] border-[#D9E0E7] text-[#1E3A5F]'
                                : 'bg-[#2F6B8A] border-indigo-600 text-white hover:bg-[#1E3A5F]'
                            }`}
                          >
                            {showRouteOnMap ? ' Hide Route Map' : ' Show Route Map'}
                          </button>

                          {isAssigned ? (
                            <button
                              disabled={!allDoneForStage}
                              onClick={() => activateTask(task.taskId)}
                              className={`w-full font-bold py-1.5 rounded text-xs transition shadow-md ${
                                allDoneForStage
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {task.type === 'outbound'
                                ? ' Start Picking Route'
                                : ' Start Put-Away Route'}
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <div className="text-center text-xs font-semibold text-blue-700 bg-blue-50 py-2.5 rounded border border-blue-200">
                                {task.type === 'outbound'
                                  ? ' Delivery Leg Active (Move worker via WASD in Simulation)'
                                  : ' Return Leg Active (Move worker via WASD in Simulation)'}
                              </div>
                              <button
                                disabled={!allDoneForStage}
                                onClick={() => completeTask(task.taskId)}
                                className={`w-full font-bold py-1.5 rounded text-xs transition shadow-md ${
                                  allDoneForStage
                                    ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                {task.type === 'outbound'
                                  ? ' Complete Task (Confirm Placement at Dispatch)'
                                  : ' Complete Task (Returned to Entrance)'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Route display inside each task card */}
                      {task.route && task.route.length > 0 && (
                        <div style={{
                          marginTop: '16px', borderTop: '1px solid #e2e8f0',
                          paddingTop: '16px'
                        }}>
                          <h4 style={{ margin: '0 0 12px', fontSize: '14px',
                                       color: '#334155', fontWeight: 'bold' }}>
                             Your Picking Route
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
                                      ? ' Start — Entry Gate'
                                      : step.type === 'end'
                                      ? ' End — Exit Gate'
                                      : ` ${step.item_id || step.slot_id}`}
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
