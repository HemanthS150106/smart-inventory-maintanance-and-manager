import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 220, background: 'var(--bg)', minHeight: '100vh', padding: '20px' }}>
        <Outlet />
      </main>
    </div>
  );
}
