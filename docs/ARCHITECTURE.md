# Smart Inventory — Architecture Overview

> **For AI Agents:** This file is the starting point. Read this first, then refer to specific docs as needed.

## Project Structure

```
smart-inventory-app/
├── backend/                    # Express.js REST API (Node.js, ES Modules)
│   ├── server.js               # Main server entry — port 3001
│   ├── routes/                 # API route handlers
│   │   ├── auth_routes.js      # Admin login (/api/auth/admin-login)
│   │   ├── worker_routes.js    # Worker CRUD, login, position, rerouting
│   │   ├── task_routes.js      # Task lifecycle (assign/activate/complete)
│   │   ├── cart_routes.js      # Cart CRUD
│   │   ├── cart_allocation_routes.js  # Clustering, assignment, worker scoring
│   │   ├── dispatch_routes.js  # Outbound order creation + assignment
│   │   ├── comparison_routes.js # Algorithm comparison (A*, greedy, etc.)
│   ├── services/
│   │   ├── route_planner.js    # A* routing on aisle waypoint graph
│   │   ├── congestion_control.js # Aisle capacity + dynamic rerouting
│   │   ├── svg_generator.js    # JS wrapper to call Python SVG generator
│   │   ├── svg_generator.py    # Python — generates warehouse SVG from slot_registry
│   │   ├── cart_clusterer.py   # Python — KMeans clustering for cart groups
│   │   ├── slot_allocator.py   # Python — weight-based slot allocation
│   ├── utils/
│   │   ├── jsonStore.js        # Read/write JSON files from data/registry/
│   │   ├── task_cleanup.js     # Auto-abandon stale tasks
│
├── frontend/                   # React + Vite + TailwindCSS
│   ├── src/
│   │   ├── main.jsx            # Entry point — wraps App in AuthProvider
│   │   ├── App.jsx             # BrowserRouter + React.lazy code-split routes
│   │   ├── index.css           # Global CSS (design tokens, animations)
│   │   ├── App.css             # Vite scaffold CSS (unused)
│   │   ├── auth/
│   │   │   └── AuthProvider.jsx # JWT token context
│   │   ├── components/
│   │   │   ├── Layout.jsx      # Admin layout with Sidebar + Outlet
│   │   │   ├── Sidebar.jsx     # Admin nav sidebar
│   │   │   ├── Navbar.jsx      # Top navbar
│   │   │   ├── AuthGuard.jsx   # Route protection (admin/worker)
│   │   │   ├── WarehouseSVGViewer.jsx  # Zoomable/pannable SVG viewer
│   │   │   └── ...             # Various dashboard cards
│   │   ├── pages/
│   │   │   ├── Login.jsx       # Unified admin/worker login
│   │   │   ├── WorkerDashboard.jsx  # Worker picking terminal (SVG + TODO list)
│   │   │   ├── Home.jsx        # Admin dashboard KPIs
│   │   │   ├── Orders.jsx      # Inbound order management
│   │   │   ├── OutboundOrders.jsx   # Dispatch order creation
│   │   │   ├── SlotAllocation.jsx   # Warehouse slot view
│   │   │   ├── CartAllocation.jsx   # Cart clustering + worker assignment
│   │   │   ├── Simulation.jsx       # WASD worker movement simulation
│   │   │   ├── AdminRouteViewer.jsx # Admin view of all active routes
│   │   │   ├── MonitorDashboard.jsx # Real-time aisle congestion monitor
│   │   │   └── AlgorithmComparison.jsx # Side-by-side routing comparison
│   │   ├── styles/
│   │   │   ├── theme.css       # CSS custom properties
│   │   │   └── components.css  # Shared component styles
│   ├── svgs/                   # Generated warehouse SVGs (served statically)
│
├── data/registry/              # JSON "database" files (read/write by backend)
│   ├── slot_registry.json      # All warehouse slots + occupancy
│   ├── workers.json            # Worker records
│   ├── tasks.json              # Task records (routes, status, etc.)
│   ├── carts.json              # Cart records
│   ├── cart_groups.json        # Clustering results
│   ├── orders.json             # Inbound orders
│   ├── dispatch_orders.json    # Outbound dispatch orders
│   ├── users.json              # Admin user accounts
│   └── arrivals_history.json   # Item arrival log
│
├── ml/                         # Machine learning models (forecasting)
├── scripts/                    # Utility scripts
```

## Key Architecture Decisions

### Data Store
- **No database** — All state is stored in JSON files under `data/registry/`.
- `jsonStore.js` provides atomic read/write via `readJSON()` / `writeJSON()`.
- File-based storage means no setup needed, but no concurrent write safety.

### Authentication
- Two login paths: **Admin** (`/api/auth/admin-login`) and **Worker** (`/api/workers/login`)
- Admin uses JWT tokens. Worker uses session storage (no JWT).
- `AuthGuard.jsx` protects routes by role.

### Warehouse Layout
- Canvas: **3200 × 2500** SVG units
- 4 zones: A (top-left), B (top-right), C (bottom-left), D (bottom-right)
- Main horizontal aisle at y=980–1080, center vertical aisle at x=1540–1660
- **Entry gate (DISPATCH)** at x=3080, y=960 (right wall)
- **Exit gate (ENTRANCE)** at x=120, y=960 (left wall)

### Routing
- **A* pathfinding** on an aisle waypoint graph (NOT raw pixel coordinates)
- **2-Opt TSP improvement** for multi-stop ordering
- Routes start at DISPATCH (entry gate) → pick items → end at ENTRANCE (exit gate)
- See `docs/ROUTING_ALGORITHM.md` for details.

### Frontend Performance
- **React.lazy + Suspense** code-splitting for all page components
- Loading spinner shown during chunk downloads
- Worker dashboard polls every 3 seconds for task updates

## Running the App

```bash
# Backend (from project root)
cd backend && npm install && node server.js    # runs on :3001

# Frontend (from project root)
cd frontend && npm install && npm run dev      # runs on :5173 (Vite)
```

## Default Credentials

| Role    | Login ID    | Password       |
|---------|-------------|----------------|
| Admin   | `admin`     | `admin`        |
| Worker  | `worker001` | `warehouse123` |
