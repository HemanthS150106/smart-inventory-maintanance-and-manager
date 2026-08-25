import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import AuthGuard from './components/AuthGuard.jsx';

// Lazy-loaded pages for code-splitting — each page is a separate chunk
const Login              = lazy(() => import('./pages/Login.jsx'));
const Home               = lazy(() => import('./pages/Home.jsx'));
const Forecast           = lazy(() => import('./pages/Forecast.jsx'));
const SlotAllocation     = lazy(() => import('./pages/SlotAllocation.jsx'));
const Orders             = lazy(() => import('./pages/Orders.jsx'));
const OutboundOrders     = lazy(() => import('./pages/OutboundOrders.jsx'));
const CartAllocation     = lazy(() => import('./pages/CartAllocation.jsx'));
const WorkerDashboard    = lazy(() => import('./pages/WorkerDashboard.jsx'));
const MonitorDashboard   = lazy(() => import('./pages/MonitorDashboard.jsx'));
const AdminRouteViewer   = lazy(() => import('./pages/AdminRouteViewer.jsx'));
const Simulation         = lazy(() => import('./pages/Simulation.jsx'));
const AlgorithmComparison= lazy(() => import('./pages/AlgorithmComparison.jsx'));

// Premium loading spinner shown during lazy chunk downloads
function PageLoader() {
  return (
    <div className="page-loader">
      <div className="page-loader-inner">
        <div className="page-loader-spinner" />
        <p className="page-loader-text">Loading…</p>
      </div>
    </div>
  );
}

// Root redirect logic
function RootRedirect() {
  const adminData = sessionStorage.getItem('admin');
  const workerData = sessionStorage.getItem('worker');
  
  if (adminData) return <Navigate to="/dashboard" replace />;
  if (workerData) return <Navigate to="/worker-dashboard" replace />;
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          
          {/* Worker Protected Routes */}
          <Route 
            path="/worker-dashboard" 
            element={
              <AuthGuard allowedRole="worker">
                <WorkerDashboard />
              </AuthGuard>
            } 
          />
          
          {/* Admin Protected Routes */}
          <Route 
            element={
              <AuthGuard allowedRole="admin">
                <Layout />
              </AuthGuard>
            }
          >
            <Route path="/dashboard" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/demand" element={<Forecast />} />
            <Route path="/demand-forecast" element={<Forecast />} />
            <Route path="/warehouse" element={<SlotAllocation />} />
            <Route path="/inbound" element={<Orders />} />
            <Route path="/inbound-orders" element={<Orders />} />
            <Route path="/outbound" element={<OutboundOrders />} />
            <Route path="/outbound-orders" element={<OutboundOrders />} />
            <Route path="/cart-ops" element={<CartAllocation />} />
            <Route path="/operations" element={<CartAllocation />} />
            <Route path="/route-viewer" element={<AdminRouteViewer />} />
            <Route path="/simulation" element={<Simulation />} />
            <Route path="/algorithm-comparison" element={<AlgorithmComparison />} />
            <Route path="/monitor" element={<MonitorDashboard />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
