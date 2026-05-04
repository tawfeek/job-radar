import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import client, { setToken } from '../api/client';

export default function Login() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    try {
      const { data } = await client.post('/auth/login', { password });
      setToken(data.token);
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white border border-surface-200 rounded-xl p-8 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-6">
          <img src="/logo.svg" alt="" className="w-8 h-8" />
          <span className="font-bold text-xl text-surface-900">JobRadar</span>
        </div>
        <p className="text-sm text-surface-500 mb-6">
          Sign in to continue.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full px-3 py-2 mb-4 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
        />
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
