import React, { useState, useEffect } from 'react';
import { Shield, UserPlus, CheckCircle2, XCircle, Search, RefreshCw, KeyRound, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useCDRStore } from '../store/useCDRStore';
import Loader from '../components/common/Loader';

export default function OfficerManagementView() {
  const { currentUser, showToast } = useCDRStore();
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // New Officer Form
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    badge_number: '',
    password: '',
    role: 'INVESTIGATOR'
  });
  const [formError, setFormError] = useState('');

  const isAdminOrLead = currentUser?.role === 'ADMIN' || currentUser?.role === 'LEAD_INVESTIGATOR';
  const isAdmin = currentUser?.role === 'ADMIN';

  const fetchOfficers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/users');
      setOfficers(res.data);
    } catch (err) {
      showToast('Error loading officers list: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficers();
  }, []);

  const handleCreateOfficer = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.email || !formData.password || !formData.badge_number) {
      setFormError('All fields including Badge Number and Password are required.');
      return;
    }
    setFormError('');
    setActionLoading(true);
    try {
      await api.post('/auth/register', formData);
      showToast(`Officer @${formData.username} registered successfully.`);
      setIsCreating(false);
      setFormData({
        username: '',
        email: '',
        badge_number: '',
        password: '',
        role: 'INVESTIGATOR'
      });
      fetchOfficers();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to create officer account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (officerId, username) => {
    if (!isAdmin) {
      showToast('Only ADMIN can toggle officer activation status.');
      return;
    }
    try {
      await api.patch(`/auth/users/${officerId}/status`);
      showToast(`Status updated for officer: ${username}`);
      fetchOfficers();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update officer status.');
    }
  };

  const filteredOfficers = officers.filter(
    (o) =>
      o.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.badge_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-16 font-mono text-xs max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="p-4 bg-[#090d16] border border-cyan-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Law Enforcement Officer Roster & Access Control
            </h2>
            <p className="text-[11px] text-slate-400 font-sans">
              Authorized personnel directory, role permissions, and credential issuance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdminOrLead && (
            <button
              onClick={() => setIsCreating(true)}
              className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition text-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>Enroll New Officer</span>
            </button>
          )}
          <button
            onClick={fetchOfficers}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh Directory"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Enroll Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#090d16] border border-cyan-500/40 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <UserPlus className="w-4 h-4" />
                <span>Enroll New Investigation Officer</span>
              </div>
              <button
                onClick={() => setIsCreating(false)}
                className="text-slate-500 hover:text-slate-300 text-base"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateOfficer} className="space-y-3.5">
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                  Officer Username (ID)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. insp.verma"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0e1424] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                    Police / Gov Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="verma@police.gov.in"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0e1424] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                    Badge Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="DL-7821"
                    value={formData.badge_number}
                    onChange={(e) => setFormData({ ...formData, badge_number: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0e1424] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                  Temporary Access Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0e1424] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                  Assigned Security Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0e1424] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="INVESTIGATOR">INVESTIGATOR (Standard Case Access)</option>
                  <option value="LEAD_INVESTIGATOR">LEAD_INVESTIGATOR (Case Lead + Officer Enrollment)</option>
                  {isAdmin && <option value="ADMIN">ADMIN (Full System Administration)</option>}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-2"
                >
                  {actionLoading ? 'Enrolling...' : 'Confirm Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Officer Username, Badge Number, Email, or Role..."
            className="w-full pl-9 pr-4 py-2 bg-[#090d16] border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="text-slate-400 text-xs px-2">
          Total Authorized Officers: <span className="text-cyan-400 font-bold">{officers.length}</span>
        </div>
      </div>

      {/* Officers Table */}
      {loading ? (
        <Loader text="Loading Officer Directory..." />
      ) : (
        <div className="bg-[#090d16] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0e1424] text-[10px] text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Officer Identity</th>
                <th className="py-3 px-4">Badge Number</th>
                <th className="py-3 px-4">Official Email</th>
                <th className="py-3 px-4">Security Role</th>
                <th className="py-3 px-4">Account Status</th>
                {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredOfficers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="py-8 text-center text-slate-500">
                    No matching authorized officers found.
                  </td>
                </tr>
              ) : (
                filteredOfficers.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-900/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-200 flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{o.username}</span>
                        {currentUser?.username === o.username && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                            YOU
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono">
                      {o.badge_number || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {o.email}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] border ${
                          o.role === 'ADMIN'
                            ? 'bg-red-950/80 text-red-300 border-red-500/40'
                            : o.role === 'LEAD_INVESTIGATOR'
                            ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                            : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                        }`}
                      >
                        {o.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {o.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>ACTIVE</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-rose-400 text-[11px]">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>DEACTIVATED</span>
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right">
                        {currentUser?.id !== o.id && (
                          <button
                            onClick={() => handleToggleStatus(o.id, o.username)}
                            className={`px-2.5 py-1 rounded text-[10px] border transition ${
                              o.is_active
                                ? 'border-rose-500/40 text-rose-400 hover:bg-rose-950/40'
                                : 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/40'
                            }`}
                          >
                            {o.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
