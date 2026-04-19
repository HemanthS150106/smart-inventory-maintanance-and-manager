import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'

export default function DashboardLayout() {
  return (
    <div className="si-page-bg min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Outlet />
      </main>
    </div>
  )
}
