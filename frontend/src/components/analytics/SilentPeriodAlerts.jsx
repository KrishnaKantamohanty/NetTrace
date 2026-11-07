import React, { useEffect, useState } from 'react';
import { Moon, AlertTriangle, ShieldAlert, Radio, ArrowRight, Clock, MapPin } from 'lucide-react';
import { cdrService } from '../../services/cdrService';

export default function SilentPeriodAlerts({ caseId, targetPhone }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [minHours, setMinHours] = useState(3.0);

  useEffect(() => {
    async function fetchSilentPeriods() {
      if (!caseId) return;
      try {
        setLoading(true);
        const res = await cdrService.getSilentPeriods(caseId, targetPhone || null, minHours);
        setData(res);
      } catch (err) {
        console.warn('Failed to load silent periods:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSilentPeriods();
  }, [caseId, targetPhone, minHours]);

  const periods = data?.silent_periods || [];

  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-amber-400" />
          <h4 className="font-bold text-slate-200 uppercase tracking-wider text-xs">
            SILENT PERIOD & RADIO INACTIVITY ALERTS
          </h4>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-slate-400">Min Silence:</span>
          <select
            value={minHours}
            onChange={(e) => setMinHours(parseFloat(e.target.value))}
            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 outline-none"
          >
            <option value="1.0">≥ 1 Hour</option>
            <option value="3.0">≥ 3 Hours</option>
            <option value="6.0">≥ 6 Hours</option>
            <option value="12.0">≥ 12 Hours</option>
            <option value="24.0">≥ 24 Hours</option>
          </select>
          <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-500/30 font-bold">
            {periods.length} Alert{periods.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-500 animate-pulse text-[11px]">
          Scanning CDR timeline for activity blackouts & flight mode intervals...
        </div>
      ) : periods.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-[11px]">
          No suspicious radio blackout intervals detected above {minHours} hours threshold.
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {periods.map((p, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-lg border transition ${
                p.severity === 'CRITICAL'
                  ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                  : p.severity === 'HIGH'
                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-100 text-[11px]">{p.target_msisdn}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                      p.severity === 'CRITICAL'
                        ? 'bg-rose-900/80 text-rose-300 border border-rose-500/50'
                        : p.severity === 'HIGH'
                        ? 'bg-amber-900/80 text-amber-300 border border-amber-500/50'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {p.severity} ({p.suspicion_score}/100)
                  </span>
                </div>
                <div className="flex items-center gap-1 font-bold text-amber-400 text-[11px]">
                  <Clock className="w-3 h-3" />
                  <span>{p.gap_duration_formatted} Blackout</span>
                </div>
              </div>

              {/* Event Transition */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] bg-black/40 p-1.5 rounded border border-slate-800/80 mb-1.5">
                <div>
                  <span className="text-slate-400">Offline Onset: </span>
                  <span className="text-slate-200 font-semibold">{p.gap_start.replace('T', ' ')}</span>
                  <div className="text-[9px] text-slate-400 truncate">
                    Tower: {p.last_known_event.tower_id}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Reappearance: </span>
                  <span className="text-emerald-400 font-semibold">{p.gap_end.replace('T', ' ')}</span>
                  <div className="text-[9px] text-slate-400 truncate">
                    Tower: {p.reappearance_event.tower_id}
                  </div>
                </div>
              </div>

              {/* Meta metrics */}
              <div className="flex flex-wrap items-center justify-between gap-1 text-[9px] text-slate-400">
                {p.displacement_km !== null && (
                  <div className="flex items-center gap-1 text-cyan-300">
                    <MapPin className="w-2.5 h-2.5" />
                    <span>Displacement: <b>{p.displacement_km} km</b></span>
                  </div>
                )}
                <div className="text-slate-400">
                  {p.suspicion_reasons?.[0] || 'Inactivity threshold exceeded'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
