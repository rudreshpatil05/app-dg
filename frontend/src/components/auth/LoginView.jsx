import React, { useState } from 'react';
import { LockKeyhole, LogIn, Smartphone } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function LoginView() {
  const { login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || 'Unable to sign in. Check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-700 to-teal-600 px-7 py-8 text-white">
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center mb-5">
            <Smartphone className="w-6 h-6" />
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-100 font-semibold">DG-Retail OS</p>
          <h1 className="text-2xl font-bold mt-2">Sign in to your store</h1>
          <p className="text-sm text-emerald-50 mt-2">Use your assigned account to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Email or username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Enter email or username"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Password</span>
            <div className="relative mt-1.5">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Enter password"
              />
            </div>
          </label>
          {error && <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2.5 text-sm font-semibold transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
