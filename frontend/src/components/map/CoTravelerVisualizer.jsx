import React, { useEffect, useState } from 'react';
import { Navigation, Users, Clock, MapPin, Shield, CheckCircle, ChevronRight } from 'lucide-react';
import { cdrService } from '../../services/cdrService';

export default function CoTravelerVisualizer({ caseId, targetPhone, onSelectCompanion }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [windowMins, setWindowMins] = useState(30);
  const [expandedIndex, setExpandedIndex] = useState(null);

  useEffect(() => {
    async function fetchCoTravelers() {
      if (!caseId) return;
      try {
        setLoading(true);
        const res = await cdrService.getCoTravelers(caseId, targetPhone || null, windowMins);
        setData(res);
      } catch (err) {
        console.warn('Failed to load co-travelers:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCoTravelers();
  }, [caseId, targetPhone, windowMins]);

  const travelers = data?.co_travelers || [];

  return (
    <div className="space-y-3 font-mono text-xs flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-emerald-400" />
          <h4 className="font-bold text-slate-200 uppercase tracking-wider text-xs">
            CO-TRAVELER SPATIO-TEMPORAL CONVOY FINDER
          </h4>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-slate-400">Delta Window:</span>
          <select
            value={windowMins}
            onChange={(e) => setWindowMins(parseInt(e.target.value))}
            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-300 outline-none"
          >
            <option value="15">± 15 Mins</option>
            <option value="30">± 30 Mins</option>
            <option value="60">± 60 Mins</option>
            <option value="120">± 2 Hours</option>
          </select>
        </div>
      </div>

      <div className="text-[10px] text-slate-400">
        Compares cellular checkpoint sequences of devices moving in tandem across the same cell towers within the temporal window.
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500 animate-pulse text-[11px]">
          Correlating chronological trajectories across cell tower sectors...
        </div>
      ) : travelers.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-[11px]">
          No co-traveling companion devices detected within ±{windowMins} minutes window.
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto flex-1 pr-1">
          {travelers.map((t, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 hover:border-emerald-500/40 transition space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-bold text-slate-100 text-[11px]">{t.companion_msisdn}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      t.confidence === 'HIGH'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                        : 'bg-amber-950 text-amber-400 border border-amber-500/40'
                    }`}
                  >
                    {t.confidence} CONFIDENCE
                  </span>
                </div>
                <div className="text-emerald-400 font-bold text-[11px]">
                  {t.shared_tower_count} Shared Towers
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Correlation Score: <b className="text-cyan-300">{(t.co_travel_score * 100).toFixed(0)}%</b></span>
                <button
                  type="button"
                  onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
                  className="text-cyan-400 hover:underline flex items-center gap-0.5 text-[10px]"
                >
                  {expandedIndex === idx ? 'Hide Checkpoints' : 'View Checkpoints'}
                  <ChevronRight className={`w-3 h-3 transform transition ${expandedIndex === idx ? 'rotate-90' : ''}`} />
                </button>
              </div>

              {/* Checkpoint breakdown */}
              {expandedIndex === idx && (
                <div className="space-y-1.5 pt-1.5 border-t border-slate-800 text-[9px]">
                  {t.checkpoints.map((cp, cIdx) => (
                    <div key={cIdx} className="p-1.5 rounded bg-black/40 border border-slate-800/80 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-300">{cp.tower_id}</div>
                        <div className="text-slate-500">
                          Target: {cp.target_timestamp.replace('T', ' ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-400 font-bold">Δt: {cp.time_gap_minutes}m</div>
                        <div className="text-slate-500">Dist: {cp.distance_km} km</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
