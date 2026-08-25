# Smart Inventory — Routing Algorithm

> **File:** `backend/services/route_planner.js`  
> **Algorithm:** A* on aisle waypoint graph + 2-Opt TSP optimization

---

## Overview

Workers cannot walk through shelf racks. They must follow physical aisles. The routing system models this as a **graph of waypoints** placed only in walkable areas, then uses **A*** to find shortest paths through this graph.

## Warehouse Layout Constants

```
Canvas:           3200 × 2500 SVG units
Main Horiz Aisle: y = 980 to 1080 (spans full width)
Center Vert Aisle: x = 1540 to 1660 (spans full height)
Entry Gate:       DISPATCH at (3080, 960)  — right wall
Exit Gate:        ENTRANCE at (120, 960)   — left wall
```

### Zone Map
```
┌──────────────────┬──────────────────┐
│     Zone A       │     Zone B       │
│  x: 60–1520      │  x: 1680–3140    │
│  y: 190–970      │  y: 190–970      │
├──────────────────┼──────────────────┤
│  ENTRANCE (EXIT) │ DISPATCH (ENTRY) │  ← Main Aisle y=980–1080
├──────────────────┼──────────────────┤
│     Zone C       │     Zone D       │
│  x: 60–1520      │  x: 1680–3140    │
│  y: 1090–1960    │  y: 1090–1960    │
└──────────────────┴──────────────────┘
```

## Graph Construction (`buildAisleGraph()`)

### Node Types
1. **Main aisle nodes** — every 100px along y=1030 (center of main horizontal aisle)
2. **Center aisle nodes** — every 80px along x=1600 (center of vertical aisle)
3. **Walking aisle nodes** — every 80px along each zone's walking aisles
4. **Entry nodes** — at each walking aisle's left/right boundary
5. **Terminal nodes** — ENTRANCE and DISPATCH

### Walking Aisle Y-Positions (center of 48px gap between rack rows)
```
Zone A: [394, 832, 1270, 1708]
Zone B: [394, 832, 1270, 1708]
Zone C: [1294, 1732, 2170]
Zone D: [1294, 1732, 2170]
```

### Edge Connections
- Main aisle nodes connected sequentially (left to right)
- Center aisle nodes connected sequentially (top to bottom)
- Walking aisle nodes connected sequentially within each zone pair
- Walking aisle ends connected to nearest main/center aisle nodes
- ENTRANCE/DISPATCH connected to nearest main aisle nodes

## Route Building Pipeline (`buildPickingRoute()`)

### Step 1: Slot → Access Node Mapping
Each slot is mapped to its nearest walking aisle graph node (NOT its raw x,y coordinate). This is the point where the worker stops in the aisle to access the shelf.

### Step 2: Pairwise A* Distance Matrix
Pre-compute shortest A* distances between:
- DISPATCH (start) ↔ all access nodes
- All access nodes ↔ all access nodes
- All access nodes ↔ ENTRANCE (end)

### Step 3: Nearest-Neighbour Initial Tour
Greedy nearest-neighbour starting from DISPATCH. At each step, pick the unvisited access node with smallest A* distance from current position.

### Step 4: 2-Opt TSP Improvement
Iteratively try reversing sub-segments to reduce total distance. For each pair (i,j), if reversing [i..j] reduces tour cost, accept it. Max 50 passes.

### Step 5: Build Enriched Route
For each stop in optimized order, include:
- Step number
- Access node ID
- Slot ID + item ID
- SVG coordinates (x, y)
- `aisle_path` — array of waypoint coordinates for SVG rendering
- Cumulative distance

### Step 6: Append Exit Gate
Final stop is always ENTRANCE (exit gate) with path from last pickup.

## Route Format (Output)

```json
{
  "route": [
    { "step": 1, "type": "start", "node_id": "DISPATCH", "x": 3080, "y": 960, "aisle_path": [...] },
    { "step": 2, "type": "pickup", "node_id": "W_A_P1_240", "slot_id": "A01-S01", "aisle_path": [...] },
    { "step": 3, "type": "end", "node_id": "ENTRANCE", "x": 120, "y": 960, "aisle_path": [...] }
  ],
  "totalDistance": 1200,
  "totalStops": 1,
  "fullPathPoints": [...]
}
```

## Dynamic Rerouting (`buildPickingRouteFromStart()`)

When a worker is mid-task and needs rerouting (e.g., congestion avoidance):
1. Creates a temporary `START_TEMP` node at worker's current position
2. Connects it to 5 nearest graph nodes (max 500 SVG units away)
3. Runs the full A* + 2-Opt pipeline from START_TEMP
4. Route still ends at ENTRANCE (exit gate)

## Congestion Control (`congestion_control.js`)

Each aisle segment has a capacity:
- **Main aisles**: 25% of total active carts
- **Walking aisles**: 10% of total active carts

When an aisle exceeds capacity, workers whose routes pass through it are rerouted to alternative paths. The reroute avoids the congested aisle by adding a high penalty (100,000) to A* edge weights in that aisle.

## Exported Functions

| Function | Description |
|----------|-------------|
| `buildPickingRoute(slots)` | Full route from DISPATCH → slots → ENTRANCE |
| `buildPickingRouteFromStart(slots, x, y)` | Route from arbitrary position → slots → ENTRANCE |
| `buildDirectToEntrance(x, y)` | Direct route to exit gate from position |
| `twoOptImprove(tour, distMatrix, startNode)` | 2-Opt TSP improvement |
| `validateRoute(route, taskId)` | Validate route structure |
| `astar(graph, start, end, avoidAisle)` | A* pathfinding on aisle graph |
| `getSlotAccessNode(slotId, x, y, graph)` | Find nearest walkable node to a slot |
| `getAisleAtPosition(x, y)` | Check which aisle segment a position is in |
| `getAislesOnRoute(pathPoints)` | List aisle segments traversed by a route |
