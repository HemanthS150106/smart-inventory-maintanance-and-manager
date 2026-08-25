'use strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  buildPickingRoute,
  buildPickingRouteFromStart,
  AISLE_SEGMENTS,
  getAisleAtPosition,
  getAislesOnRoute,
  GLOBAL_GRAPH,
  getSlotAccessNode,
  findNearestNonTerminalNode,
  LAYOUT,
  validateRoute
} from './route_planner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REG_DIR = path.join(__dirname, '..', '..', 'data', 'registry');

function readJSON(filename, fallback) {
  try {
    const p = path.join(REG_DIR, filename);
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch { return fallback; }
}

function writeJSON(filename, data) {
  const p   = path.join(REG_DIR, filename);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, p);
}

/**
 * CONGESTION CONTROL ALGORITHM
 *
 * OVERVIEW:
 * Each aisle has a capacity expressed as a fraction of total
 * active carts. Main (wide) aisles allow 25%, walking (narrow)
 * aisles allow 10%.
 *
 * For each aisle, we count:
 *   a) Workers currently IN the aisle (position inside bounds)
 *   b) Workers whose planned route PASSES THROUGH the aisle
 *
 * CAPACITY CHECK:
 *   allowed = Math.ceil(totalActiveCarts * aisle.capacity)
 *   occupancy = workers_in_aisle + workers_routing_through
 *
 * If occupancy > allowed:
 *   CASE 1 — Worker is doing a task IN this aisle (has a slot
 *            in this aisle to service):
 *     Worker stays. All other workers entering this aisle get
 *     rerouted to wait at the aisle entrance until the working
 *     worker exits.
 *
 *   CASE 2 — Worker is just passing through (no task in aisle):
 *     If aisle is over capacity, worker is rerouted to avoid
 *     this aisle entirely. Their route is recalculated with
 *     a high penalty on edges in this aisle.
 *
 * REROUTING PRIORITY:
 *   When multiple workers need rerouting, prioritize keeping
 *   the worker with the MOST remaining stops on their route
 *   (they are deeper into their task and it is costly to
 *   reroute them). Reroute workers with fewer remaining stops.
 *
 * RESULT:
 *   Returns list of { workerId, taskId, newRoute } for workers
 *   whose routes have been changed. Backend writes new routes
 *   to tasks.json. Worker dashboards pick up new routes on
 *   next 8-second poll.
 */

function runCongestionControl() {
  const workersData = readJSON('workers.json', { workers: [] });
  const tasksData   = readJSON('tasks.json',   { tasks:   [] });

  const activeWorkers = workersData.workers.filter(
    w => w.status === 'Busy' &&
         w.position_x !== undefined &&
         w.position_y !== undefined
  );

  const totalActiveCarts = activeWorkers.length;
  if (totalActiveCarts === 0) {
    return { rerouted: [], aisle_states: [] };
  }

  // Build worker-task map
  const workerTaskMap = {};
  activeWorkers.forEach(w => {
    const task = tasksData.tasks.find(
      t => t.workerId === w.worker_id &&
           t.status   !== 'Completed'
    );
    if (task) workerTaskMap[w.worker_id] = task;
  });

  // ── COMPUTE AISLE STATES ─────────────────────────────────
  const aisleStates = AISLE_SEGMENTS.map(seg => {
    const allowed = Math.ceil(totalActiveCarts * seg.capacity);

    // Workers currently physically in this aisle
    const presentWorkers = activeWorkers.filter(w =>
      w.position_x >= seg.bounds.x1 &&
      w.position_x <= seg.bounds.x2 &&
      w.position_y >= seg.bounds.y1 &&
      w.position_y <= seg.bounds.y2
    );

    // Workers whose remaining route passes through this aisle
    const routingWorkers = activeWorkers.filter(w => {
      if (presentWorkers.find(pw => pw.worker_id === w.worker_id)) {
        return false; // already counted as present
      }
      const task = workerTaskMap[w.worker_id];
      if (!task?.route) return false;

      // Check remaining route steps (from current onward)
      const fullPath = task.route.flatMap(s => s.aisle_path || []);
      const aislesOnRoute = getAislesOnRoute(fullPath);
      return aislesOnRoute.includes(seg.id);
    });

    const occupancy = presentWorkers.length + routingWorkers.length;

    // Workers doing actual WORK in this aisle
    // (have a slot to service that is inside this aisle's bounds)
    const workingWorkers = presentWorkers.filter(w => {
      const task = workerTaskMap[w.worker_id];
      if (!task?.shelfCoordinates) return false;
      return task.shelfCoordinates.some(coord =>
        coord.x >= seg.bounds.x1 && coord.x <= seg.bounds.x2 &&
        coord.y >= seg.bounds.y1 && coord.y <= seg.bounds.y2
      );
    });

    return {
      segment:        seg,
      allowed,
      occupancy,
      presentWorkers,
      routingWorkers,
      workingWorkers,
      overCapacity:   occupancy > allowed
    };
  });

  // ── RESOLVE CONGESTION ────────────────────────────────────
  const reroutedTasks = [];
  const alreadyRerouted = new Set();

  aisleStates.filter(s => s.overCapacity).forEach(state => {
    const seg     = state.segment;
    const excess  = state.occupancy - state.allowed;

    console.log(
      `Congestion in ${seg.id}: ${state.occupancy}/${state.allowed} ` +
      `(${excess} over capacity)`
    );

    // Workers eligible for rerouting:
    // NEVER reroute workers doing actual work in this aisle
    const canReroute = [
      ...state.presentWorkers.filter(w =>
        !state.workingWorkers.find(ww => ww.worker_id === w.worker_id)
      ),
      ...state.routingWorkers
    ].filter(w => !alreadyRerouted.has(w.worker_id));

    if (canReroute.length === 0) {
      console.log(`  No rerouteable workers — aisle stays congested`);
      return;
    }

    // Sort: reroute workers with FEWEST remaining stops first
    // (least disruption to reroute them)
    canReroute.sort((a, b) => {
      const taskA = workerTaskMap[a.worker_id];
      const taskB = workerTaskMap[b.worker_id];
      const stopsA = (taskA?.route || []).filter(
        s => s.type === 'pickup'
      ).length;
      const stopsB = (taskB?.route || []).filter(
        s => s.type === 'pickup'
      ).length;
      return stopsA - stopsB; // fewer stops → reroute first
    });

    // Reroute only as many as needed to get below capacity
    for (let i = 0;
         i < excess && i < canReroute.length;
         i++) {
      const worker = canReroute[i];
      const task   = workerTaskMap[worker.worker_id];
      if (!task) continue;

      console.log(`  Rerouting ${worker.worker_id} to avoid ${seg.id}`);

      // Rebuild route with penalty on this aisle's edges
      const remainingSlots = (task.shelfCoordinates || []).filter(
        slot => !(task.completedSlots || []).includes(slot.slot_id)
      );

      // Get worker's current position for dynamic start
      const currentX = worker.position_x;
      const currentY = worker.position_y;
      const isAtDock = (currentX === LAYOUT.ENTRANCE_X &&
                        currentY === LAYOUT.ENTRANCE_Y);

      let newRoute = null;
      if (remainingSlots.length === 0) {
        console.log('All stops complete — routing direct to DISPATCH');
        newRoute = {
          route: [{
            step: 1, node_id: 'ENTRANCE', type: 'start',
            cumulative_distance: 0,
            x: LAYOUT.ENTRANCE_X, y: LAYOUT.ENTRANCE_Y,
            aisle_path: [{ x: LAYOUT.ENTRANCE_X, y: LAYOUT.ENTRANCE_Y }]
          }, {
            step: 2, node_id: 'DISPATCH', type: 'end',
            cumulative_distance: 0,
            x: LAYOUT.DISPATCH_X, y: LAYOUT.DISPATCH_Y,
            aisle_path: [{ x: LAYOUT.DISPATCH_X, y: LAYOUT.DISPATCH_Y }]
          }],
          totalDistance: 0
        };
      } else if (!isAtDock) {
        // Worker is mid-warehouse — route from current position
        newRoute = buildPickingRouteFromStart(
          remainingSlots, currentX, currentY
        );
      } else {
        // Worker at dock — use standard route with aisle avoidance
        newRoute = buildPickingRouteAvoidingAisle(remainingSlots, seg.id);
      }

      // Update task in tasksData
      const taskRef = tasksData.tasks.find(
        t => t.taskId === task.taskId
      );
      if (taskRef) {
        if (validateRoute(newRoute.route, task.taskId)) {
          taskRef.route            = newRoute.route;
          taskRef.totalDistance    = newRoute.totalDistance;
        }
        taskRef.reroutedAt       = new Date().toISOString();
        taskRef.rerouteReason    =
          `Congestion in ${seg.id} (${seg.type} aisle). ` +
          `Capacity: ${state.allowed}, Occupancy: ${state.occupancy}. ` +
          `${task.completedSlots?.length || 0} stops already completed, ` +
          `${remainingSlots.length} remaining.`;
        taskRef.rerouteCount     = (taskRef.rerouteCount || 0) + 1;
      }

      alreadyRerouted.add(worker.worker_id);

      reroutedTasks.push({
        workerId:     worker.worker_id,
        taskId:       task.taskId,
        aisleAvoided: seg.id,
        reason:       taskRef?.rerouteReason,
        newRoute:     newRoute.route
      });
    }
  });

  if (reroutedTasks.length > 0) {
    writeJSON('tasks.json', tasksData);
    console.log(`Congestion control: rerouted ${reroutedTasks.length} workers`);
  }

  return {
    rerouted:     reroutedTasks,
    aisle_states: aisleStates.map(s => ({
      id:          s.segment.id,
      type:        s.segment.type,
      allowed:     s.allowed,
      occupancy:   s.occupancy,
      over:        s.overCapacity,
      working:     s.workingWorkers.map(w => w.worker_id),
      present:     s.presentWorkers.map(w => w.worker_id),
      routing:     s.routingWorkers.map(w => w.worker_id)
    }))
  };
}

/**
 * Build a route that actively avoids a specific aisle segment.
 * Adds a high cost penalty to graph edges passing through the
 * congested aisle so A* routes around it instead.
 */
function buildPickingRouteAvoidingAisle(slots, avoidAisleId) {
  if (!slots || slots.length === 0) {
    return { route: [], totalDistance: 0, totalStops: 0,
             fullPathPoints: [] };
  }

  const avoidSeg = AISLE_SEGMENTS.find(s => s.id === avoidAisleId);
  if (!avoidSeg) return buildPickingRoute(slots);

  // Create a modified graph with penalty on edges in the
  // avoided aisle (very high weight makes A* route around it)
  const AVOIDANCE_PENALTY = 1000000;
  const modifiedEdges     = {};

  Object.entries(GLOBAL_GRAPH.edges).forEach(([nodeId, neighbours]) => {
    modifiedEdges[nodeId] = {};
    const srcNode = GLOBAL_GRAPH.nodes[nodeId];
    const srcInAisle = srcNode &&
      srcNode.x >= avoidSeg.bounds.x1 &&
      srcNode.x <= avoidSeg.bounds.x2 &&
      srcNode.y >= avoidSeg.bounds.y1 &&
      srcNode.y <= avoidSeg.bounds.y2;

    Object.entries(neighbours).forEach(([nbrId, weight]) => {
      const nbrNode = GLOBAL_GRAPH.nodes[nbrId];
      const nbrInAisle = nbrNode &&
        nbrNode.x >= avoidSeg.bounds.x1 &&
        nbrNode.x <= avoidSeg.bounds.x2 &&
        nbrNode.y >= avoidSeg.bounds.y1 &&
        nbrNode.y <= avoidSeg.bounds.y2;

      // Penalize edges that enter or are inside the avoided aisle
      modifiedEdges[nodeId][nbrId] = (srcInAisle || nbrInAisle)
        ? weight + AVOIDANCE_PENALTY
        : weight;
    });
  });

  const modifiedGraph = {
    nodes: GLOBAL_GRAPH.nodes,
    edges: modifiedEdges
  };

  // Rebuild route using modified graph
  return buildPickingRouteOnGraph(slots, modifiedGraph);
}

/**
 * Same as buildPickingRoute but uses a provided graph
 * (allows penalty injection for congestion avoidance).
 */
function buildPickingRouteOnGraph(slots, graph) {
  // Import astar with custom graph
  function astarLocal(g, start, end) {
    if (start === end) return [start];
    if (!g.nodes[start] || !g.nodes[end]) return [];
    const open = new Set([start]);
    const cameFrom = {};
    const gScore   = { [start]: 0 };
    const fScore   = {};
    const endNode  = g.nodes[end];
    function h(id) {
      const n = g.nodes[id];
      if (!n) return Infinity;
      return Math.abs(n.x-endNode.x)+Math.abs(n.y-endNode.y);
    }
    fScore[start] = h(start);
    let iters = 0;
    while (open.size > 0 && iters++ < 50000) {
      let cur=null, loF=Infinity;
      open.forEach(id=>{
        const f=fScore[id]??Infinity;
        if(f<loF){loF=f;cur=id;}
      });
      if(cur===end){
        const p=[cur];
        while(cameFrom[cur]){cur=cameFrom[cur];p.unshift(cur);}
        return p;
      }
      open.delete(cur);
      Object.entries(g.edges[cur]||{}).forEach(([nb,w])=>{
        const tg=(gScore[cur]??Infinity)+w;
        if(tg<(gScore[nb]??Infinity)){
          cameFrom[nb]=cur;
          gScore[nb]=tg;
          fScore[nb]=tg+h(nb);
          open.add(nb);
        }
      });
    }
    return [];
  }

  // Map slots using getSlotAccessNode and findNearestNonTerminalNode
  const slotAccessMap = {};
  slots.forEach(slot => {
    const node = getSlotAccessNode(
      slot.slot_id, slot.x, slot.y, graph
    );
    if (node && node !== 'DISPATCH' && node !== 'ENTRANCE') {
      slotAccessMap[slot.slot_id] = node;
    } else {
      const fallback = findNearestNonTerminalNode(slot.x, slot.y);
      slotAccessMap[slot.slot_id] = fallback;
    }
  });

  const accessNodes  = [...new Set(Object.values(slotAccessMap))];
  const allFromNodes = ['ENTRANCE', ...accessNodes];
  const distMatrix = {};
  const pathMatrix = {};

  allFromNodes.forEach(from => {
    distMatrix[from] = {};
    pathMatrix[from] = {};
    [...accessNodes, 'DISPATCH'].forEach(to => {
      if (from === to) {
        distMatrix[from][to] = 0;
        pathMatrix[from][to] = [from];
        return;
      }
      const p = astarLocal(graph, from, to);
      let d = 0;
      for (let i = 0; i < p.length - 1; i++) {
        d += graph.edges[p[i]]?.[p[i+1]] || 0;
      }
      distMatrix[from][to] = d;
      pathMatrix[from][to] = p;
    });
  });

  const unvisited = new Set(slots.map(s => s.slot_id));
  const ordered = [];
  let cur = 'ENTRANCE';

  while (unvisited.size > 0) {
    let near = null;
    let nearD = Infinity;
    unvisited.forEach(sid => {
      const an = slotAccessMap[sid];
      if (!an || an === 'DISPATCH' || an === 'ENTRANCE') return;
      const d = distMatrix[cur]?.[an] ?? Infinity;
      if (d < nearD) {
        nearD = d;
        near = sid;
      }
    });
    if (!near) break;
    ordered.push(near);
    unvisited.delete(near);
    cur = slotAccessMap[near];
  }

  const route = [];
  let cumD = 0;
  let step = 1;
  let prev = 'ENTRANCE';

  route.push({
    step: step++,
    node_id: 'ENTRANCE',
    slot_id: null,
    item_id: null,
    x: LAYOUT.ENTRANCE_X,
    y: LAYOUT.ENTRANCE_Y,
    type: 'start',
    cumulative_distance: 0,
    aisle_path: [{
      x: graph.nodes['ENTRANCE']?.x || LAYOUT.ENTRANCE_X,
      y: graph.nodes['ENTRANCE']?.y || LAYOUT.ENTRANCE_Y
    }]
  });

  ordered.forEach(sid => {
    const slot = slots.find(s => s.slot_id === sid);
    const an = slotAccessMap[sid];
    const rawP = pathMatrix[prev]?.[an] || [];
    const coords = rawP.map(id => {
      const n = graph.nodes[id];
      return n ? { x: n.x, y: n.y } : null;
    }).filter(Boolean);

    // Filter out coordinates near DISPATCH to prevent overlap
    const safeCoords = coords.filter(pt =>
      !(Math.abs(pt.x - LAYOUT.DISPATCH_X) < 50 &&
        Math.abs(pt.y - LAYOUT.DISPATCH_Y) < 50)
    );

    const d = distMatrix[prev]?.[an] || 0;
    cumD += d;
    route.push({
      step: step++,
      node_id: an,
      slot_id: sid,
      item_id: slot?.item_id || null,
      x: slot?.x || 0,
      y: slot?.y || 0,
      type: 'pickup',
      cumulative_distance: Math.round(cumD),
      aisle_path: safeCoords
    });
    prev = an;
  });

  const dispC = (pathMatrix[prev]?.['DISPATCH'] || []).map(id => {
    const n = graph.nodes[id];
    return n ? { x: n.x, y: n.y } : null;
  }).filter(Boolean);

  cumD += distMatrix[prev]?.['DISPATCH'] || 0;
  route.push({
    step: step,
    node_id: 'DISPATCH',
    slot_id: null,
    item_id: null,
    x: LAYOUT.DISPATCH_X,
    y: LAYOUT.DISPATCH_Y,
    type: 'end',
    cumulative_distance: Math.round(cumD),
    aisle_path: dispC
  });

  // Ensure last step is strictly the end (DISPATCH)
  const lastStep = route[route.length - 1];
  if (lastStep.type !== 'end') {
    console.error('DISPATCH not last in avoided route — fixing');
    const dispIdx = route.findIndex(s => s.type === 'end');
    if (dispIdx !== -1) {
      const dispStep = route.splice(dispIdx, 1)[0];
      dispStep.step = route.length + 1;
      route.push(dispStep);
    }
  }

  return {
    route,
    totalDistance: Math.round(cumD),
    totalStops: slots.length,
    fullPathPoints: route.flatMap(s => s.aisle_path || [])
  };
}

export {
  runCongestionControl,
  buildPickingRouteAvoidingAisle,
  AISLE_SEGMENTS,
  getAisleAtPosition
};
