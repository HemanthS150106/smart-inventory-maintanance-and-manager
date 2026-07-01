/**
 * ROUTE PLANNER — Dijkstra + Nearest Neighbour
 *
 * How it works:
 * 1. Build a graph of the warehouse floor.
 *    Nodes = shelf slot positions + aisle waypoints.
 *    Edges = direct walking paths. Cross-zone edges have a
 *    high penalty to model the cost of crossing an aisle.
 *
 * 2. Run Dijkstra's from each slot to every other slot to get
 *    a pairwise distance matrix.
 *
 * 3. Use nearest-neighbour heuristic to order the slots into
 *    a picking route starting from receiving dock and ending
 *    at dispatch dock.
 *
 * 4. Return the ordered sequence with cumulative distances.
 */

// Zone wall crossing penalty (added to edge weight when crossing zones)
// This is what makes the router respect physical aisle barriers.
const ZONE_CROSSING_PENALTY = 5000;

// Aisle waypoints — workers must pass through these when changing zones
// These coordinates must match the SVG layout
const AISLE_WAYPOINTS = {
  'MAIN_AISLE_CENTER': { x: 1600, y: 1030 },
  'LEFT_AISLE_CENTER': { x: 1600, y: 500 },
  'RECEIVING_DOCK':    { x: 80,   y: 960 },
  'DISPATCH_DOCK':     { x: 3120, y: 960 }
};

/**
 * Build a simple graph from slot positions.
 * Each slot is a node. We connect:
 *   - Slots within same zone: edge weight = Euclidean distance
 *   - Slots across zones: edge through nearest aisle waypoint
 *     with ZONE_CROSSING_PENALTY added
 */
function buildGraph(slots) {
  const nodes = {};

  // Add slot nodes
  slots.forEach(s => {
    nodes[s.slot_id] = { x: s.x, y: s.y,
                          zone: s.slot_id[0] };
  });

  // Add aisle waypoints as nodes
  Object.entries(AISLE_WAYPOINTS).forEach(([id, pos]) => {
    nodes[id] = { x: pos.x, y: pos.y, zone: 'AISLE' };
  });

  // Build adjacency list
  const graph = {};
  const allNodeIds = Object.keys(nodes);

  allNodeIds.forEach(a => {
    graph[a] = {};
    allNodeIds.forEach(b => {
      if (a === b) return;
      const na = nodes[a];
      const nb = nodes[b];

      const euclidean = Math.sqrt(
        Math.pow(na.x - nb.x, 2) + Math.pow(na.y - nb.y, 2)
      );

      // Add zone crossing penalty for cross-zone slot-to-slot edges
      const crossZone = na.zone !== nb.zone &&
                        na.zone !== 'AISLE' &&
                        nb.zone !== 'AISLE';

      const weight = crossZone
        ? euclidean + ZONE_CROSSING_PENALTY
        : euclidean;

      graph[a][b] = weight;
    });
  });

  return { graph, nodes };
}

/**
 * Dijkstra's algorithm — returns shortest distances from
 * source node to all other nodes.
 */
function dijkstra(graph, source) {
  const dist    = {};
  const visited = new Set();
  const nodes   = Object.keys(graph);

  nodes.forEach(n => { dist[n] = Infinity; });
  dist[source] = 0;

  while (true) {
    // Find unvisited node with smallest distance
    let u = null;
    nodes.forEach(n => {
      if (!visited.has(n)) {
        if (u === null || dist[n] < dist[u]) u = n;
      }
    });

    if (u === null || dist[u] === Infinity) break;
    visited.add(u);

    Object.entries(graph[u] || {}).forEach(([v, weight]) => {
      const alt = dist[u] + weight;
      if (alt < dist[v]) dist[v] = alt;
    });
  }

  return dist;
}

/**
 * Nearest-neighbour heuristic on top of Dijkstra distances.
 * Builds a picking route visiting all slots starting from
 * receiving dock and ending at dispatch dock.
 */
function buildPickingRoute(slots) {
  if (!slots || slots.length === 0) {
    return { route: [], totalDistance: 0 };
  }

  const { graph } = buildGraph(slots);

  // Get all slot IDs plus start/end
  const slotIds   = slots.map(s => s.slot_id);
  const startNode = 'RECEIVING_DOCK';
  const endNode   = 'DISPATCH_DOCK';

  // Pre-compute Dijkstra distances from every relevant node
  const allNodes = [startNode, ...slotIds, endNode];
  const distMatrix = {};
  allNodes.forEach(n => {
    distMatrix[n] = dijkstra(graph, n);
  });

  // Nearest-neighbour route from start
  const unvisited = new Set(slotIds);
  const route     = [startNode];
  let   current   = startNode;
  let   totalDist = 0;

  while (unvisited.size > 0) {
    let nearest     = null;
    let nearestDist = Infinity;

    unvisited.forEach(n => {
      const d = distMatrix[current][n] || Infinity;
      if (d < nearestDist) {
        nearestDist = d;
        nearest     = n;
      }
    });

    if (!nearest) break;

    route.push(nearest);
    totalDist += nearestDist;
    unvisited.delete(nearest);
    current = nearest;
  }

  // Add dispatch dock at end
  totalDist += distMatrix[current][endNode] || 0;
  route.push(endNode);

  // Build enriched route with slot details
  const enrichedRoute = route.map((nodeId, i) => {
    const slot = slots.find(s => s.slot_id === nodeId);
    return {
      step:      i + 1,
      node_id:   nodeId,
      slot_id:   nodeId,
      item_id:   slot ? slot.item_id : null,
      x:         slot ? slot.x : (AISLE_WAYPOINTS[nodeId]?.x || 0),
      y:         slot ? slot.y : (AISLE_WAYPOINTS[nodeId]?.y || 0),
      type:      slot ? 'pickup' : (nodeId === 'RECEIVING_DOCK'
                   ? 'start' : 'end'),
      cumulative_distance: 0  // filled in below
    };
  });

  // Fill cumulative distances
  let cumDist = 0;
  for (let i = 1; i < enrichedRoute.length; i++) {
    const prev = enrichedRoute[i-1].node_id;
    const curr = enrichedRoute[i].node_id;
    cumDist += distMatrix[prev]?.[curr] || 0;
    enrichedRoute[i].cumulative_distance = Math.round(cumDist);
  }

  return {
    route:         enrichedRoute,
    totalDistance: Math.round(totalDist),
    totalStops:    slotIds.length
  };
}

export { buildPickingRoute };
