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
        <ul className="flex flex-wrap items-center gap-4 sm:gap-6">
          <li>
            <NavLink to="/home" end className={navLinkClass}>
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/demand" className={navLinkClass}>
              Demand Forecast
            </NavLink>
          </li>
          <li>
            <NavLink to="/inbound" className={navLinkClass}>
              Inbound Orders
            </NavLink>
          </li>
          <li>
            <NavLink to="/outbound" className={navLinkClass}>
              Outbound Orders
            </NavLink>
          </li>
          <li>
            <NavLink to="/warehouse" className={navLinkClass}>
              Warehouse
            </NavLink>
          </li>
          <li>
            <NavLink to="/cart-ops" className={navLinkClass}>
              Operations
            </NavLink>
          </li>
          <li>
            <NavLink to="/route-viewer" className={navLinkClass}>
              Route Viewer
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
