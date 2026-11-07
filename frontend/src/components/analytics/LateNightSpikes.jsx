import React from 'react';
import { Moon, Clock, PhoneCall, Radio } from 'lucide-react';

export default function LateNightSpikes({ records = [] }) {
  if (!records || records.length === 0) {
    return (
      <div className="p-8 text-center text-xs font-mono text-slate-500">
        No late-night (12 AM - 4 AM) calls detected for this case.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-rose-400" />
          <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
            Late-Night Call Log (12:00 AM – 04:00 AM)
          </h4>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-500/30">
          {records.length} Suspicious Transactions
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40 max-h-80 overflow-y-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 sticky top-0">
            <tr>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">Caller (A)</th>
              <th className="py-2.5 px-3">Receiver (B)</th>
              <th className="py-2.5 px-3">Duration</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Tower ID</th>
              <th className="py-2.5 px-3">IMEI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {records.map((r, idx) => (
              <tr key={idx} className="hover:bg-rose-950/20 transition-colors">
                <td className="py-2 px-3 text-slate-300 flex items-center gap-1.5 whitespace-nowrap">
                  <Clock className="w-3 h-3 text-rose-400 shrink-0" />
                  {new Date(r.timestamp).toLocaleString()}
                </td>
                <td className="py-2 px-3 font-bold text-cyan-300">{r.caller}</td>
                <td className="py-2 px-3 text-slate-300">{r.receiver}</td>
                <td className="py-2 px-3 text-slate-400">{r.duration_seconds}s</td>
                <td className="py-2 px-3">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    r.call_type === 'SMS' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  }`}>
                    {r.call_type}
                  </span>
                </td>
                <td className="py-2 px-3 text-slate-400 text-[11px] truncate max-w-[120px]">{r.cell_tower_id || 'N/A'}</td>
                <td className="py-2 px-3 text-slate-400 text-[10px]">{r.imei || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
