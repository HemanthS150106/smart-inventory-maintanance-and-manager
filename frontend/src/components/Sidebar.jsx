import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Warehouse, PackageOpen,
  PackageCheck, ShoppingCart, Map, Play, BarChart2,
  LogOut
} from 'lucide-react';

export default function Sidebar() {
  const navigate = useNavigate();
  const admin = JSON.parse(sessionStorage.getItem('admin') || '{}');

  const groups = [
    {
      label: 'OVERVIEW',
      items: [
        { path: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' }
      ]
    },
    {
      label: 'INVENTORY',
      items: [
        { path: '/demand', icon: <TrendingUp size={18} />, label: 'Demand Forecast' },
        { path: '/warehouse', icon: <Warehouse size={18} />, label: 'Warehouse' }
      ]
    },
    {
      label: 'ORDERS',
      items: [
        { path: '/inbound', icon: <PackageOpen size={18} />, label: 'Inbound Orders' },
        { path: '/outbound', icon: <PackageCheck size={18} />, label: 'Outbound Orders' }
      ]
    },
    {
      label: 'OPERATIONS',
      items: [
        { path: '/cart-ops', icon: <ShoppingCart size={18} />, label: 'Cart Operations' },
        { path: '/route-viewer', icon: <Map size={18} />, label: 'Route Viewer' }
      ]
    },
    {
      label: 'SIMULATION',
      items: [
        { path: '/simulation', icon: <Play size={18} />, label: 'Simulation' },
        { path: '/algorithm-comparison', icon: <BarChart2 size={18} />, label: 'Algorithm Comparison' }
      ]
    }
  ];

  const handleLogout = () => {
    sessionStorage.removeItem('admin')
    sessionStorage.removeItem('worker');
    navigate('/login');
  };

  return (
    <div style={{
      width: '220px',
      backgroundColor: 'var(--sidebar-bg)',
      color: 'var(--sidebar-text)',
      height: '100vh',
      position: 'fixed',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #1f2937',
      zIndex: 1000
    }}>
      <div style={{ padding: '20px', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', borderBottom: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        Smart Inventory
        <span style={{ fontSize: '0.7rem', color: 'var(--sidebar-text)', fontWeight: 'normal' }}>
          {admin?.name || 'Admin'}
        </span>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '15px 0' }}>
        {groups.map((g, idx) => (
          <div key={idx} style={{ marginBottom: '20px' }}>
            <div style={{
              padding: '0 20px',
              fontSize: '0.65rem',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#6b7280',
              marginBottom: '8px',
              fontWeight: 600
            }}>
              {g.label}
            </div>
            {g.items.map((item, i) => (
              <NavLink
                key={i}
                to={item.path}
                end={item.path === '/'}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 20px',
                  textDecoration: 'none',
                  color: isActive ? '#fff' : 'var(--sidebar-text)',
                  borderLeft: isActive ? '3px solid var(--sidebar-active)' : '3px solid transparent',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                  gap: '12px',
                  transition: 'all 0.15s ease'
                })}
              >
                {item.icon}
                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      <div style={{ padding: '15px', borderTop: '1px solid #1f2937' }}>
        <button 
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'none',
            border: 'none',
            color: 'var(--sidebar-text)',
            cursor: 'pointer',
            padding: '8px',
            width: '100%',
            textAlign: 'left',
            fontSize: '0.85rem',
            transition: 'color 0.15s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--sidebar-text)'}
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}
