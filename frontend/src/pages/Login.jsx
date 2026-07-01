import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../auth/AuthProvider.jsx';

export default function Login() {
  const [role,     setRole]     = useState('admin');  // 'admin'|'worker'
  const [loginId,  setLoginId]  = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (role === 'admin') {
        const res  = await fetch('/api/auth/admin-login', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ login_id: loginId, password })
        });
        const data = await res.json();
        if (data.success) {
          sessionStorage.setItem('admin', JSON.stringify(data.admin));
          login(data.token);
          navigate('/home');
        } else {
          setError(data.error || 'Invalid admin credentials');
        }
      } else {
        const res  = await fetch('/api/workers/login', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ login_id: loginId, password })
        });
        const data = await res.json();
        if (data.success) {
          sessionStorage.setItem('worker', JSON.stringify(data.worker));
          navigate('/worker-dashboard');
        } else {
          setError(data.error || 'Invalid worker credentials');
        }
      }
    } catch (err) {
      setError('Connection error. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#f1f5f9'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px',
        padding: '40px', width: '400px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)'
      }}>
        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>
            🏭
          </div>
          <h1 style={{ margin: 0, fontSize: '22px',
                       color: '#1e293b', fontWeight: '700' }}>
            Smart Inventory
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b',
                      fontSize: '14px' }}>
            Warehouse Management System
          </p>
        </div>

        {/* Role Toggle */}
        <div style={{
          display: 'flex', background: '#f1f5f9',
          borderRadius: '10px', padding: '4px',
          marginBottom: '24px'
        }}>
          {['admin', 'worker'].map(r => (
            <button
              key={r}
              onClick={() => { setRole(r); setError(''); }}
              style={{
                flex: 1, padding: '10px',
                border: 'none', borderRadius: '8px',
                cursor: 'pointer', fontSize: '14px',
                fontWeight: '600', transition: 'all 0.2s',
                background: role === r ? 'white' : 'transparent',
                color: role === r ? '#1e40af' : '#64748b',
                boxShadow: role === r
                  ? '0 1px 4px rgba(0,0,0,0.12)' : 'none'
              }}
            >
              {r === 'admin' ? '👔 Admin' : '👷 Worker'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#475569',
                            fontWeight: '500', display: 'block',
                            marginBottom: '6px' }}>
              {role === 'admin' ? 'Admin ID' : 'Worker ID'}
            </label>
            <input
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              placeholder={role === 'admin'
                ? 'admin' : 'worker001'}
              required
              style={{
                width: '100%', padding: '11px 14px',
                border: '1.5px solid #e2e8f0',
                borderRadius: '8px', fontSize: '14px',
                boxSizing: 'border-box', outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={e =>
                e.target.style.borderColor = '#3b82f6'}
              onBlur={e =>
                e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '13px', color: '#475569',
                            fontWeight: '500', display: 'block',
                            marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', padding: '11px 14px',
                border: '1.5px solid #e2e8f0',
                borderRadius: '8px', fontSize: '14px',
                boxSizing: 'border-box', outline: 'none'
              }}
            />
          </div>

          {role === 'worker' && (
            <p style={{ fontSize: '12px', color: '#94a3b8',
                        margin: '0 0 16px' }}>
              Default password: warehouse123
            </p>
          )}

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: '8px', padding: '10px 14px',
              marginBottom: '16px', fontSize: '13px',
              color: '#dc2626'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px',
              background: loading ? '#94a3b8' : '#1e40af',
              color: 'white', border: 'none',
              borderRadius: '8px', fontSize: '15px',
              fontWeight: '600', cursor: loading
                ? 'not-allowed' : 'pointer',
              marginTop: '8px'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
