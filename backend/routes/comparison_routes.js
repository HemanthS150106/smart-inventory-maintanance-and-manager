import express from 'express';
const router = express.Router();
import { readJSON } from '../utils/jsonStore.js';
import { GLOBAL_GRAPH, getSlotAccessNode, twoOptImprove } from '../services/route_planner.js';

// Dijkstra search algorithm (A* with h=0)
function dijkstra(graph, startId, endId) {
  if (startId === endId) return { path: [startId], steps: 1 };
  if (!graph.nodes[startId] || !graph.nodes[endId]) return { path: [], steps: 0 };

  const open = new Set([startId]);
  const cameFrom = {};
  const gScore = { [startId]: 0 };

  let steps = 0;
  const MAX_ITER = 50000;

  while (open.size > 0 && steps++ < MAX_ITER) {
    let current = null;
    let lowestG = Infinity;
    open.forEach(id => {
      const g = (gScore[id] ?? Infinity);
      if (g < lowestG) { lowestG = g; current = id; }
    });

    if (current === endId) {
      const path = [current];
      while (cameFrom[current]) {
        current = cameFrom[current];
        path.unshift(current);
      }
      return { path, steps };
    }

    open.delete(current);

    const neighbours = graph.edges[current] || {};
    Object.entries(neighbours).forEach(([neighbour, weight]) => {
      const tentativeG = (gScore[current] ?? Infinity) + weight;
      if (tentativeG < (gScore[neighbour] ?? Infinity)) {
        cameFrom[neighbour] = current;
        gScore[neighbour]   = tentativeG;
        open.add(neighbour);
      }
    });
  }

  return { path: [], steps };
}

// A* search algorithm with steps counter
function astarCompare(graph, startId, endId) {
  if (startId === endId) return { path: [startId], steps: 1 };
  if (!graph.nodes[startId] || !graph.nodes[endId]) return { path: [], steps: 0 };

  const open = new Set([startId]);
  const cameFrom = {};
  const gScore = { [startId]: 0 };
  const fScore = {};

  const endNode = graph.nodes[endId];
  function h(nodeId) {
    const n = graph.nodes[nodeId];
    if (!n) return Infinity;
    return Math.abs(n.x - endNode.x) + Math.abs(n.y - endNode.y);
  }

  fScore[startId] = h(startId);

  let steps = 0;
  const MAX_ITER = 50000;

  while (open.size > 0 && steps++ < MAX_ITER) {
    let current = null;
    let lowestF = Infinity;
    open.forEach(id => {
      const f = (fScore[id] ?? Infinity);
      if (f < lowestF) { lowestF = f; current = id; }
    });

    if (current === endId) {
      const path = [current];
      while (cameFrom[current]) {
        current = cameFrom[current];
        path.unshift(current);
      }
      return { path, steps };
    }

    open.delete(current);

    const neighbours = graph.edges[current] || {};
    Object.entries(neighbours).forEach(([neighbour, weight]) => {
      const tentativeG = (gScore[current] ?? Infinity) + weight;
      if (tentativeG < (gScore[neighbour] ?? Infinity)) {
        cameFrom[neighbour] = current;
        gScore[neighbour]   = tentativeG;
        fScore[neighbour]   = tentativeG + h(neighbour);
        open.add(neighbour);
      }
    });
  }

  return { path: [], steps };
}

// GET /api/algorithm-compare
router.get('/', (req, res) => {
  try {
    const samples = parseInt(req.query.samples) || 10;
    const registry = readJSON('slot_registry.json', { slots: {} });
    
    const allSlots = Object.entries(registry.slots || {})
      .map(([slot_id, s]) => ({ slot_id, x: s.x, y: s.y, item_id: s.item_id || 'ITEM' }));

    if (allSlots.length === 0) {
      return res.status(400).json({ error: 'No slots found in warehouse registry' });
    }

    const scenarios = [];
    let totalAstarDist = 0;
    let totalDijkstraDist = 0;
    let totalUnoptimizedDist = 0;
    let totalAstarSteps = 0;
    let totalDijkstraSteps = 0;
    let totalUnoptimizedSteps = 0;
    let total2OptDist = 0;

    for (let sIdx = 0; sIdx < samples; sIdx++) {
      // Pick random number of items between 3 and 7
      const itemCount = Math.floor(Math.random() * 5) + 3;
      const selectedSlots = [];
      const usedKeys = new Set();

      while (selectedSlots.length < itemCount && usedKeys.size < allSlots.length) {
        const randSlot = allSlots[Math.floor(Math.random() * allSlots.length)];
        if (!usedKeys.has(randSlot.slot_id)) {
          usedKeys.add(randSlot.slot_id);
          selectedSlots.push(randSlot);
        }
      }

      // Map access nodes
      const slotAccessMap = {};
      selectedSlots.forEach(slot => {
        const accessNode = getSlotAccessNode(slot.slot_id, slot.x, slot.y, GLOBAL_GRAPH);
        slotAccessMap[slot.slot_id] = accessNode || 'ENTRANCE';
      });

      const relevantNodes = [
        'ENTRANCE',
        ...Object.values(slotAccessMap),
        'DISPATCH'
      ];

      // Pre-compute A* distances & steps between all relevant nodes
      const distMatrix = {};
      const stepMatrix = {};
      relevantNodes.forEach(from => {
        distMatrix[from] = {};
        stepMatrix[from] = {};
        relevantNodes.forEach(to => {
          if (from === to) {
            distMatrix[from][to] = 0;
            stepMatrix[from][to] = 0;
            return;
          }
          const pathRes = astarCompare(GLOBAL_GRAPH, from, to);
          let dist = 0;
          for (let i = 0; i < pathRes.path.length - 1; i++) {
            dist += GLOBAL_GRAPH.edges[pathRes.path[i]]?.[pathRes.path[i+1]] || 0;
          }
          distMatrix[from][to] = dist;
          stepMatrix[from][to] = pathRes.steps;
        });
      });

      // ── RUN A* + NEAREST-NEIGHBOUR (FORECAST-OPTIMIZED) ──
      const unvisited = new Set(selectedSlots.map(s => s.slot_id));
      const orderedSlots = [];
      let current = 'ENTRANCE';

      while (unvisited.size > 0) {
        let nearest = null, nearestDist = Infinity;
        unvisited.forEach(slotId => {
          const accessNode = slotAccessMap[slotId];
          const d = distMatrix[current]?.[accessNode] ?? Infinity;
          if (d < nearestDist) {
            nearestDist = d;
            nearest     = slotId;
          }
        });
        if (!nearest) break;
        orderedSlots.push(nearest);
        unvisited.delete(nearest);
        current = slotAccessMap[nearest];
      }

      let astarDist = 0;
      let astarSteps = 0;
      let prevNode = 'ENTRANCE';

      orderedSlots.forEach(slotId => {
        const accessNode = slotAccessMap[slotId];
        astarDist += distMatrix[prevNode]?.[accessNode] || 0;
        astarSteps += stepMatrix[prevNode]?.[accessNode] || 0;
        prevNode = accessNode;
      });

      astarDist += distMatrix[prevNode]?.['DISPATCH'] || 0;
      astarSteps += stepMatrix[prevNode]?.['DISPATCH'] || 0;

      // ── RUN A* + NN + 2-OPT (IMPROVED ORDERING) ──
      const accessTourForOpt = orderedSlots.map(sid => slotAccessMap[sid]);
      const improved2OptTour = twoOptImprove(accessTourForOpt, distMatrix, 'ENTRANCE');

      // Compute 2-Opt distance
      let astar2OptDist = 0;
      let prev2Opt = 'ENTRANCE';
      improved2OptTour.forEach(accessNode => {
        astar2OptDist += distMatrix[prev2Opt]?.[accessNode] || 0;
        prev2Opt = accessNode;
      });
      astar2OptDist += distMatrix[prev2Opt]?.['DISPATCH'] || 0;

      // ── RUN A* + NEAREST-NEIGHBOUR ON UNOPTIMIZED (NON-FORECAST) SLOTS ──
      // Map same items to random alternative slots from allSlots (simulating random unoptimized layout)
      const unoptimizedSlots = selectedSlots.map(() => {
        const randSlot = allSlots[Math.floor(Math.random() * allSlots.length)];
        return randSlot;
      });

      const unoptimizedAccessMap = {};
      unoptimizedSlots.forEach(slot => {
        const accessNode = getSlotAccessNode(slot.slot_id, slot.x, slot.y, GLOBAL_GRAPH);
        unoptimizedAccessMap[slot.slot_id] = accessNode || 'ENTRANCE';
      });

      const unoptimizedNodes = [
        'ENTRANCE',
        ...Object.values(unoptimizedAccessMap),
        'DISPATCH'
      ];

      // Pre-compute A* distances & steps between all unoptimized nodes
      const unoptimizedDistMatrix = {};
      const unoptimizedStepMatrix = {};
      unoptimizedNodes.forEach(from => {
        unoptimizedDistMatrix[from] = {};
        unoptimizedStepMatrix[from] = {};
        unoptimizedNodes.forEach(to => {
          if (from === to) {
            unoptimizedDistMatrix[from][to] = 0;
            unoptimizedStepMatrix[from][to] = 0;
            return;
          }
          const pathRes = astarCompare(GLOBAL_GRAPH, from, to);
          let dist = 0;
          for (let i = 0; i < pathRes.path.length - 1; i++) {
            dist += GLOBAL_GRAPH.edges[pathRes.path[i]]?.[pathRes.path[i+1]] || 0;
          }
          unoptimizedDistMatrix[from][to] = dist;
          unoptimizedStepMatrix[from][to] = pathRes.steps;
        });
      });

      const unoptimizedUnvisited = new Set(unoptimizedSlots.map(s => s.slot_id));
      const unoptimizedOrderedSlots = [];
      let unoptimizedCurrent = 'ENTRANCE';

      while (unoptimizedUnvisited.size > 0) {
        let nearest = null, nearestDist = Infinity;
        unoptimizedUnvisited.forEach(slotId => {
          const accessNode = unoptimizedAccessMap[slotId];
          const d = unoptimizedDistMatrix[unoptimizedCurrent]?.[accessNode] ?? Infinity;
          if (d < nearestDist) {
            nearestDist = d;
            nearest     = slotId;
          }
        });
        if (!nearest) break;
        unoptimizedOrderedSlots.push(nearest);
        unoptimizedUnvisited.delete(nearest);
        unoptimizedCurrent = unoptimizedAccessMap[nearest];
      }

      let unoptimizedDist = 0;
      let unoptimizedSteps = 0;
      let prevNodeUnopt = 'ENTRANCE';

      unoptimizedOrderedSlots.forEach(slotId => {
        const accessNode = unoptimizedAccessMap[slotId];
        unoptimizedDist += unoptimizedDistMatrix[prevNodeUnopt]?.[accessNode] || 0;
        unoptimizedSteps += unoptimizedStepMatrix[prevNodeUnopt]?.[accessNode] || 0;
        prevNodeUnopt = accessNode;
      });

      unoptimizedDist += unoptimizedDistMatrix[prevNodeUnopt]?.['DISPATCH'] || 0;
      unoptimizedSteps += unoptimizedStepMatrix[prevNodeUnopt]?.['DISPATCH'] || 0;

      // ── RUN DIJKSTRA (RAW INPUT ORDER) ──
      let dijkstraDist = 0;
      let dijkstraSteps = 0;
      let prevNodeDijkstra = 'ENTRANCE';

      selectedSlots.forEach(slot => {
        const accessNode = slotAccessMap[slot.slot_id];
        const res = dijkstra(GLOBAL_GRAPH, prevNodeDijkstra, accessNode);
        let dist = 0;
        for (let i = 0; i < res.path.length - 1; i++) {
          dist += GLOBAL_GRAPH.edges[res.path[i]]?.[res.path[i+1]] || 0;
        }
        dijkstraDist += dist;
        dijkstraSteps += res.steps;
        prevNodeDijkstra = accessNode;
      });

      const resDisp = dijkstra(GLOBAL_GRAPH, prevNodeDijkstra, 'DISPATCH');
      let distDisp = 0;
      for (let i = 0; i < resDisp.path.length - 1; i++) {
        distDisp += GLOBAL_GRAPH.edges[resDisp.path[i]]?.[resDisp.path[i+1]] || 0;
      }
      dijkstraDist += distDisp;
      dijkstraSteps += resDisp.steps;

      astarDist = Math.round(astarDist);
      dijkstraDist = Math.round(dijkstraDist);
      unoptimizedDist = Math.round(unoptimizedDist);
      astar2OptDist = Math.round(astar2OptDist);

      const saved = Math.max(0, dijkstraDist - astarDist);
      const savedPct = dijkstraDist > 0 ? Math.round((saved / dijkstraDist) * 100) : 0;
      const saved2Opt = Math.max(0, astarDist - astar2OptDist);
      const saved2OptPct = astarDist > 0 ? Math.round((saved2Opt / astarDist) * 100) : 0;

      scenarios.push({
        itemCount,
        dijkstraDist,
        astarDist,
        astarNN2OptDist: astar2OptDist,
        unoptimizedDist,
        saved,
        savedPct,
        saved2Opt,
        saved2OptPct,
        dijkstraSteps,
        astarSteps,
        unoptimizedSteps
      });

      totalAstarDist += astarDist;
      totalDijkstraDist += dijkstraDist;
      totalUnoptimizedDist += unoptimizedDist;
      total2OptDist += astar2OptDist;
      totalAstarSteps += astarSteps;
      totalDijkstraSteps += dijkstraSteps;
      totalUnoptimizedSteps += unoptimizedSteps;
    }

    const avgAstarDist = Math.round(totalAstarDist / samples);
    const avgDijkstraDist = Math.round(totalDijkstraDist / samples);
    const avgUnoptimizedDist = Math.round(totalUnoptimizedDist / samples);
    const avg2OptDist = Math.round(total2OptDist / samples);

    const distanceImprovement = avgDijkstraDist > 0 ? Math.round(((avgDijkstraDist - avgAstarDist) / avgDijkstraDist) * 100) : 0;
    const timeImprovement = avgDijkstraSteps > 0 ? Math.round(((avgDijkstraSteps - avgAstarSteps) / avgDijkstraSteps) * 100) : 0;

    // Forecast Slotting Benefit: % distance saved using optimized slots compared to unoptimized slots
    const forecastSlottingImprovement = avgUnoptimizedDist > 0 ? Math.round(((avgUnoptimizedDist - avgAstarDist) / avgUnoptimizedDist) * 100) : 0;

    // 2-Opt improvement over NN-only
    const twoOptImprovement = avgAstarDist > 0 ? Math.round(((avgAstarDist - avg2OptDist) / avgAstarDist) * 100) : 0;

    res.json({
      scenarios,
      summary: {
        avgAstarDist,
        avgDijkstraDist,
        avgUnoptimizedDist,
        avg2OptDist,
        distanceImprovement,
        timeImprovement,
        forecastSlottingImprovement,
        twoOptImprovement
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
