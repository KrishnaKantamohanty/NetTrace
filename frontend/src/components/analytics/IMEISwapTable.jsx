import React from 'react';
import { Smartphone, RefreshCw, AlertTriangle, ShieldAlert, MapPin, Share2 } from 'lucide-react';
import { useCDRStore } from '../../store/useCDRStore';

export default function IMEISwapTable({ imeiData = { multi_sim_handsets: [], multi_imei_numbers: [] } }) {
  const { setActiveView, setSelectedSuspect, showToast } = useCDRStore();
  const handsets = imeiData?.multi_sim_handsets || [];
  const subscribers = imeiData?.multi_imei_numbers || [];

  const handleTraceRoute = (phone) => {
    setSelectedSuspect(phone);
    setActiveView('gis');
    showToast(`Loading GIS route movement playback for suspect ${phone}`);
  };

  const handleFocusGraph = (phone) => {
    setSelectedSuspect(phone);
    setActiveView('network');
    showToast(`Focusing suspect ${phone} on Network Link Graph`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Multi-SIM Handsets (Shared Devices) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
              Handset Sharing / Burner Swaps (1 IMEI Multiple SIMs)
            </h4>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-500/30">
            {handsets.length} Devices Flagged
          </span>
        </div>

        {handsets.length === 0 ? (
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-950/40 text-xs font-mono text-slate-500">
            No multi-SIM handset anomalies detected.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">IMEI Handset</th>
                  <th className="py-2.5 px-3">SIM Count</th>
                  <th className="py-2.5 px-3">Associated SIMs (Click to Investigate)</th>
                  <th className="py-2.5 px-3">Total Calls</th>
                  <th className="py-2.5 px-3">Suspicion Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {handsets.map((item, idx) => (
                  <tr key={idx} className="hover:bg-amber-950/10 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-amber-300">{item.imei}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-700/50 font-bold">
                        {item.sim_count} SIMs
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      <div className="flex flex-wrap gap-1.5">
                        {item.associated_sims.map((sim, sIdx) => (
                          <div
                            key={sIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300 text-[11px] hover:border-cyan-500/60 transition"
                          >
                            <span className="font-bold">{sim}</span>
                            <button
                              onClick={() => handleTraceRoute(sim)}
                              title={`Trace ${sim} on GIS Map`}
                              className="text-slate-400 hover:text-rose-400 transition"
                            >
                              <MapPin className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleFocusGraph(sim)}
                              title={`Locate ${sim} in Link Graph`}
                              className="text-slate-400 hover:text-cyan-400 transition"
                            >
                              <Share2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{item.total_calls}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-amber-400 h-full rounded-full"
                            style={{ width: `${item.suspicious_score * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-amber-400 font-bold">{Math.round(item.suspicious_score * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Multi-IMEI Subscribers (SIM Hopping) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
              Handset Hopping (1 SIM Swapped into Multiple IMEIs)
            </h4>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30">
            {subscribers.length} SIMs Flagged
          </span>
        </div>

        {subscribers.length === 0 ? (
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-950/40 text-xs font-mono text-slate-500">
            No subscriber handset hopping detected.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Phone Number</th>
                  <th className="py-2.5 px-3">IMEI Count</th>
                  <th className="py-2.5 px-3">Associated IMEI Handsets</th>
                  <th className="py-2.5 px-3">Activity Window</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {subscribers.map((item, idx) => (
                  <tr key={idx} className="hover:bg-cyan-950/10 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-cyan-300">
                      <div className="inline-flex items-center gap-1.5">
                        <span>{item.phone_number}</span>
                        <button
                          onClick={() => handleTraceRoute(item.phone_number)}
                          title={`Trace ${item.phone_number} on GIS Map`}
                          className="text-slate-400 hover:text-rose-400 transition"
                        >
                          <MapPin className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleFocusGraph(item.phone_number)}
                          title={`Locate ${item.phone_number} in Link Graph`}
                          className="text-slate-400 hover:text-cyan-400 transition"
                        >
                          <Share2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-700/50 font-bold">
                        {item.imei_count} IMEIs
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      <div className="flex flex-wrap gap-1">
                        {item.associated_imeis.map((imei, iIdx) => (
                          <span key={iIdx} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                            {imei}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                      {new Date(item.first_seen).toLocaleDateString()} – {new Date(item.last_seen).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
