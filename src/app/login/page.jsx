'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import Spinner from '@/components/Spinner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Login failed', 'error'); return; }
      login(data.token, data.user);
      toast('Welcome back!', 'success');
      router.push(data.user.role === 'admin' ? '/admin' : '/captain');
    } catch {
      toast('Network error', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏏</div>
          <h1 className="text-3xl font-bold text-white tracking-tight">NIT Sports Auction</h1>
          <p className="text-slate-400 mt-2">Inter-College Sports Event Platform</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 rounded-2xl p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="admin@nit.com"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Spinner size="sm" /> : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-slate-500 text-xs mt-6">
          Admin: admin@nit.com / admin123 &nbsp;|&nbsp; Captains: captain1@nit.com / captain1
        </p>
        <div className="text-center mt-3">
          <a href="/audience" className="text-blue-400 hover:text-blue-300 text-xs underline">
            👁 Watch Live Auction (Audience View)
          </a>
        </div>
      </div>
    </div>
  );
}
