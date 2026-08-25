# Smart Inventory — Frontend Components

> **Framework:** React 18 + Vite  
> **Styling:** TailwindCSS + CSS custom properties  
> **Routing:** react-router-dom v6

---

## Entry Point

### `main.jsx`
Wraps `<App />` in `<StrictMode>` and `<AuthProvider>`.

### `App.jsx`
- Uses `React.lazy()` for **code-splitting** all page components
- `<Suspense fallback={<PageLoader />}>` shows a spinner during chunk loads
- `BrowserRouter` with nested `<Routes>`
- Admin routes wrapped in `<AuthGuard allowedRole="admin"><Layout /></AuthGuard>`
- Worker route wrapped in `<AuthGuard allowedRole="worker">`

---

## Layout Components

### `Layout.jsx`
Admin layout shell: `<Sidebar />` + `<Outlet />` (react-router nested routes).

### `Sidebar.jsx`
Admin navigation sidebar. Links to all admin pages.
- Uses `useLocation()` to highlight active route
- Collapsible design

### `Navbar.jsx`
Top navigation bar with user info and logout button.

### `AuthGuard.jsx`
Route protection component. Checks `sessionStorage` for `admin` or `worker` data.
- `allowedRole="admin"` — requires `sessionStorage.admin`
- `allowedRole="worker"` — requires `sessionStorage.worker`
- Redirects to `/login` if not authenticated

---

## Page Components

### `Login.jsx`
Unified login page with Admin/Worker toggle.
- Left panel: brand/feature list
- Right panel: login form
- Admin login → `/api/auth/admin-login` → JWT → redirect by role
- Worker login → `/api/workers/login` → sessionStorage → `/worker-dashboard`
- Spinner animation on submit button

### `WorkerDashboard.jsx` (1175 lines — largest component)
Worker's picking terminal. Two-panel layout:
- **Left (3/4):** Zoomable warehouse SVG with route overlay
- **Right (1/4):** TODO list with task cards, progress bars, slot checkboxes

**Key features:**
- `drawGoogleMapsStyleRoute()` — renders route polylines + markers directly on SVG DOM
- `highlightWorkerSlots()` — highlights assigned slots, dims unassigned ones
- Pulsating blue location pin for worker position
- Zoom/pan via mouse wheel + drag
- Polls for task updates every 3 seconds
- Skeleton spinner while SVG loads

**SVG dimensions:** Fits 3200×2500 canvas into container.

### `Home.jsx`
Admin dashboard KPIs: occupancy rate, active workers, pending tasks, etc.

### `Orders.jsx`
Inbound order management. Create orders, mark items as arrived, trigger slot allocation.

### `OutboundOrders.jsx`
Create dispatch orders. Select items → create order → assign worker + cart.

### `SlotAllocation.jsx`
Full warehouse SVG view showing all slot states (occupied, empty, cart status).

### `CartAllocation.jsx`
- Run KMeans clustering
- View pending cart groups
- Assign workers + carts to groups
- Auto-creates tasks with A* routes

### `Simulation.jsx`
WASD keyboard-controlled worker movement simulation.
- Moves worker position on SVG in real-time
- Posts position updates to `/api/workers/:id/position`
- Plans A* paths for movement

### `AdminRouteViewer.jsx`
Admin view showing all active routes overlaid on warehouse SVG.

### `MonitorDashboard.jsx`
Real-time aisle congestion monitoring.
- Shows aisle capacity bars
- Displays rerouting events
- Auto-refreshes

### `AlgorithmComparison.jsx`
Side-by-side comparison of routing algorithms (A*+2Opt vs Greedy NN vs Zone-First vs S-Pattern).

---

## Shared Components

### `WarehouseSVGViewer.jsx`
Reusable zoomable/pannable SVG container.
- Props: `svgContent`, `mode`, `containerId`
- Mouse wheel zoom (toward cursor), drag pan
- Reset view button, zoom level indicator
- SVG canvas: 3200×2500

### `KpiCard.jsx`
Dashboard metric card with label + value.

### `AlertCard.jsx`
Colored alert card for notifications.

### `InsightCard.jsx`
Dashboard insight cards with metrics.

### `InsightsTable.jsx`
Tabular data display for insights.

### `ForecastLineChart.jsx`
Line chart for demand forecast visualization.

### `Card.jsx`
Basic styled card wrapper.

---

## CSS Architecture

### `index.css`
Global styles:
- Font imports (Inter, IBM Plex Mono)
- CSS custom properties (design tokens)
- Loading animations (`@keyframes spin`, `fadeIn`, `pulse-glow`, `shimmer`)
- Page loader styles
- Skeleton shimmer utility

### `styles/theme.css`
Additional CSS variables and theme overrides.

### `styles/components.css`
Shared component styles (buttons, inputs, tables).

### `App.css`
Vite scaffold CSS (mostly unused).

---

## State Management

- **No global state library** (no Redux/Zustand)
- Each page manages its own state via `useState`/`useEffect`
- Worker session: `sessionStorage.getItem('worker')`
- Admin session: `sessionStorage.getItem('admin')`
- Inter-component communication via `window._currentWorkerTasks` (WorkerDashboard)

---

## Performance Optimizations

- `React.lazy()` code-splitting for all page components
- `Suspense` with animated page loader
- Worker dashboard polling: 3s interval (was 1.5s)
- SVG cache-busting via `?t=Date.now()` query parameter
- `requestAnimationFrame` double-buffering for SVG DOM updates
