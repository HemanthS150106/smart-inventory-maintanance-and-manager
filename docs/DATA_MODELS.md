# Smart Inventory — Data Models

> All data is stored as JSON in `data/registry/`. No database.  
> Read/write via `backend/utils/jsonStore.js`.

---

## slot_registry.json

The core warehouse state. Every physical slot in the warehouse.

```json
{
  "slots": {
    "A01-S01": {
      "x": 140,           // SVG x-coordinate of slot center
      "y": 250,           // SVG y-coordinate of slot center
      "zone": "A",        // Zone: A | B | C | D
      "rack": "A01",      // Rack ID
      "shelf": 1,         // Shelf level (1-4)
      "slot_index": 0,    // Slot position within shelf
      "weight_capacity": 50,  // kg
      "occupied": true,
      "item_id": "SKU-001",
      "batch_id": "BATCH-001",
      "cart_status": "not_allocated" | "slot_only" | "cart_allocated"
    }
  },
  "total_batches": 5,
  "last_updated": "2026-08-19T10:00:00Z"
}
```

**Key fields:**
- `cart_status`: Tracks allocation pipeline progress
  - `not_allocated` — empty or not yet in any cart group
  - `slot_only` — allocated to a slot but not yet grouped into a cart
  - `cart_allocated` — assigned to a cart group for picking

---

## workers.json

```json
{
  "workers": [{
    "worker_id": "W001",
    "login_id": "worker001",
    "name": "Worker Name",
    "password": "warehouse123",     // plaintext (dev only)
    "role": "picker",               // picker | forklift | supervisor
    "shift": "morning",             // morning | afternoon | night
    "is_active": true,
    "status": "Available",          // Available | Busy
    "active_tasks": 0,
    "tasks_completed": 5,
    "current_zone": null,           // A | B | C | D | null
    "last_assigned_at": "2026-08-19T10:00:00Z",
    "efficiency_score": 100,
    "position_x": 80,              // Current SVG x (for simulation)
    "position_y": 960,             // Current SVG y
    "position_zone": null           // Zone worker is currently in
  }]
}
```

**Migration:** `server.js` auto-migrates missing fields on startup.

---

## tasks.json

```json
{
  "tasks": [{
    "taskId": "TASK-0001",
    "type": "outbound",               // outbound | (default = inbound)
    "workerId": "W001",
    "cartId": "CART-01",
    "clusterId": "CG-001",
    "dispatch_order_id": "DO-001",     // only for outbound tasks
    "orderId": null,
    "status": "Assigned",              // Assigned | Active | In Progress — All Stops Visited | Completed | Abandoned
    "assignedAt": "2026-08-19T10:00:00Z",
    "createdAt": "2026-08-19T10:00:00Z",
    "lastUpdatedAt": "2026-08-19T10:00:00Z",
    "completedAt": null,
    "abandonedAt": null,
    "abandonReason": null,
    
    "shelfCoordinates": [
      { "slot_id": "A01-S01", "x": 140, "y": 250, "item_id": "SKU-001" }
    ],
    
    "route": [
      {
        "step": 1,
        "node_id": "DISPATCH",         // Graph node ID
        "slot_id": null,
        "item_id": null,
        "x": 3080, "y": 960,
        "type": "start",               // start | pickup | end
        "cumulative_distance": 0,
        "aisle_path": [{ "x": 3080, "y": 960 }]  // SVG coordinates for rendering
      },
      {
        "step": 2,
        "node_id": "W_A_P1_240",
        "slot_id": "A01-S01",
        "item_id": "SKU-001",
        "x": 140, "y": 250,
        "type": "pickup",
        "cumulative_distance": 450,
        "aisle_path": [{ "x": 3080, "y": 1030 }, { "x": 2400, "y": 1030 }, ...]
      },
      {
        "step": 3,
        "node_id": "ENTRANCE",
        "slot_id": null,
        "item_id": null,
        "x": 120, "y": 960,
        "type": "end",
        "cumulative_distance": 1200,
        "aisle_path": [...]
      }
    ],
    
    "totalDistance": 1200,
    "totalStops": 1,
    "sourceZone": "A",
    "destinationZone": "DISPATCH",
    "completedSlots": ["A01-S01"],
    "currentStopIndex": 1,
    "reroutedAt": null,
    "rerouteReason": null
  }]
}
```

### Task Lifecycle

```
Assigned → (worker loads cart items) → Active → (worker walks route, slots auto-complete) 
  → In Progress — All Stops Visited → (worker reaches exit gate) → Completed
```

- **Assigned**: Cart items shown as checklist. Worker must check all items before starting.
- **Active**: Worker is walking the route in the warehouse.
- **In Progress — All Stops Visited**: All pickup slots done, worker heading to exit.
- **Completed**: Task done, worker + cart freed.
- **Abandoned**: Auto-cleanup after 12 hours or orphaned worker/cart.

---

## carts.json

```json
{
  "carts": [{
    "cart_id": "CART-01",
    "status": "available",           // available | assigned
    "assigned_worker_id": null,
    "capacity": 10
  }]
}
```

---

## cart_groups.json

Created by KMeans clustering. Links slots to carts and workers.

```json
{
  "groups": [{
    "cart_group_id": "CG-001",
    "status": "pending",             // pending | assigned
    "cart_id": null,
    "worker_id": null,
    "created_at": "2026-08-19T10:00:00Z",
    "items": [
      { "item_id": "SKU-001", "slot_id": "A01-S01", "x": 140, "y": 250 }
    ]
  }]
}
```

---

## orders.json

Inbound purchase orders.

```json
[{
  "order_id": "PO-001",
  "status": "Ordered",              // Ordered | Partial | Complete
  "items": [{
    "item_id": "SKU-001",
    "qty_ordered": 100,
    "weight": 2.5,
    "arrived": false
  }]
}]
```

---

## dispatch_orders.json

Outbound dispatch/shipping orders.

```json
{
  "dispatch_orders": [{
    "dispatch_order_id": "DO-001",
    "status": "pending",             // pending | assigned | dispatched
    "created_at": "2026-08-19T10:00:00Z",
    "items": [{
      "item_id": "SKU-001",
      "qty_needed": 1,
      "slot_id": "A01-S01",
      "slot_x": 140,
      "slot_y": 250,
      "picked": false
    }],
    "assigned_worker_id": null,
    "assigned_cart_id": null,
    "pick_task_id": null
  }]
}
```

---

## users.json

Admin accounts.

```json
[{
  "login_id": "admin",
  "password": "admin",
  "role": "admin"        // admin | monitor | simulation
}]
```

Roles determine post-login redirect:
- `admin` → `/home` (full dashboard)
- `monitor` → `/monitor` (congestion dashboard)
- `simulation` → `/simulation` (WASD simulation)
