import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl border border-slate-200">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-500/20">
            <Zap className="h-8 w-8 fill-amber-500/20" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            POS Business Management
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Sign in to access your store register & dashboard
          </p>
        </div>

        {error && (
          <div className="flex items-center space-x-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg bg-white border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all shadow-xs"
                placeholder="e.g. owner or staff"
              />
              <UserCheck className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-white border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all shadow-xs"
                placeholder="••••••••"
              />
              <ShieldCheck className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 disabled:opacity-50 transition-all cursor-pointer shadow-md shadow-amber-600/20 active:scale-[0.99] mt-2"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
          Local-First POS System • Single-Store Mode
        </div>
      </div>
    </div>
  );
};
