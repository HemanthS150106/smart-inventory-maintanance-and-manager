import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../auth/AuthProvider.jsx';
import { Warehouse } from 'lucide-react';

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
          if (data.admin.role === 'monitor') {
            navigate('/monitor');
          } else if (data.admin.role === 'simulation') {
            navigate('/simulation');
          } else {
            navigate('/home');
          }
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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left Brand Panel */}
      <div style={{ 
        flex: 1, 
        backgroundColor: 'var(--dark-panel)', 
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle grid pattern background */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          opacity: 0.3, zIndex: 0
        }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Warehouse size={48} color="var(--amber)" style={{ marginBottom: '24px' }} />
          <h1 style={{ fontSize: '3rem', margin: '0 0 16px 0', fontWeight: 300 }}>Smart Inventory</h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--sidebar-text)', margin: '0 0 48px 0' }}>
            Warehouse Management System
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '6px', height: '6px', backgroundColor: 'var(--amber)', borderRadius: '50%' }} />
              <span style={{ letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.85rem' }}>Forecasting</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '6px', height: '6px', backgroundColor: 'var(--amber)', borderRadius: '50%' }} />
              <span style={{ letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.85rem' }}>Allocation</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '6px', height: '6px', backgroundColor: 'var(--amber)', borderRadius: '50%' }} />
              <span style={{ letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.85rem' }}>Routing</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '6px', height: '6px', backgroundColor: 'var(--amber)', borderRadius: '50%' }} />
              <span style={{ letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.85rem' }}>Simulation</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div style={{
        flex: 1,
        backgroundColor: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px'
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--text-primary)', margin: '0 0 8px 0', fontWeight: 500 }}>Welcome back</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 32px 0', fontSize: '0.9rem' }}>Please enter your details to sign in.</p>

          {/* Role Toggle */}
          <div style={{
            display: 'flex', background: 'var(--bg)',
            padding: '4px', borderRadius: '4px',
            marginBottom: '32px'
          }}>
            {['admin', 'worker'].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => { setRole(r); setError(''); }}
                style={{
                  flex: 1, padding: '8px',
                  border: 'none', borderRadius: '4px',
                  cursor: 'pointer', fontSize: '0.9rem',
                  fontWeight: 500, transition: 'all 0.2s',
                  background: role === r ? '#fff' : 'transparent',
                  color: role === r ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: role === r ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {r === 'admin' ? 'Admin' : 'Worker'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
                {role === 'admin' ? 'Admin ID' : 'Worker ID'}
              </label>
              <input
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                placeholder={role === 'admin' ? 'admin' : 'worker001'}
                required
                className="mono"
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  boxSizing: 'border-box', outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--blue-primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  boxSizing: 'border-box', outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--blue-primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {role === 'worker' && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '-10px 0 0 0' }}>
                Default password: warehouse123
              </p>
            )}

            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '4px', padding: '10px 12px',
                fontSize: '0.85rem', color: 'var(--red)'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px',
                background: loading ? 'var(--text-secondary)' : 'var(--blue-primary)',
                color: 'white', border: 'none',
                borderRadius: '4px', fontSize: '0.9rem',
                fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '12px', transition: 'background 0.2s'
              }}
              onMouseOver={e => { if(!loading) e.target.style.background = 'var(--blue-hover)' }}
              onMouseOut={e => { if(!loading) e.target.style.background = 'var(--blue-primary)' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{
                    width: '16px', height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                    display: 'inline-block'
                  }} />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

