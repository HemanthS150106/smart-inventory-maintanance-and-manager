# Smart Inventory — API Reference

> All endpoints are served from `http://localhost:3001`.  
> Frontend proxies `/api/*` to this backend via Vite config.

---

## Authentication

### POST `/api/auth/admin-login`
Admin login. Returns JWT token.
```json
{ "login_id": "admin", "password": "admin" }
→ { "success": true, "admin": { "login_id": "admin", "role": "admin" }, "token": "..." }
```

### POST `/api/workers/login`
Worker login. No JWT — returns worker object stored in sessionStorage.
```json
{ "login_id": "worker001", "password": "warehouse123" }
→ { "success": true, "worker": { "worker_id": "W001", "name": "...", ... } }
```

### POST `/api/register`
Register new admin user (email/password). Returns `{ success: true }`.

### POST `/api/login`
Legacy email/password login. Returns JWT token.

---

## Workers

### GET `/api/workers`
List all active workers. Optional `?role=picker` filter.

### POST `/api/workers`
Create new worker.
```json
{ "name": "John", "role": "picker", "shift": "morning" }
→ { "success": true, "worker_id": "W001", "login_id": "worker001" }
```

### DELETE `/api/workers/:id`
Soft-delete worker (sets `is_active: false`).

### PATCH `/api/workers/:id/position`
Update worker position (used by simulation).
```json
{ "x": 500, "y": 1030, "zone": "A" }
```

### GET `/api/workers/positions`
Get positions of all busy workers. Used by monitor dashboard.

### GET `/api/workers/congestion-check`
Run congestion control algorithm. Returns aisle states and rerouting actions.

### GET `/api/workers/aisle-states`
Returns current aisle occupancy data.

### POST `/api/workers/reroute/:workerId`
Force reroute a worker to avoid congested aisles.

### POST `/api/workers/:id/plan-path`
Plan A* path between worker's current position and target coordinates.
```json
{ "targetX": 1500, "targetY": 800 }
→ { "success": true, "path": [{ "x": ..., "y": ... }, ...] }
```

---

## Tasks

### GET `/api/tasks`
List all tasks. Optional filters: `?workerId=W001`, `?status=Assigned`.

### PATCH `/api/tasks/:taskId/activate`
Change task status from "Assigned" to "Active" (worker starts route).

### PATCH `/api/tasks/:taskId/complete`
Mark task as completed. Frees worker and decrements active_tasks.

### PATCH `/api/tasks/:taskId/pick`
Mark a slot as picked. Body: `{ "slot_id": "A01-S03" }`.

### PATCH `/api/tasks/:taskId/stop/:slotId/complete`
Mark a specific stop as visited. Auto-updates progress and detects all-done state.

### POST `/api/tasks/cleanup`
Abandon stale/orphaned tasks (>12 hours, missing worker/cart).

---

## Cart Allocation

### POST `/api/cart-allocation/cluster`
Run KMeans clustering on unallocated slots. Creates cart groups.

### GET `/api/cart-allocation/pending-groups`
List cart groups with status "pending".

### POST `/api/cart-allocation/assign`
Assign worker + cart to a cart group. Creates task with A* route.
```json
{ "cart_group_id": "CG-001", "worker_id": "W001", "cart_id": "CART-01" }
```

### GET `/api/cart-allocation/worker-todo/:worker_id`
Get worker's assigned cart group items.

---

## Dispatch (Outbound Orders)

### GET `/api/dispatch`
List all dispatch orders.

### POST `/api/dispatch`
Create new dispatch order.
```json
{ "items": [{ "item_id": "SKU-001", "qty_needed": 2 }] }
```

### POST `/api/dispatch/:id/assign`
Assign worker + cart to pick a dispatch order. Creates task with picking route.
```json
{ "worker_id": "W001", "cart_id": "CART-01" }
```

### PATCH `/api/dispatch/:id/complete`
Mark dispatch order as completed. Frees slots, worker, and cart.

---

## Other Endpoints

### GET `/api/slots`
Returns all warehouse slots from `slot_registry.json`.

### GET `/api/orders`
Returns all inbound orders.

### POST `/api/orders`
Create new inbound order (requires JWT).

### POST `/api/arrive`
Mark items as arrived. Triggers Python slot allocation.

### POST `/api/reset-warehouse`
Full warehouse reset — clears all slots, tasks, workers to default state.

### GET `/api/forecast`
Download forecast CSV file.

### GET `/api/algorithm-compare/algorithms`
Compare routing algorithms (A*+2Opt, Greedy NN, Zone-First, S-Pattern).

---

## Static Files

| Path | Description |
|------|-------------|
| `/svgs/warehouse_blueprint.svg` | Empty warehouse layout |
| `/svgs/warehouse_allocated.svg` | Warehouse with current slot allocations |
| `/data/registry/*.json` | Raw data files |
