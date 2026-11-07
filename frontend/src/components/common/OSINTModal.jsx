import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Shield, User, Smartphone, CreditCard, MessageSquare,
  Globe, AlertTriangle, Link, RefreshCw, ChevronRight, ExternalLink,
} from 'lucide-react';
import { useCDRStore } from '../../store/useCDRStore';
import { forensicsService } from '../../services/forensicsService';

const riskColor = (score) => {
  if (score >= 75) return { bar: 'bg-rose-500', text: 'text-rose-400', label: 'CRITICAL RISK' };
  if (score >= 50) return { bar: 'bg-amber-500', text: 'text-amber-400', label: 'HIGH RISK' };
  if (score >= 25) return { bar: 'bg-yellow-500', text: 'text-yellow-300', label: 'MODERATE' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-400', label: 'LOW RISK' };
};

export default function OSINTModal({ phone, onClose }) {
  const { selectedCaseId, showToast } = useCDRStore();
  const [profile, setProfile] = useState(null);
  const [crossCase, setCrossCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profile');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    async function load() {
      if (!phone) return;
      try {
        setLoading(true);
        const [profRes, crossRes] = await Promise.allSettled([
          forensicsService.getOSINTProfile(phone),
          forensicsService.getCrossCaseCorrelations(selectedCaseId, phone),
        ]);
        if (profRes.status === 'fulfilled') setProfile(profRes.value);
        if (crossRes.status === 'fulfilled') setCrossCase(crossRes.value);
      } catch (err) {
        showToast('Error loading OSINT profile: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [phone, selectedCaseId]);

  const risk = riskColor(profile?.risk_score || profile?.ml_risk_score || 0);
  const riskScore = profile?.risk_score ?? profile?.ml_risk_score;
  const behavioralFlags = profile?.behavioral_tags || profile?.behavioral_flags || [];
  const knownImeis = profile?.known_imeis || [];

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0b0f19] border border-cyan-500/30 rounded-2xl w-full max-w-2xl shadow-2xl font-mono text-xs overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center">
              <User className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="font-extrabold text-slate-100 text-sm tracking-wider">{phone}</div>
              <div className="text-[10px] text-slate-400">
                OSINT Intelligence Profile • Truecaller • UPI • Social
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 px-5 pt-3 shrink-0">
          {[
            { id: 'profile', label: 'OSINT Profile' },
            { id: 'crosscase', label: `Cross-Case Links ${crossCase?.length ? `(${crossCase.length})` : ''}` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg font-bold transition text-xs ${
                tab === t.id
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Loading OSINT Intelligence...
            </div>
          ) : tab === 'profile' ? (
            <>
              {/* Risk Score */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">ML Risk Score</span>
                  </div>
                  <span className={`text-lg font-extrabold ${risk.text}`}>
                    {riskScore ?? '—'}/100 — {risk.label}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full ${risk.bar} transition-all duration-700`}
                    style={{ width: `${riskScore ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Identity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
                    <User className="w-3 h-3" /> Truecaller Name
                  </div>
                  <div className="font-bold text-slate-100">{profile?.truecaller_name || 'Unknown'}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Operator / Circle
                  </div>
                  <div className="font-bold text-slate-100">{profile?.carrier_circle || profile?.operator || '—'}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-emerald-400" /> WhatsApp Status
                  </div>
                  <div className={`font-bold ${profile?.whatsapp_active ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {profile?.whatsapp_active ? 'ACTIVE' : 'Inactive / Not Registered'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
                    <Globe className="w-3 h-3 text-blue-400" /> Telegram Handle
                  </div>
                  <div className="font-bold text-blue-300">{profile?.telegram_handle || 'Not Found'}</div>
                </div>
              </div>

              {/* UPI Handles */}
              {profile?.upi_handles?.length > 0 && (
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                  <div className="text-[9px] text-slate-500 uppercase flex items-center gap-1 font-bold">
                    <CreditCard className="w-3 h-3 text-amber-400" /> UPI Payment Handles
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profile.upi_handles.map((upi, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-amber-950/40 border border-amber-500/30 text-amber-300 font-mono">
                        {upi}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* IMEIs */}
              {profile?.known_imeis?.length > 0 && (
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                  <div className="text-[9px] text-slate-500 uppercase flex items-center gap-1 font-bold">
                    <Smartphone className="w-3 h-3 text-amber-400" /> Known IMEI Devices
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profile.known_imeis.map((im, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-amber-300 font-mono text-[11px]">
                        {im}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Behavioral Flags / Tags */}
              {behavioralFlags.length > 0 && (
                <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 space-y-2">
                  <div className="text-[9px] text-rose-400 uppercase font-bold">Behavioral Anomaly Flags</div>
                  <div className="space-y-1">
                    {behavioralFlags.map((flag, i) => (
                      <div key={i} className="flex items-center gap-2 text-rose-300">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {flag}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Cross-Case Tab */
            <div className="space-y-3">
              <div className="text-[11px] text-slate-400">
                Checking if <b className="text-cyan-300">{phone}</b> appeared in previous investigations...
              </div>
              {!crossCase || crossCase.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center text-slate-500">
                  No historical cross-case matches found for this subscriber.
                </div>
              ) : (
                crossCase.map((item, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-900 border border-amber-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-amber-300">
                        <Link className="w-3.5 h-3.5" />
                        {item.case_id}
                      </div>
                      <span className="text-[10px] text-slate-400">{item.case_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Appeared as: <b className="text-rose-300">{item.role}</b> with{' '}
                      <b className="text-cyan-300">{item.interaction_count}</b> interactions.
                    </div>
                    <div className="text-[10px] text-slate-400">
                      First seen: {item.first_seen} • Last seen: {item.last_seen}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
