import React, { useEffect, useState } from 'react';
import { Smartphone, RefreshCw, Calendar, ShieldAlert, Cpu, ArrowRight } from 'lucide-react';
import { cdrService } from '../../services/cdrService';

export default function IMEISIMTimelineMatrix({ caseId, targetPhone }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState(targetPhone || '');

  useEffect(() => {
    async function fetchTimeline() {
      if (!caseId) return;
      try {
        setLoading(true);
        const res = await cdrService.getIMEISIMTimeline(caseId, filterText || null);
        setData(res);
      } catch (err) {
        console.warn('Failed to load IMEI-SIM timeline:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTimeline();
  }, [caseId, filterText]);

  const timeline = data?.timeline || [];

  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-purple-400" />
          <h4 className="font-bold text-slate-200 uppercase tracking-wider text-xs">
            IMEI-SIM SWAP LIFESPAN & DEVICE TIMELINE MATRIX
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter MSISDN / IMEI..."
            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 outline-none w-36 text-[10px]"
          />
          <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
            {timeline.length} Pairings
          </span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-500 animate-pulse text-[11px]">
          Reconstructing hardware IMEI and SIM card temporal lifespans...
        </div>
      ) : timeline.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-[11px]">
          No IMEI-SIM associations found matching criteria.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 text-[10px] uppercase">
                <th className="py-2 px-2.5">SIM MSISDN</th>
                <th className="py-2 px-2.5">Hardware IMEI</th>
                <th className="py-2 px-2.5">Device Make</th>
                <th className="py-2 px-2.5">Active Range (First → Last)</th>
                <th className="py-2 px-2.5 text-center">Span</th>
                <th className="py-2 px-2.5 text-center">Events</th>
                <th className="py-2 px-2.5 text-right">Classification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {timeline.map((item) => (
                <tr key={item.id} className="hover:bg-slate-900/50 transition">
                  <td className="py-2 px-2.5 font-bold text-cyan-300">
                    {item.sim_msisdn}
                  </td>
                  <td className="py-2 px-2.5 text-slate-300 font-mono text-[10px]">
                    {item.imei}
                  </td>
                  <td className="py-2 px-2.5 text-slate-400 text-[10px]">
                    {item.device_model}
                  </td>
                  <td className="py-2 px-2.5 text-[10px] text-slate-300">
                    <div className="flex items-center gap-1">
                      <span>{item.first_seen.slice(0, 10)}</span>
                      <ArrowRight className="w-2.5 h-2.5 text-slate-500" />
                      <span>{item.last_seen.slice(0, 10)}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2.5 text-center text-slate-400 text-[10px]">
                    {item.duration_days}d
                  </td>
                  <td className="py-2 px-2.5 text-center font-bold text-slate-200">
                    {item.total_events}
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <span
                      style={{ color: item.tag_color, borderColor: `${item.tag_color}50` }}
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider bg-black/40 inline-block"
                    >
                      {item.swap_category.split(' ')[0]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
