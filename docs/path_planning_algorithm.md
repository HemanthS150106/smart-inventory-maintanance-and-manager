# Path Planning Algorithm Documentation
## Smart Inventory Management System — Warehouse Routing

---

## Overview

The warehouse routing system uses a multi-layer algorithm to compute
optimal, physically valid picking routes for warehouse workers.
The system combines three distinct components:

1. **A* Search** — finds shortest paths between points on the
   warehouse aisle graph
2. **Nearest-Neighbour Heuristic** — orders multiple pick stops
   to minimise total travel distance
3. **Capacity-Based Congestion Control** — ensures aisles do not
   exceed safe worker density limits and dynamically reroutes
   workers when needed

---

## 1. The Aisle Graph

### Why a graph?

Workers in a warehouse cannot walk in straight lines between shelf
slots — they are blocked by shelf racks. They must follow physical
aisles. We model the warehouse floor as a weighted directed graph
where:

- **Nodes** represent positions in walkable areas only
  (main aisles, center aisle, walking aisles between rack pairs)
- **Edges** connect adjacent walkable positions with weights
  equal to the Euclidean walking distance between them
- Shelf rack areas have **no nodes and no edges** — they are
  physically absent from the graph

### Graph construction

```
Nodes placed at:
  Main horizontal aisle: every 100 SVG units along y=1030
  Center vertical aisle: every 80 SVG units along x=1600
  Zone walking aisles:   every 80 SVG units along each pair's y
  Receiving dock:        single node at warehouse entry
  Dispatch dock:         single node at warehouse exit

Edge weight = Euclidean distance between connected nodes
Cross-zone edges get a ZONE_CROSSING_PENALTY added to their
weight, preventing routes from cutting through zone boundaries.
```

---

## 2. A* Pathfinding

When routing from point A to point B on the aisle graph, the system uses the classic A* search algorithm:
- **Heuristic Function**: Manhattan distance between the current node and the target node.
- **Pathing Bounds**: Stays strictly on the pre-computed aisle graph nodes to guarantee that paths never cross shelf racks.
- **Aisle Avoidance**: Supports temporary edge cost penalties (adding a massive weight of `1,000,000` to edges) to dynamically route workers around congested segments during capacity-based rerouting.

---

## 3. Nearest-Neighbour Routing (TSP Heuristic)

To solve the Traveling Salesperson Problem (TSP) for order pickers visiting multiple slot targets:
1. **Dock Reservation**: The route starts strictly at the `RECEIVING` dock and ends strictly at the `DISPATCH` dock.
2. **Terminal Exclusions**: `RECEIVING` and `DISPATCH` are strictly excluded from being selected as intermediate destinations during the nearest-neighbour loop.
3. **Optimized Order**: From the current access node (initially `RECEIVING`), the algorithm checks A* distances to all remaining unvisited access nodes. It selects the closest one, adds it to the route, and repeats.
4. **Final Step**: Once all picker slots have been ordered and visited, the path is finalized from the last pickup location directly to the `DISPATCH` dock.

---

## 4. Capacity-Based Congestion Control

To prevent safety and throughput bottlenecks, the system enforces aisle capacity constraints:
- **Aisle Capacity Caps**:
  - **Main (Wide) Aisles**: Maximum `25%` of the total active carts.
  - **Walking (Narrow) Aisles**: Maximum `10%` of the total active carts.
- **Occupancy Tracking**: Counts both workers physically inside the aisle's bounding box and workers whose planned route paths traverse through the aisle.
- **Reroute Decisioning**:
  - Workers doing actual pickup tasks in the congested aisle are allowed to stay.
  - Transit workers just passing through the congested aisle are rerouted.
- **Prioritization**: When multiple workers need rerouting, the system prioritizes keeping workers with the most remaining stops (as rerouting them has a higher cost) and reroutes workers with fewer remaining stops.
- **Reroute Execution**: The worker's route is re-planned using A* with high-cost penalties on the congested aisle's edges, forcing the routing engine to select alternative pathways around the bottleneck.
