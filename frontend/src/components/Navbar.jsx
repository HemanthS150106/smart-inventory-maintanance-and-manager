import { NavLink } from 'react-router-dom'
import { useContext } from 'react'
import { AuthContext } from '../auth/AuthProvider.jsx'

function navLinkClass({ isActive }) {
  return [
    'border-b-2 pb-1 text-sm font-semibold transition-colors',
    isActive
      ? 'border-[var(--si-primary)] text-[var(--si-primary)]'
      : 'border-transparent text-slate-600 hover:text-slate-900',
  ].join(' ')
}

export default function Navbar() {
  const { isAuthenticated, logout } = useContext(AuthContext)
  return (
    <header className="si-nav">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8"
        aria-label="Main"
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight text-[var(--si-primary)] sm:text-lg">
            Smart Inventory
          </span>
          <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 sm:inline">
            Forecasting
          </span>
        </div>
        <ul className="flex items-center gap-8">
          <li>
            <NavLink to="/home" end className={navLinkClass}>
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/forecast" className={navLinkClass}>
              Demand Forecast
            </NavLink>
          </li>
          <li>
            <NavLink to="/orders" className={navLinkClass}>
              Orders
            </NavLink>
          </li>
          <li>
            <NavLink to="/allocation" className={navLinkClass}>
              Slot Allocation
            </NavLink>
          </li>
          <li>
            <NavLink to="/workers" className={navLinkClass}>
              Cart Allocation
            </NavLink>
          </li>
          {isAuthenticated && (
            <li>
              <button
                className="si-btn si-btn--ghost"
                onClick={() => { logout(); window.location.href = '/' }}
              >
                Sign out
              </button>
            </li>
          )}
        </ul>
      </nav>
    </header>
  )
}
