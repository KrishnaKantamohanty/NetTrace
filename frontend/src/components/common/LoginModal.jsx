import React, { useState } from 'react';
import { Shield, Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { useCDRStore } from '../../store/useCDRStore';

export default function LoginModal({ isOpen, onClose }) {
  const { setCurrentUser, showToast } = useCDRStore();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) {
      setError('Username and password are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        username: form.username.trim(),
        password: form.password,
      });
      const { access_token, user } = res.data;
      localStorage.setItem('nettrace_token', access_token);
      setCurrentUser(user);
      showToast(`Authenticated: ${user.username} (${user.role})`);
      setForm({ username: '', password: '' });
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 401) {
        setError('Invalid credentials. Please try again.');
      } else if (err.response?.status === 403) {
        setError(detail || 'Account is inactive. Contact administrator.');
      } else {
        setError(detail || 'Authentication service unavailable.');
      }
    } finally {
      setLoading(false);
    }
  };

  const roleBadgeColor = (role) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-950 text-red-400 border-red-500/40';
      case 'LEAD_INVESTIGATOR': return 'bg-purple-950 text-purple-400 border-purple-500/40';
      default: return 'bg-cyan-950 text-cyan-400 border-cyan-500/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#090d16] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-900/30 p-7 font-mono">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-wide">NetTrace Authentication</div>
            <div className="text-[11px] text-slate-400">Law Enforcement Access Control</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 uppercase tracking-wider">Officer ID / Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="e.g. insp.sharma"
                autoComplete="username"
                className="w-full pl-9 pr-3 py-2.5 bg-[#0e1424] border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full pl-9 pr-9 py-2.5 bg-[#0e1424] border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-2.5 bg-red-950/40 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
              <span className="text-[11px] text-red-400">{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition shadow-md shadow-cyan-900/30 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <Shield className="w-3.5 h-3.5" />
                Authenticate Officer
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500 leading-relaxed space-y-1.5">
          <p className="text-cyan-400/90 font-medium">
            New officer? Contact your Cell Admin or Lead Investigator to enroll your Badge ID.
          </p>
          <p className="text-slate-600 text-[9px]">
            Unauthorized access is a punishable offence under Section 66 IT Act 2000. All sessions are cryptographically logged.
          </p>
        </div>
      </div>
    </div>
  );
}

