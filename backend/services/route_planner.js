'use strict';

/**
 * AISLE-CONSTRAINED A* ROUTING
 *
 * ALGORITHM: A* on an aisle waypoint graph
 *
 * WHY AISLE GRAPH INSTEAD OF RAW COORDINATES:
 * Workers cannot walk through shelf racks. They must follow
 * physical aisles. We model this as a graph of waypoints
 * placed only in walkable areas (aisles and walking aisles
 * between rack pairs). A* finds the shortest path through
 * this graph from start to each shelf slot, respecting
 * the physical constraint that you cannot cut through racks.
 *
 * WALKING RULES IN THIS WAREHOUSE:
 * 1. Workers travel along the MAIN HORIZONTAL AISLE
 *    (y=980 to y=1080, spans full warehouse width)
 * 2. Workers travel along the CENTER VERTICAL AISLE
 *    (x=1540 to x=1660, spans full warehouse height)
 * 3. To reach a shelf, worker enters the WALKING AISLE
 *    between rack pair rows (48px gap between rack rows)
 * 4. At the END of each rack row, worker turns into
 *    the walking aisle
 * 5. Worker CANNOT cut diagonally through any zone
 * 6. Worker CANNOT walk through any rack unit
 *
 * PATH TO A SHELF SLOT:
 * START → main aisle → zone entry → walking aisle → slot row →
 * slot position → return same way
 */

// ── WAREHOUSE LAYOUT CONSTANTS ──────────────────────────────
// These match svg_generator.py exactly
const LAYOUT = {
  CANVAS_W:       3200,
  CANVAS_H:       2500,
  MAIN_AISLE_Y:   980,    // top of main horizontal aisle
  MAIN_AISLE_MID: 1030,   // center y of main aisle
  CENTER_AISLE_X: 1540,   // left edge of center vertical aisle
  CENTER_AISLE_MID: 1600, // center x of center vertical aisle
  ENTRANCE_X:    120,
  ENTRANCE_Y:    960,
  DISPATCH_X:     3080,
  DISPATCH_Y:     960,
};

/**
 * AISLE SEGMENT REGISTRY
 *
 * Each aisle segment has:
 *   id:       unique identifier
 *   type:     'main' (wide) | 'walking' (narrow)
 *   bounds:   { x1, y1, x2, y2 } — bounding box of the aisle
 *   capacity: fraction of total active carts allowed simultaneously
 *             main = 0.25 (25%), walking = 0.10 (10%)
 *   zone:     which zone this aisle serves (null for main aisles)
 *
 * A worker is "in" an aisle if their current position falls
 * within the aisle bounding box.
 */
const AISLE_SEGMENTS = [
  // ── MAIN AISLES (wide, 25% capacity) ──────────────────────
  {
    id: 'MAIN_HORIZONTAL',
    type: 'main',
    bounds: { x1: 40, y1: 980, x2: 3160, y2: 1080 },
    capacity: 0.25
  },
  {
    id: 'CENTER_VERTICAL',
    type: 'main',
    bounds: { x1: 1540, y1: 40, x2: 1660, y2: 1960 },
    capacity: 0.25
  },

  // ── WALKING AISLES (narrow, 10% capacity) ─────────────────
  // Zone A walking aisles (between rack pair rows)
  {
    id: 'ZONE_A_WALK_P1',
    type: 'walking',
    bounds: { x1: 60, y1: 340, x2: 1530, y2: 388 },
    capacity: 0.10,
    zone: 'A', pair: 1
  },
  {
    id: 'ZONE_A_WALK_P2',
    type: 'walking',
    bounds: { x1: 60, y1: 756, x2: 1530, y2: 804 },
    capacity: 0.10,
    zone: 'A', pair: 2
  },
  // Zone B walking aisles
  {
    id: 'ZONE_B_WALK_P1',
    type: 'walking',
    bounds: { x1: 1680, y1: 340, x2: 3140, y2: 388 },
    capacity: 0.10,
    zone: 'B', pair: 1
  },
  {
    id: 'ZONE_B_WALK_P2',
    type: 'walking',
    bounds: { x1: 1680, y1: 756, x2: 3140, y2: 804 },
    capacity: 0.10,
    zone: 'B', pair: 2
  },
  // Zone C walking aisles (below main aisle)
  {
    id: 'ZONE_C_WALK_P1',
    type: 'walking',
    bounds: { x1: 60, y1: 1260, x2: 1530, y2: 1308 },
    capacity: 0.10,
    zone: 'C', pair: 1
  },
  {
    id: 'ZONE_C_WALK_P2',
    type: 'walking',
    bounds: { x1: 60, y1: 1676, x2: 1530, y2: 1724 },
    capacity: 0.10,
    zone: 'C', pair: 2
  },
  // Zone D walking aisles
  {
    id: 'ZONE_D_WALK_P1',
    type: 'walking',
    bounds: { x1: 1680, y1: 1260, x2: 3140, y2: 1308 },
    capacity: 0.10,
    zone: 'D', pair: 1
  },
  {
    id: 'ZONE_D_WALK_P2',
    type: 'walking',
    bounds: { x1: 1680, y1: 1676, x2: 3140, y2: 1724 },
    capacity: 0.10,
    zone: 'D', pair: 2
  }
];

/**
 * Check which aisle segment a position (x,y) is currently in.
 * Returns null if not in any registered aisle.
 */
function getAisleAtPosition(x, y) {
  return AISLE_SEGMENTS.find(seg =>
    x >= seg.bounds.x1 && x <= seg.bounds.x2 &&
    y >= seg.bounds.y1 && y <= seg.bounds.y2
  ) || null;
}

/**
 * Check which aisle segments a route path passes through.
 * Returns array of aisle segment IDs in order of traversal.
 */
function getAislesOnRoute(routePathPoints) {
  const visited    = new Set();
  const aisleOrder = [];
  (routePathPoints || []).forEach(pt => {
    const seg = getAisleAtPosition(pt.x, pt.y);
    if (seg && !visited.has(seg.id)) {
      visited.add(seg.id);
      aisleOrder.push(seg.id);
    }
  });
  return aisleOrder;
}


// Zone boundaries — read from svg_generator.py
const ZONE_BOUNDS = {
  A: { x1: 60,   y1: 190, x2: 1520, y2: 970  },
  B: { x1: 1680, y1: 190, x2: 3140, y2: 970  },
  C: { x1: 60,   y1: 1090,x2: 1520, y2: 1960 },
  D: { x1: 1680, y1: 1090,x2: 3140, y2: 1960 },
};

// Walking aisle y-positions within each zone
// These are the CENTER y-coordinates of the 48px walking aisles
// between rack pair rows. Must match actual rack placement y coords.
// Format: zone → array of walking aisle center y values
// CALCULATE from svg_generator.py rack placement:
const WALKING_AISLE_Y = {
  A: [364, 780],
  B: [364, 780],
  C: [1284, 1700],
  D: [1284, 1700],
};

// Zone entry x-positions (left edge of each zone accessible from aisle)
const ZONE_ENTRY_X = {
  A: { left: 80,   right: 1520 },
  B: { left: 1680, right: 3140 },
  C: { left: 80,   right: 1520 },
  D: { left: 1680, right: 3140 },
};

/**
 * Build the full aisle waypoint graph.
 * Nodes are placed ONLY in walkable areas.
 * Edges connect adjacent walkable nodes.
 */
function buildAisleGraph() {
  const nodes = {};
  const edges = {}; // adjacency list: nodeId → {neighbourId: distance}

  function addNode(id, x, y) {
    nodes[id] = { id, x, y };
    edges[id] = edges[id] || {};
  }

  function addEdge(a, b) {
    if (!nodes[a] || !nodes[b]) return;
    const dx   = nodes[a].x - nodes[b].x;
    const dy   = nodes[a].y - nodes[b].y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    edges[a][b] = dist;
    edges[b][a] = dist;
  }

  // ── MAIN HORIZONTAL AISLE NODES ──────────────────────────
  // Place nodes every 100px along the main aisle centerline
  const mainY = LAYOUT.MAIN_AISLE_MID;
  const mainNodes = [];
  for (let x = 100; x <= 3100; x += 100) {
    const id = `MAIN_${x}`;
    addNode(id, x, mainY);
    mainNodes.push(id);
  }
  // Connect main aisle nodes in sequence
  for (let i = 0; i < mainNodes.length - 1; i++) {
    addEdge(mainNodes[i], mainNodes[i+1]);
  }

  // ── CENTER VERTICAL AISLE NODES ──────────────────────────
  const centerX = LAYOUT.CENTER_AISLE_MID;
  const centerNodes = [];
  for (let y = 200; y <= 1900; y += 80) {
    const id = `CENTER_${y}`;
    addNode(id, centerX, y);
    centerNodes.push(id);
  }
  for (let i = 0; i < centerNodes.length - 1; i++) {
    addEdge(centerNodes[i], centerNodes[i+1]);
  }

  // ── LEFT VERTICAL AISLE NODES ────────────────────────────
  const leftX = 40;
  const leftNodes = [];
  for (let y = 200; y <= 1900; y += 80) {
    const id = `LEFT_${y}`;
    addNode(id, leftX, y);
    leftNodes.push(id);
  }
  for (let i = 0; i < leftNodes.length - 1; i++) {
    addEdge(leftNodes[i], leftNodes[i+1]);
  }

  // ── RIGHT VERTICAL AISLE NODES ───────────────────────────
  const rightX = 3160;
  const rightNodes = [];
  for (let y = 200; y <= 1900; y += 80) {
    const id = `RIGHT_${y}`;
    addNode(id, rightX, y);
    rightNodes.push(id);
  }
  for (let i = 0; i < rightNodes.length - 1; i++) {
    addEdge(rightNodes[i], rightNodes[i+1]);
  }
  // Connect center aisle to main aisle at intersection
  const centerMainIntersect = `MAIN_${LAYOUT.CENTER_AISLE_MID}`;
  
  // Find the closest CENTER node to mainY
  const nearestCenterToMain = findNearestNode(centerNodes, nodes, LAYOUT.CENTER_AISLE_MID, mainY);
  
  if (nodes[centerMainIntersect] && nearestCenterToMain) {
    addEdge(centerMainIntersect, nearestCenterToMain);
  }

  // Connect left aisle to main aisle
  const leftMainIntersect = `MAIN_100`; // x=100 is closest
  const nearestLeftToMain = findNearestNode(leftNodes, nodes, leftX, mainY);
  if (nodes[leftMainIntersect] && nearestLeftToMain) {
    addEdge(leftMainIntersect, nearestLeftToMain);
  }

  // Connect right aisle to main aisle
  const rightMainIntersect = `MAIN_3100`; // x=3100 is closest
  const nearestRightToMain = findNearestNode(rightNodes, nodes, rightX, mainY);
  if (nodes[rightMainIntersect] && nearestRightToMain) {
    addEdge(rightMainIntersect, nearestRightToMain);
  }

  // ── ZONE WALKING AISLE NODES ─────────────────────────────
  // For each zone, for each walking aisle row, place nodes
  // horizontally along the walking aisle

  ['A', 'B', 'C', 'D'].forEach(zone => {
    const bounds    = ZONE_BOUNDS[zone];
    const aisleYs   = WALKING_AISLE_Y[zone];
    const entryX    = ZONE_ENTRY_X[zone];

    aisleYs.forEach((wy, pairIdx) => {
      const aisleNodes = [];

      // Place walking aisle nodes from zone left to right
      const step = 80;
      for (let x = bounds.x1 + 20;
               x <= bounds.x2 - 20;
               x += step) {
        const id = `W_${zone}_P${pairIdx+1}_${Math.round(x)}`;
        addNode(id, x, wy);
        aisleNodes.push(id);
      }

      // Connect walking aisle nodes in sequence
      for (let i = 0; i < aisleNodes.length - 1; i++) {
        addEdge(aisleNodes[i], aisleNodes[i+1]);
      }

      // Left end connects to Left Vertical Aisle for Zones A and C. Connects to Center Aisle for Zones B and D.
      // Right end connects to Center Aisle for Zones A and C. Connects to Right Vertical Aisle for Zones B and D.
      const leftEnd  = aisleNodes[0];
      const rightEnd = aisleNodes[aisleNodes.length - 1];

      if (zone === 'B' || zone === 'D') {
        // Connect LEFT end to center aisle
        if (leftEnd) {
          const entryId = `ENTRY_${zone}_P${pairIdx+1}_L`;
          addNode(entryId, entryX.left, wy);
          addEdge(leftEnd, entryId);

          const nearestCenter = findNearestNode(
            centerNodes, nodes, entryX.left, wy
          );
          if (nearestCenter) addEdge(entryId, nearestCenter);
        }
        // Connect RIGHT end to right vertical aisle
        if (rightEnd) {
          const entryId = `ENTRY_${zone}_P${pairIdx+1}_R`;
          addNode(entryId, entryX.right, wy);
          addEdge(rightEnd, entryId);

          const nearestRight = findNearestNode(
            rightNodes, nodes, entryX.right, wy
          );
          if (nearestRight) addEdge(entryId, nearestRight);
        }
      } else if (zone === 'A' || zone === 'C') {
        // Connect RIGHT end to center aisle
        if (rightEnd) {
          const entryId = `ENTRY_${zone}_P${pairIdx+1}_R`;
          addNode(entryId, entryX.right, wy);
          addEdge(rightEnd, entryId);

          const nearestCenter = findNearestNode(
            centerNodes, nodes, entryX.right, wy
          );
          if (nearestCenter) addEdge(entryId, nearestCenter);
        }
        // Connect LEFT end to left vertical aisle
        if (leftEnd) {
          const entryId = `ENTRY_${zone}_P${pairIdx+1}_L`;
          addNode(entryId, entryX.left, wy);
          addEdge(leftEnd, entryId);

          const nearestLeft = findNearestNode(
            leftNodes, nodes, entryX.left, wy
          );
          if (nearestLeft) addEdge(entryId, nearestLeft);
        }
      }
    });
  });

  // ── ENTRANCE AND DISPATCH DOCK NODES ────────────────────
  addNode('ENTRANCE', LAYOUT.ENTRANCE_X, LAYOUT.ENTRANCE_Y);
  addNode('DISPATCH',  LAYOUT.DISPATCH_X,  LAYOUT.DISPATCH_Y);

  // Connect docks to nearest main aisle node
  const recvMain = findNearestNode(mainNodes, nodes,
    LAYOUT.ENTRANCE_X, mainY);
  const dispMain = findNearestNode(mainNodes, nodes,
    LAYOUT.DISPATCH_X, mainY);
  if (recvMain) addEdge('ENTRANCE', recvMain);
  if (dispMain) addEdge('DISPATCH',  dispMain);

  return { nodes, edges };
}

function findNearestNode(nodeIds, nodes, x, y) {
  let best = null, bestDist = Infinity;
  nodeIds.forEach(id => {
    if (!nodes[id]) return;
    const dx = nodes[id].x - x;
    const dy = nodes[id].y - y;
    const d  = Math.sqrt(dx*dx + dy*dy);
    if (d < bestDist) { bestDist = d; best = id; }
  });
  return best;
}

/**
 * Get the nearest WALKABLE aisle node to a slot position.
 * A slot is accessed from the walking aisle of its rack pair.
 * The worker walks to the end of the rack row in the walking
 * aisle, NOT directly to the slot x,y coordinate.
 */
function getSlotAccessNode(slotId, slotX, slotY, graph) {
  const zone = slotId.charAt(0);
  const aisleYs = WALKING_AISLE_Y[zone] || [];

  // Find the walking aisle closest to this slot's y position
  let bestAisleY   = null;
  let bestAisleDist = Infinity;
  aisleYs.forEach(wy => {
    const d = Math.abs(slotY - wy);
    if (d < bestAisleDist) { bestAisleDist = d; bestAisleY = wy; }
  });

  if (bestAisleY === null) return null;

  // Find the walking aisle node closest in x to this slot
  const nodeIds  = Object.keys(graph.nodes);
  const matching = nodeIds.filter(id => {
    const n = graph.nodes[id];
    return Math.abs(n.y - bestAisleY) < 5 &&
           n.id.includes(`_${zone}_`);
  });

  // Among matching nodes, find closest x to slotX
  let best = null, bestDist = Infinity;
  matching.forEach(id => {
    const d = Math.abs(graph.nodes[id].x - slotX);
    if (d < bestDist) { bestDist = d; best = id; }
  });

  return best;
}

/**
 * A* pathfinding on the aisle graph.
 * Returns array of node IDs representing the path.
 */
function astar(graph, startId, endId, avoidAisle = null) {
  if (startId === endId) return [startId];
  if (!graph.nodes[startId] || !graph.nodes[endId]) return [];

  const open   = new Set([startId]);
  const cameFrom = {};
  const gScore = { [startId]: 0 };
  const fScore = {};

  const endNode = graph.nodes[endId];

  function h(nodeId) {
    const n = graph.nodes[nodeId];
    if (!n) return Infinity;
    // Manhattan heuristic (admissible for grid-like aisle graph)
    return Math.abs(n.x - endNode.x) + Math.abs(n.y - endNode.y);
  }

  fScore[startId] = h(startId);

  let iterations = 0;
  const MAX_ITER = 50000;

  while (open.size > 0 && iterations++ < MAX_ITER) {
    // Get node with lowest fScore
    let current = null;
    let lowestF = Infinity;
    open.forEach(id => {
      const f = (fScore[id] ?? Infinity);
      if (f < lowestF) { lowestF = f; current = id; }
    });

    if (current === endId) {
      // Reconstruct path
      const path = [current];
      while (cameFrom[current]) {
        current = cameFrom[current];
        path.unshift(current);
      }
      return path;
    }

    open.delete(current);

    const neighbours = graph.edges[current] || {};
    Object.entries(neighbours).forEach(([neighbour, weight]) => {
      let edgeWeight = weight;
      // Prevent routing THROUGH terminal nodes
      if ((neighbour === 'ENTRANCE' || neighbour === 'DISPATCH') && neighbour !== endId) {
        return; // equivalent to continue in forEach loop
      }

      // Add a high penalty if we should avoid this aisle and either node is in it
      if (avoidAisle && (current.startsWith(avoidAisle) || neighbour.startsWith(avoidAisle))) {
        edgeWeight += 100000;
      }

      const tentativeG = (gScore[current] ?? Infinity) + edgeWeight;
      if (tentativeG < (gScore[neighbour] ?? Infinity)) {
        cameFrom[neighbour] = current;
        gScore[neighbour]   = tentativeG;
        fScore[neighbour]   = tentativeG + h(neighbour);
        open.add(neighbour);
      }
    });
  }

  return []; // no path found
}

/**
 * Build complete picking route through aisle graph.
 * All paths stay within walkable aisles.
 */
const GLOBAL_GRAPH = buildAisleGraph();

/**
 * 2-OPT LOCAL SEARCH — TSP IMPROVEMENT
 *
 * WHY: Nearest-Neighbour greedy ordering often creates crossing
 * paths (geometric "X" shapes). 2-Opt iteratively tests reversing
 * sub-segments of the route to un-cross them.
 *
 * GIVEN tour [s0, s1, s2, ..., sN]:
 * For each pair (i,j), check if reversing segment [si..sj] reduces
 * total distance:
 *   if dist(si-1, sj) + dist(si, sj+1) < dist(si-1, si) + dist(sj, sj+1)
 *   → reverse the segment, accept improvement
 *
 * COMPLEXITY: O(N²) per pass, max MAX_PASSES passes
 * For N ≤ 20 stops: completes in < 1ms
 *
 * @param {string[]} tour - Array of access node IDs in current order
 * @param {Object} distMatrix - Pairwise A* distances {from: {to: dist}}
 * @param {string} startNode - The starting node (ENTRANCE or START_TEMP)
 * @returns {string[]} Improved tour order
 */
function twoOptImprove(tour, distMatrix, startNode) {
  if (!tour || tour.length <= 2) return tour;

  const MAX_PASSES = 50;
  let improved = true;
  let pass     = 0;
  let best     = [...tour];

  while (improved && pass < MAX_PASSES) {
    improved = false;
    pass++;

    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        // Current edges: (prev_i → i) and (j → next_j)
        const prevI  = i === 0 ? startNode : best[i - 1];
        const nextJ  = j === best.length - 1 ? 'ENTRANCE' : best[j + 1];

        const curCost = (distMatrix[prevI]?.[best[i]]  ?? Infinity) +
                        (distMatrix[best[j]]?.[nextJ]  ?? Infinity);

        const newCost = (distMatrix[prevI]?.[best[j]]  ?? Infinity) +
                        (distMatrix[best[i]]?.[nextJ]  ?? Infinity);

        if (newCost < curCost - 0.01) {
          // Reverse segment [i..j]
          const newTour = [
            ...best.slice(0, i),
            ...best.slice(i, j + 1).reverse(),
            ...best.slice(j + 1)
          ];
          best     = newTour;
          improved = true;
        }
      }
    }
  }

  console.log(`2-Opt: ${pass} passes, tour length ${best.length}`);
  return best;
}

function buildPickingRoute(slots) {
  if (!slots || slots.length === 0) {
    return { route: [], totalDistance: 0, totalStops: 0,
             fullPathPoints: [] };
  }

  // ── STEP 1: Map each slot to its nearest aisle access node ─
  // Access node = the graph node in the walking aisle closest
  // to this slot's x-coordinate
  const slotAccessMap = {};
  slots.forEach(slot => {
    const node = getSlotAccessNode(
      slot.slot_id, slot.x, slot.y, GLOBAL_GRAPH
    );
    // Guard: never map to terminal nodes
    if (node && node !== 'DISPATCH' && node !== 'ENTRANCE') {
      slotAccessMap[slot.slot_id] = node;
    } else {
      slotAccessMap[slot.slot_id] = findNearestNonTerminalNode(
        slot.x, slot.y
      );
    }
  });

  // ── STEP 2: Pre-compute A* pairwise distances ───────────────
  // Nodes we need distances between:
  //   ENTRANCE → [all access nodes] → DISPATCH
  // DISPATCH excluded from intermediate node set
  const accessNodes  = [...new Set(Object.values(slotAccessMap))];
  const fromNodes    = ['DISPATCH', ...accessNodes];

  const distMatrix   = {};
  const pathMatrix   = {};

  fromNodes.forEach(from => {
    distMatrix[from] = distMatrix[from] || {};
    pathMatrix[from] = pathMatrix[from] || {};

    [...accessNodes, 'ENTRANCE'].forEach(to => {
      if (from === to) {
        distMatrix[from][to] = 0;
        pathMatrix[from][to] = [from];
        return;
      }
      const path = astar(GLOBAL_GRAPH, from, to);
      let dist   = 0;
      for (let i = 0; i < path.length - 1; i++) {
        dist += GLOBAL_GRAPH.edges[path[i]]?.[path[i+1]] || 0;
      }
      distMatrix[from][to] = dist;
      pathMatrix[from][to] = path;
    });
  });

  // ── STEP 3: Nearest-Neighbour initial tour ──────────────────
  // CRITICAL: DISPATCH is NEVER a candidate in this loop
  const slotIds   = slots.map(s => s.slot_id);
  const unvisited = new Set(slotIds);
  const nnTour    = [];  // ordered list of slot_ids
  let   current   = 'DISPATCH';

  while (unvisited.size > 0) {
    let nearest = null, nearestDist = Infinity;

    unvisited.forEach(slotId => {
      const accessNode = slotAccessMap[slotId];
      if (!accessNode ||
          accessNode === 'DISPATCH' ||
          accessNode === 'ENTRANCE') return;

      const d = distMatrix[current]?.[accessNode] ?? Infinity;
      if (d < nearestDist) {
        nearestDist = d;
        nearest     = slotId;
      }
    });

    if (!nearest) break;
    nnTour.push(nearest);
    unvisited.delete(nearest);
    current = slotAccessMap[nearest];
  }

  // ── STEP 4: 2-Opt improvement on the NN tour ───────────────
  // Build access-node tour for 2-Opt distance lookups
  const accessTour = nnTour.map(sid => slotAccessMap[sid]);

  // Run 2-Opt on access nodes
  const improvedAccessTour = twoOptImprove(
    accessTour,
    distMatrix,
    'DISPATCH'
  );

  // Map back to slot_ids maintaining 2-Opt order
  // Build reverse map: accessNode → slotId (handle duplicates)
  const accessToSlot = {};
  nnTour.forEach(sid => {
    const an = slotAccessMap[sid];
    if (!accessToSlot[an]) accessToSlot[an] = [];
    accessToSlot[an].push(sid);
  });

  // Used to handle case where multiple slots map to same access node
  const usedSlots = new Set();
  const orderedSlots = [];

  improvedAccessTour.forEach(an => {
    const candidates = accessToSlot[an] || [];
    const available  = candidates.find(sid => !usedSlots.has(sid));
    if (available) {
      orderedSlots.push(available);
      usedSlots.add(available);
    }
  });

  // Add any slots that 2-opt may have dropped (safety net)
  nnTour.forEach(sid => {
    if (!usedSlots.has(sid)) orderedSlots.push(sid);
  });

  // ── STEP 5: Build enriched route with aisle coordinates ─────
  const enrichedRoute = [];
  let   cumDist       = 0;
  let   stepNum       = 1;
  let   prevNode      = 'DISPATCH';

  // START: Entry gate (DISPATCH side) — exactly one start node
  const startNode = GLOBAL_GRAPH.nodes['DISPATCH'];
  enrichedRoute.push({
    step:     stepNum++,
    node_id:  'DISPATCH',
    slot_id:  null, item_id: null,
    x:        startNode?.x || LAYOUT.DISPATCH_X,
    y:        startNode?.y || LAYOUT.DISPATCH_Y,
    type:     'start',
    cumulative_distance: 0,
    aisle_path: [{
      x: startNode?.x || LAYOUT.DISPATCH_X,
      y: startNode?.y || LAYOUT.DISPATCH_Y
    }]
  });

  // PICKUP stops in 2-Opt optimised order
  orderedSlots.forEach(slotId => {
    const slot       = slots.find(s => s.slot_id === slotId);
    const accessNode = slotAccessMap[slotId];

    const rawPath    = pathMatrix[prevNode]?.[accessNode] || [];
    const pathCoords = rawPath.map(nodeId => {
      const n = GLOBAL_GRAPH.nodes[nodeId];
      return n ? { x: n.x, y: n.y } : null;
    }).filter(Boolean);

    const d = distMatrix[prevNode]?.[accessNode] || 0;
    cumDist += d;

    enrichedRoute.push({
      step:     stepNum++,
      node_id:  accessNode,
      slot_id:  slotId,
      item_id:  slot?.item_id || null,
      x:        slot?.x || 0,
      y:        slot?.y || 0,
      type:     'pickup',
      cumulative_distance: Math.round(cumDist),
      aisle_path: pathCoords
    });

    prevNode = accessNode;
  });

  // ── STEP 6: ENTRANCE (exit gate) — always and only the final stop ─
  const exitPath   = pathMatrix[prevNode]?.['ENTRANCE'] || [];
  const exitCoords = exitPath.map(nodeId => {
    const n = GLOBAL_GRAPH.nodes[nodeId];
    return n ? { x: n.x, y: n.y } : null;
  }).filter(Boolean);

  cumDist += distMatrix[prevNode]?.['ENTRANCE'] || 0;

  enrichedRoute.push({
    step:     stepNum,        // always highest step number
    node_id:  'ENTRANCE',
    slot_id:  null, item_id: null,
    x:        LAYOUT.ENTRANCE_X,
    y:        LAYOUT.ENTRANCE_Y,
    type:     'end',          // only one end node, always last
    cumulative_distance: Math.round(cumDist),
    aisle_path: exitCoords
  });

  return {
    route:          enrichedRoute,
    totalDistance:  Math.round(cumDist),
    totalStops:     slots.length,
    fullPathPoints: enrichedRoute.flatMap(s => s.aisle_path || [])
  };
}

// Helper: find nearest graph node that is not DISPATCH or ENTRANCE
function findNearestNonTerminalNode(x, y) {
  let best = null, bestDist = Infinity;
  Object.entries(GLOBAL_GRAPH.nodes).forEach(([id, node]) => {
    if (id === 'DISPATCH' || id === 'ENTRANCE') return;
    const d = Math.sqrt(
      Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2)
    );
    if (d < bestDist) { bestDist = d; best = id; }
  });
  return best;
}

/**
 * BUILD PICKING ROUTE FROM ARBITRARY WORKER POSITION
 *
 * Used when a worker is mid-task and needs rerouting due to
 * congestion. Instead of starting from ENTRANCE, the route
 * begins at the worker's current x,y coordinates.
 *
 * Approach: Creates a temporary synthetic node 'START_TEMP'
 * at the worker's current position, connects it to nearby
 * graph nodes, runs the full A* + 2-Opt pipeline from there.
 *
 * @param {Array}  remainingSlots - Slots not yet visited
 * @param {number} currentX       - Worker's current x position
 * @param {number} currentY       - Worker's current y position
 * @returns {Object}              - Same format as buildPickingRoute
 */
function buildPickingRouteFromStart(remainingSlots, currentX, currentY) {
  if (!remainingSlots || remainingSlots.length === 0) {
    // No remaining slots — just route to DISPATCH from current pos
    return buildDirectToEntrance(currentX, currentY);
  }

  // ── CREATE SYNTHETIC START NODE ─────────────────────────────
  const START_TEMP = 'START_TEMP';

  // Shallow copy graph to avoid mutating the global graph
  const tempNodes = { ...GLOBAL_GRAPH.nodes };
  const tempEdges = {};
  Object.entries(GLOBAL_GRAPH.edges).forEach(([k, v]) => {
    tempEdges[k] = { ...v };
  });

  // Add START_TEMP node at worker's current position
  tempNodes[START_TEMP] = { id: START_TEMP, x: currentX, y: currentY };
  tempEdges[START_TEMP] = {};

  // Connect START_TEMP to its N nearest neighbours in the graph
  // Only connect to non-terminal nodes
  const CONNECT_N   = 5;
  const CONNECT_MAX = 500; // max distance to connect (SVG units)

  const distances = Object.entries(tempNodes)
    .filter(([id]) => id !== START_TEMP &&
                      id !== 'DISPATCH' &&
                      id !== 'ENTRANCE')
    .map(([id, n]) => ({
      id,
      dist: Math.sqrt(
        Math.pow(n.x - currentX, 2) + Math.pow(n.y - currentY, 2)
      )
    }))
    .filter(d => d.dist <= CONNECT_MAX)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, CONNECT_N);

  distances.forEach(({ id, dist }) => {
    tempEdges[START_TEMP][id] = dist;
    if (!tempEdges[id]) tempEdges[id] = {};
    tempEdges[id][START_TEMP] = dist;
  });

  if (distances.length === 0) {
    // Worker is stranded far from any aisle node
    // Fall back to standard route from ENTRANCE
    console.warn(
      'START_TEMP has no nearby nodes — falling back to ENTRANCE'
    );
    return buildPickingRoute(remainingSlots);
  }

  const tempGraph = { nodes: tempNodes, edges: tempEdges };

  // ── A* ON TEMP GRAPH ────────────────────────────────────────
  function astarTemp(start, end) {
    if (start === end) return [start];
    if (!tempGraph.nodes[start] || !tempGraph.nodes[end]) return [];

    const open     = new Set([start]);
    const cameFrom = {};
    const gScore   = { [start]: 0 };
    const fScore   = {};
    const endNode  = tempGraph.nodes[end];

    function h(id) {
      const n = tempGraph.nodes[id];
      if (!n) return Infinity;
      return Math.abs(n.x - endNode.x) + Math.abs(n.y - endNode.y);
    }

    fScore[start] = h(start);
    let iters = 0;

    while (open.size > 0 && iters++ < 50000) {
      let cur = null, loF = Infinity;
      open.forEach(id => {
        const f = fScore[id] ?? Infinity;
        if (f < loF) { loF = f; cur = id; }
      });

      if (cur === end) {
        const path = [cur];
        while (cameFrom[cur]) { cur = cameFrom[cur]; path.unshift(cur); }
        return path;
      }

      open.delete(cur);
      Object.entries(tempGraph.edges[cur] || {}).forEach(([nb, w]) => {
        // Prevent routing THROUGH terminal nodes
        if ((nb === 'ENTRANCE' || nb === 'DISPATCH') && nb !== end) {
          return;
        }

        const tg = (gScore[cur] ?? Infinity) + w;
        if (tg < (gScore[nb] ?? Infinity)) {
          cameFrom[nb] = cur;
          gScore[nb]   = tg;
          fScore[nb]   = tg + h(nb);
          open.add(nb);
        }
      });
    }
    return [];
  }

  // ── SLOT ACCESS MAPPING ─────────────────────────────────────
  const slotAccessMap = {};
  remainingSlots.forEach(slot => {
    const node = getSlotAccessNode(
      slot.slot_id, slot.x, slot.y, GLOBAL_GRAPH
    );
    slotAccessMap[slot.slot_id] = (node && node !== 'DISPATCH' &&
      node !== 'ENTRANCE') ? node
      : findNearestNonTerminalNode(slot.x, slot.y);
  });

  // ── DISTANCE MATRIX USING TEMP GRAPH ────────────────────────
  const accessNodes = [...new Set(Object.values(slotAccessMap))];
  const fromNodes   = [START_TEMP, ...accessNodes];
  const distMatrix  = {};
  const pathMatrix  = {};

  fromNodes.forEach(from => {
    distMatrix[from] = {};
    pathMatrix[from] = {};
    [...accessNodes, 'ENTRANCE'].forEach(to => {
      if (from === to) {
        distMatrix[from][to] = 0;
        pathMatrix[from][to] = [from];
        return;
      }
      const path = astarTemp(from, to);
      let dist   = 0;
      for (let i = 0; i < path.length - 1; i++) {
        dist += tempGraph.edges[path[i]]?.[path[i+1]] || 0;
      }
      distMatrix[from][to] = dist;
      pathMatrix[from][to] = path;
    });
  });

  // ── NEAREST-NEIGHBOUR + 2-OPT ───────────────────────────────
  const unvisited = new Set(remainingSlots.map(s => s.slot_id));
  const nnTour    = [];
  let   current   = START_TEMP;

  while (unvisited.size > 0) {
    let nearest = null, nearestDist = Infinity;
    unvisited.forEach(sid => {
      const an = slotAccessMap[sid];
      if (!an || an === 'DISPATCH' || an === 'ENTRANCE') return;
      const d = distMatrix[current]?.[an] ?? Infinity;
      if (d < nearestDist) { nearestDist = d; nearest = sid; }
    });
    if (!nearest) break;
    nnTour.push(nearest);
    unvisited.delete(nearest);
    current = slotAccessMap[nearest];
  }

  const accessTour         = nnTour.map(sid => slotAccessMap[sid]);
  const improvedAccessTour = twoOptImprove(
    accessTour, distMatrix, START_TEMP
  );

  // Map improved access tour back to slot IDs
  const accessToSlot = {};
  nnTour.forEach(sid => {
    const an = slotAccessMap[sid];
    if (!accessToSlot[an]) accessToSlot[an] = [];
    accessToSlot[an].push(sid);
  });
  const usedSlots    = new Set();
  const orderedSlots = [];
  improvedAccessTour.forEach(an => {
    const av = (accessToSlot[an] || []).find(s => !usedSlots.has(s));
    if (av) { orderedSlots.push(av); usedSlots.add(av); }
  });
  nnTour.forEach(sid => {
    if (!usedSlots.has(sid)) orderedSlots.push(sid);
  });

  // ── BUILD ENRICHED ROUTE ────────────────────────────────────
  const enrichedRoute = [];
  let   cumDist       = 0;
  let   stepNum       = 1;
  let   prevNode      = START_TEMP;

  // START at current worker position
  enrichedRoute.push({
    step:    stepNum++,
    node_id: START_TEMP,
    slot_id: null, item_id: null,
    x:       currentX, y: currentY,
    type:    'start',
    cumulative_distance: 0,
    aisle_path: [{ x: currentX, y: currentY }]
  });

  // PICKUP stops
  orderedSlots.forEach(slotId => {
    const slot       = remainingSlots.find(s => s.slot_id === slotId);
    const accessNode = slotAccessMap[slotId];
    const rawPath    = pathMatrix[prevNode]?.[accessNode] || [];
    const pathCoords = rawPath.map(id => {
      const n = tempGraph.nodes[id];
      return n ? { x: n.x, y: n.y } : null;
    }).filter(Boolean);

    cumDist += distMatrix[prevNode]?.[accessNode] || 0;

    enrichedRoute.push({
      step:     stepNum++,
      node_id:  accessNode,
      slot_id:  slotId,
      item_id:  slot?.item_id || null,
      x:        slot?.x || 0, y: slot?.y || 0,
      type:     'pickup',
      cumulative_distance: Math.round(cumDist),
      aisle_path: pathCoords
    });

    prevNode = accessNode;
  });

  // ENTRANCE (exit gate) — always final
  const exitPath   = pathMatrix[prevNode]?.['ENTRANCE'] || [];
  const exitCoords = exitPath.map(id => {
    const n = tempGraph.nodes[id];
    return n ? { x: n.x, y: n.y } : null;
  }).filter(Boolean);

  cumDist += distMatrix[prevNode]?.['ENTRANCE'] || 0;

  enrichedRoute.push({
    step:    stepNum,
    node_id: 'ENTRANCE',
    slot_id: null, item_id: null,
    type:    'end',
    x:       LAYOUT.ENTRANCE_X, y: LAYOUT.ENTRANCE_Y,
    cumulative_distance: Math.round(cumDist),
    aisle_path: exitCoords
  });

  return {
    route:          enrichedRoute,
    totalDistance:  Math.round(cumDist),
    totalStops:     remainingSlots.length,
    fullPathPoints: enrichedRoute.flatMap(s => s.aisle_path || [])
  };
}

// Helper: route directly to ENTRANCE (exit gate) from current position
function buildDirectToEntrance(currentX, currentY) {
  return {
    route: [
      { step: 1, node_id: 'START_TEMP', type: 'start',
        slot_id: null, item_id: null,
        x: currentX, y: currentY,
        cumulative_distance: 0,
        aisle_path: [{ x: currentX, y: currentY }] },
      { step: 2, node_id: 'ENTRANCE', type: 'end',
        slot_id: null, item_id: null,
        x: LAYOUT.ENTRANCE_X, y: LAYOUT.ENTRANCE_Y,
        cumulative_distance: 0, aisle_path: [] }
    ],
    totalDistance: 0, totalStops: 0, fullPathPoints: []
  };
}

/**
 * Validates that a route has correct structure:
 *   - Exactly 1 start node (first step)
 *   - Exactly 1 end node (last step)
 *   - End node is DISPATCH (or START_TEMP for dynamic routes)
 *   - All pickup steps have slot_id
 * @returns {boolean}
 */
function validateRoute(route, taskId) {
  if (!route || route.length === 0) {
    console.error(`${taskId || 'route'}: Empty route`);
    return false;
  }

  const starts = route.filter(s => s.type === 'start');
  const ends   = route.filter(s => s.type === 'end');
  const last   = route[route.length - 1];
  const first  = route[0];

  if (starts.length !== 1) {
    console.error(`${taskId}: ${starts.length} start nodes — must be 1`);
    return false;
  }
  if (ends.length !== 1) {
    console.error(`${taskId}: ${ends.length} end nodes — must be 1`);
    return false;
  }
  if (first.type !== 'start') {
    console.error(`${taskId}: First step is '${first.type}' not 'start'`);
    return false;
  }
  if (last.type !== 'end') {
    console.error(`${taskId}: Last step is '${last.type}' not 'end'`);
    return false;
  }
  if (last.node_id !== 'ENTRANCE' && last.node_id !== 'DISPATCH' && last.node_id !== 'START_TEMP') {
    console.warn(`${taskId}: End node is '${last.node_id}' not 'ENTRANCE'`);
  }

  const pickups = route.filter(s => s.type === 'pickup');
  const badPickups = pickups.filter(s => !s.slot_id);
  if (badPickups.length > 0) {
    console.error(`${taskId}: ${badPickups.length} pickups missing slot_id`);
    return false;
  }

  console.log(
    `✅ ${taskId || 'route'}: Valid`,
    `(${route.length} steps, ${pickups.length} pickups,`,
    `ends at ${last.node_id})`
  );
  return true;
}

export {
  buildPickingRoute,
  buildPickingRouteFromStart,
  buildDirectToEntrance,
  twoOptImprove,
  findNearestNonTerminalNode,
  GLOBAL_GRAPH,
  LAYOUT,
  AISLE_SEGMENTS,
  getAisleAtPosition,
  getAislesOnRoute,
  getSlotAccessNode,
  findNearestNode,
  astar,
  validateRoute
};

