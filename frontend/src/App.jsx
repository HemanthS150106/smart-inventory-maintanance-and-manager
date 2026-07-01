import { BrowserRouter, Routes, Route } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import Forecast from './pages/Forecast.jsx'
import SlotAllocation from './pages/SlotAllocation.jsx'
import Orders from './pages/Orders.jsx'
import CartAllocation from './pages/CartAllocation.jsx'
import WorkerDashboard from './pages/WorkerDashboard.jsx'

function App() {
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/worker-dashboard" element={<WorkerDashboard />} />
      
      <Route element={<DashboardLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/forecast" element={<Forecast />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/allocation" element={<SlotAllocation />} />
        <Route path="/workers" element={<CartAllocation />} />
      </Route>
    </Routes>
  </BrowserRouter>
  )
}

export default App
