import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function WorkerLogin() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/workers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_id: loginId, password })
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('worker', JSON.stringify(data.worker));
        navigate('/worker-dashboard');
      } else {
        setError(data.error || 'Invalid login credentials.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="bg-white p-8 rounded-lg shadow-md border border-slate-200 w-full max-w-md">
        
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Worker Terminal</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in with your credentials to see your picking todo list.</p>
        </div>

        {/* Error alert */}
        {error && (
          <div className="bg-[#FFF7E6] border border-[#E8C77B] text-[#B7791F] text-sm p-3 rounded mb-4 font-semibold text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Login ID</label>
            <input
              type="text"
              placeholder="e.g. worker001"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2F6B8A] hover:bg-[#1E3A5F] text-white font-semibold py-2 rounded text-sm transition disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          <a href="/" className="hover:text-indigo-600 font-semibold transition">
            Admin Login Terminal
          </a>
        </div>

      </div>
    </div>
  );
}
