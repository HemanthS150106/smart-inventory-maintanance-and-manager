# Technical Report: Routing and Cart Allocation in Smart Inventory 4

## SECTION 1 — SYSTEM OVERVIEW & WORKFLOW

The routing and cart allocation system in **Smart Inventory 4** automates and optimizes how items are retrieved from warehouse shelves and how picking tasks are assigned to workers. The system bridges the gap between dynamic slot allocation (where items are stored) and physical order fulfillment. 

The entire process runs through three main stages:

```mermaid
flowchart TD
    A[Order Items Marked Arrived] --> B[Dynamic Slotting & Placement]
    B --> C[FCM Clustering into Cart Groups]
    C --> D[Worker & Cart Assignment Scoring]
    D --> E[A* Aisle-Constrained Route Planning]
    E --> F[TSP Nearest-Neighbor Stop Sequencing]
    F --> G[Real-Time Execution & Congestion Rerouting]
    G --> H[Dispatch & Final Drop-off]
end
```

### 1.1 End-to-End Task Lifecycle
1. **Clustering Trigger**: When items are placed into shelves (via the slot allocation system), they are registered with `cart_status: "slot_only"`. When the administrator clicks **"Run Clustering"** on the dashboard, the backend triggers the Fuzzy C-Means (FCM) clustering engine to group these items into compact, zone-specific batches.
2. **Task Creation**: Each clustered group of items is converted into a **pending cart group** (`CG-XXX`) and stored in `cart_groups.json`.
3. **Worker & Cart Assignment**: The administrator assigns the cart group to an available worker and an available cart. The backend scores available workers based on their idle time, experience, and current workload to recommend the best candidate.
4. **Route Planning & Sequencing**:
   - The backend maps each slot coordinate to the closest walkable node on the warehouse waypoint graph.
   - It pre-computes paths between all stops using **A\*** pathfinding.
   - It sequences the stops using a **Nearest-Neighbor TSP heuristic** to minimize total walking distance, starting at the **Receiving Dock** and ending at the **Dispatch Dock**.
5. **Worker Execution**: The worker logs in, sees their pick list and an interactive, animated Google Maps-style route, and walks the warehouse aisles to pick the items.
6. **Dynamic Rerouting**: If multiple workers create congestion or if a worker goes off-route, the system dynamically calculates bypass routes by penalizing blocked aisles and running A\* to find alternative paths.

---

## SECTION 2 — CART ALLOCATION & CLUSTERING MECHANISMS

The cart allocation pipeline determines how individual items scattered across warehouse slots are grouped together to form efficient, single-trip picking batches.

### 2.1 Fuzzy C-Means (FCM) Clustering
Rather than assigning items to carts randomly or in strict order of arrival, the system uses **Fuzzy C-Means (FCM)** clustering. 
* **Soft Clustering**: Unlike hard-clustering methods (e.g., K-Means) where a point belongs strictly to one cluster, FCM assigns each item a membership degree ($u_{ij} \in [0, 1]$) for every cluster $i$. 
* **Convergence**: The algorithm iteratively updates cluster centers and membership coefficients to minimize the fuzzy distance objective function. Once converged, each item is hard-assigned to the cluster with the highest membership coefficient:
  $$i^* = \operatorname{argmax}_i u_{ij}$$

The clustering engine is implemented in [cart_clusterer.py](file:///c:/Users/heman/Downloads/laddu/laddu/smart-inventory-app%204/smart-inventory-app/backend/services/cart_clusterer.py). The number of clusters $C$ is calculated dynamically based on the total number of unallocated slots $N$ and the average cart capacity (defaulting to 8 items per cart):
$$C = \max\left(1, \left\lceil \frac{N}{8} \right\rceil\right)$$

### 2.2 The Zone Wall Problem and Zone-Offset Encoding
In a standard physical layout, two slots on opposite sides of a rack wall may be separated by only a few inches in 2D Euclidean space. However, because workers cannot walk through rack shelves, a worker would have to walk all the way around the rack to reach the opposite side.

If standard 2D coordinates were fed into the FCM algorithm, it would group these slots into the same cart load, forcing the worker to traverse back and forth between adjacent aisles.

```
         Aisle 1             Aisle 2
    ┌───────────────┐   ┌───────────────┐
    │ Slot 1 (ZoneA)│   │ Slot 2 (ZoneB)│
    │   o [x, y]    │   │   o [x, y]    │  <-- Geometrically close in 2D,
    └───────────────┘   └───────────────┘      but physically separated by a rack wall!
    ================= RACK WALL =================
```

To solve this, the system implements **Zone-Offset Encoding**:
1. Every slot belongs to a physical zone: **A**, **B**, **C**, or **D**.
2. Each zone is assigned a synthetic z-coordinate offset:
   * **Zone A**: $z = 0$
   * **Zone B**: $z = 100,000$
   * **Zone C**: $z = 200,000$
   * **Zone D**: $z = 300,000$
3. The coordinate vector for each slot is expanded to 3D: $P = [x, y, z\_offset]$.
4. The FCM algorithm computes Euclidean distance in this 3D space:
   $$d = \sqrt{(x_1 - x_2)^2 + (y_1 - y_2)^2 + (z_1 - z_2)^2}$$

Because the zone gap ($100,000$) is vastly larger than the physical dimensions of the warehouse ($3200 \times 2000$), the distance between slots in different zones is dominated by the synthetic $z$ dimension. This guarantees that **cross-zone distances always exceed within-zone distances**, mathematically preventing FCM from grouping slots from different zones into the same cart. Each cart load is naturally restricted to a single zone, avoiding inefficient zone-hopping.

---

### 2.3 Worker Assignment Engine and Scoring Algorithm
When assigning a cart group to a worker, the backend uses a multi-factor scoring function in [cart_allocation_routes.js](file:///c:/Users/heman/Downloads/laddu/laddu/smart-inventory-app%204/smart-inventory-app/backend/routes/cart_allocation_routes.js#L226-L253) to evaluate and rank eligible pickers:

$$\text{Score} = 0.5 \times \text{Availability Score} + 0.3 \times \text{Experience Score} + 0.2 \times \text{Workload Score}$$

Each score component is normalized to a $[0, 100]$ range:

* **Availability Score**: Evaluates how long the worker has been idle since their last assignment. Longer idle times yield higher scores to balance shifts:
  $$\text{Availability Score} = \min\left(100, \frac{\text{Idle Minutes}}{\text{maxIdleMinutes}} \times 100\right)$$
  *(where `maxIdleMinutes` is capped at 480 minutes / 8 hours)*
* **Experience Score**: Measures worker efficiency based on their historical volume of completed tasks:
  $$\text{Experience Score} = \min\left(100, \frac{\text{Tasks Completed}}{\text{maxTasks}} \times 100\right)$$
  *(where `maxTasks` is the maximum number of tasks completed by any single worker in the registry)*
* **Workload Score**: Incentivizes assigning tasks to workers with fewer active tasks:
  $$\text{Workload Score} = \min\left(100, \left(1 - \frac{\text{Active Tasks}}{\text{maxActiveTasks}}\right) \times 100\right)$$

#### Assignment Rules & Validation Steps:
1. **Shift Matching**: A worker must be on the current active shift (Morning: 06:00 - 14:00, Afternoon: 14:00 - 22:00, Night: 22:00 - 06:00).
2. **Availability Check**: The worker's status must be `"Available"` and they must have 0 active tasks in `"Assigned"` or `"In Progress"` state.
3. **Cart Availability Check**: The selected cart must be in `"available"` status.
4. **Tie-Breaker Hierarchy**: If scores are within 0.5 points, the system breaks ties by selecting the worker with fewer active tasks, then the worker with the oldest `last_assigned_at` timestamp.

---

## SECTION 3 — AISLE-CONSTRAINED ROUTING & PATH PLANNING

Once a cart group is assigned, the system plans the picker's physical walking path. Because workers cannot walk through storage racks, pathfinding is constrained to a predefined grid of aisles.

```
       [Receiving Dock] 
             │
             ▼
      [Main Aisle (Y=1030)] ──◄──►── [Center Aisle (X=1600)]
             │                                   │
             ▼                                   ▼
      [Zone Entry Node]                   [Zone Entry Node]
             │                                   │
             ▼                                   ▼
    [Walking Aisle (e.g. Y=394)]        [Walking Aisle (e.g. Y=1294)]
             │                                   │
             ▼                                   ▼
      [Slot Access Node]                  [Slot Access Node]
             │                                   │
             ▼                                   ▼
        [Slot (Pick)]                       [Slot (Pick)]
             │                                   │
             └───────────────────┬───────────────┘
                                 │
                                 ▼
                          [Dispatch Dock]
```

### 3.1 The Aisle Waypoint Graph
The physical layout of the warehouse is modeled as an aisle waypoint graph in [route_planner.js](file:///c:/Users/heman/Downloads/laddu/laddu/smart-inventory-app%204/smart-inventory-app/backend/services/route_planner.js). Waypoints are placed strictly in walkable areas:
1. **Main Horizontal Aisle**: Run along $y = 1030$ (the center of the main aisle, which divides the upper and lower halves of the warehouse) spaced every 100px from $x = 100$ to $x = 3100$.
2. **Center Vertical Aisle**: Run along $x = 1600$ (the center vertical aisle dividing the left and right zones) spaced every 80px from $y = 200$ to $y = 1900$.
3. **Walking Aisles**: Centerlines between rack pairs within each zone.
   * **Zones A & B**: $y \in [394, 832, 1270, 1708]$
   * **Zones C & D**: $y \in [1294, 1732, 2170]$
   * Waypoint nodes are placed along these lines spaced every 80px.
4. **Zone Entry Nodes**: Boundary waypoints placed at the left and right edges of each walking aisle (e.g., `ENTRY_A_P1_L`, `ENTRY_B_P2_R`) connecting them to the main horizontal or center vertical aisles.
5. **Docks**: Standalone nodes for `RECEIVING` ($80, 960$) and `DISPATCH` ($3120, 960$).

Edges are created only between adjacent waypoints, representing linear walkable pathways. The cost of each edge is the Euclidean distance between the two connected waypoints.

### 3.2 A\* Pathfinding
To find the shortest path between any two waypoints, the system uses the **A\*** pathfinding algorithm.
* **Heuristic Function**: Since the warehouse layout resembles a grid-like aisle structure, the algorithm uses a **Manhattan distance heuristic** which is both admissible and consistent:
  $$h(n) = |n.x - \text{end}.x| + |n.y - \text{end}.y|$$
* **Routing Process**:
  1. The system locates the **Slot Access Node** for each target slot. The worker walks along the walking aisle to the node closest to the slot's x-coordinate, rather than walking directly to the slot.
  2. A\* is run to find the optimal sequence of waypoints between the worker's current location and the target Slot Access Node.

---

### 3.3 Picking Stop Sequencing (TSP Nearest-Neighbor)
A picking task involves visiting multiple slots in a single trip. Ordering these stops is a version of the **Traveling Salesperson Problem (TSP)**.

The system resolves this using a **Nearest-Neighbor (NN) Heuristic**:
1. The route always begins at the `RECEIVING` dock.
2. The algorithm evaluates the A\* distance from the current node to the access nodes of all remaining unvisited slots.
3. It selects the closest slot access node, adds it to the route, marks it visited, and sets the current position to that node.
4. Steps 2-3 repeat until all target slots are visited.
5. The `DISPATCH` dock is appended as the absolute final destination, ensuring the picker returns the cart to dispatch at the end of the trip.

---

## SECTION 4 — DYNAMIC CONGESTION AVOIDANCE & REROUTING

In a busy warehouse, multiple workers operating in the same aisle will cause traffic and slow down operations. To handle this, Smart Inventory 4 includes real-time collision monitoring and dynamic path rerouting.

### 4.1 Proximity Conflict Detection
The backend periodically queries the `/api/workers/congestion-check` endpoint (in [worker_routes.js](file:///c:/Users/heman/Downloads/laddu/laddu/smart-inventory-app%204/smart-inventory-app/backend/routes/worker_routes.js#L93-L149)). 
* If two active workers are within `PROXIMITY_THRESHOLD` ($200$ SVG units, approximately 6% of the warehouse width), a congestion conflict is registered.
* **Resolution Rule**: The system retrieves the active tasks for both workers and compares their remaining walking distances.
  * The worker with the **higher** remaining distance retains their current route.
  * The worker with the **lower** remaining distance is selected for rerouting to yield the right-of-way.

### 4.2 Dynamic Aisle Avoidance (Penalty Rerouting)
When a worker is selected for rerouting:
1. The system identifies which walking aisle the worker is currently closest to (e.g., `W_A_P1`, `W_B_P2`).
2. It sets this aisle as the `avoidAisle` parameter.
3. The backend runs the pathplanner to recalculate the worker's route to their remaining pick locations.
4. During A\* pathfinding, any edge that enters or lies within the avoided aisle receives a heavy penalty:
   $$\text{Edge Cost} = \text{Euclidean Distance} + 100,000$$
5. Because of this penalty, A\* routes the worker through alternative aisles or the main/center cross aisles, bypassing the congested area.

### 4.3 Off-Route Detection
In the live simulation dashboard ([Simulation.jsx](file:///c:/Users/heman/Downloads/laddu/laddu/smart-inventory-app%204/smart-inventory-app/frontend/src/pages/Simulation.jsx)), if a worker drifts more than $180$ SVG units away from their planned path, the system flags the worker as "Off-Route" and automatically triggers an API request to recalculate a clean A\* path starting from the worker's current coordinates to their remaining stops.

---

## SECTION 5 — VISUALIZATIONS & USER INTERFACE

The system provides interactive interfaces for both administrators and workers to monitor and execute routes.

### 5.1 Google Maps-Style Route Rendering
In [WorkerDashboard.jsx](file:///c:/Users/heman/Downloads/laddu/laddu/smart-inventory-app%204/smart-inventory-app/frontend/src/pages/WorkerDashboard.jsx#L4-L127), the active picking path is rendered directly on top of the warehouse blueprint SVG. To make the interface intuitive and premium, the route is drawn in three overlapping SVG polyline layers:

1. **Layer 1: Border Outline**: A wide, semi-transparent white polyline (`stroke-width="18"`, `opacity="0.9"`) that creates a clean border effect on top of dark rack drawings.
2. **Layer 2: Main Route Line**: A bright blue polyline (`stroke-width="12"`, `opacity="0.85"`, color `#1a73e8`) that represents the walking path.
3. **Layer 3: Flow Indicator**: A thin white dashed line (`stroke-width="4"`, `stroke-dasharray="8,24"`) with an infinite SVG animation that slides the dash offset to create a **pulsing, flowing dot animation** that visually guides the worker.

### 5.2 Dynamic Route Trimming
As the worker walks along the aisles, the frontend calculates their distance to all waypoints in the current route segment. The path is dynamically trimmed (removing already-visited segments and drawing the blue line starting directly from the worker's pulsating location pin), matching the user experience of modern GPS navigation systems.

---

## SECTION 6 — CRITIQUE & SYSTEM LIMITATIONS

While the routing and cart allocation system is mathematically sound and runs smoothly, there are several limitations in the codebase that restrict its scalability:

1. **Hardcoded Cart Capacity vs. Dynamic Cart Volumes**: The Express `/cluster` route hardcodes the maximum batch size to 8 items without evaluating the weight or volume of those items. If a batch contains 8 heavy, bulky objects that exceed the assigned cart's constraints (stored in `carts.json`), the assignment still succeeds, causing a physical overload risk.
2. **Nearest-Neighbor Suboptimality**: The Nearest-Neighbor heuristic is a greedy approach. While fast for small pick counts (3-8 items), it is susceptible to sub-optimal routing decisions as batch size increases. Implementing a **2-opt refinement pass** or a Christofides algorithm would improve route efficiency.
3. **Synchronous Python Subprocess Spawn**: Clustering is handled by spawning a Python child process on every request. Spawning Python processes sequentially blocks backend threads and increases response times under heavy load. Rewriting the FCM logic in Javascript or running a persistent Python microservice would make the system more scalable.
4. **Lack of Write Locks on Registry Operations**: JSON registries are updated by reading the entire file, modifying the object, and writing the file back without transactions. Simultaneous operations can overwrite each other, leading to data loss or duplicate assignments.
