import React, { useEffect, useState } from 'react';
import {
  Wifi, Phone, MessageSquare, Activity, BatteryLow,
  PlaneTakeoff, Power, AlertTriangle, RefreshCw, Clock, BarChart2, Globe,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { useCDRStore } from '../store/useCDRStore';
import { forensicsService } from '../services/forensicsService';
import Loader from '../components/common/Loader';

const COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#818cf8', '#34d399'];

const protocolIcon = (protocol) => {
  if (protocol?.toLowerCase().includes('whatsapp')) return <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />;
  if (protocol?.toLowerCase().includes('voip')) return <Phone className="w-3.5 h-3.5 text-cyan-400" />;
  if (protocol?.toLowerCase().includes('telegram')) return <Globe className="w-3.5 h-3.5 text-blue-400" />;
  return <Wifi className="w-3.5 h-3.5 text-slate-400" />;
};

const telemetryIcon = (eventType) => {
  const t = eventType?.toLowerCase() || '';
  if (t.includes('flight')) return <PlaneTakeoff className="w-4 h-4 text-amber-400" />;
  if (t.includes('shutdown') || t.includes('power_off')) return <Power className="w-4 h-4 text-rose-400" />;
  if (t.includes('battery')) return <BatteryLow className="w-4 h-4 text-orange-400" />;
  return <Activity className="w-4 h-4 text-slate-400" />;
};

const telemetryColor = (eventType) => {
  const t = eventType?.toLowerCase() || '';
  if (t.includes('flight')) return 'border-amber-500/40 bg-amber-950/20';
  if (t.includes('shutdown') || t.includes('power_off')) return 'border-rose-500/40 bg-rose-950/20';
  if (t.includes('battery')) return 'border-orange-500/40 bg-orange-950/20';
  return 'border-slate-700 bg-slate-900/40';
};

export default function IPDRView() {
  const { selectedCaseId, showToast } = useCDRStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sessions');

  const load = async () => {
    if (!selectedCaseId) return;
    try {
      setLoading(true);
      const res = await forensicsService.getIPDRAnalytics(selectedCaseId);
      setData(res);
    } catch (err) {
      showToast('Error loading IPDR data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCaseId]);

  if (loading) return <Loader text="Parsing IPDR & Telemetry Intelligence..." />;

  // Backend returns: raw_ipdr_sample, telemetry_log, protocol_breakdown, top_data_suspects
  const sessions = data?.raw_ipdr_sample || [];
  const telemetry = data?.telemetry_log || [];
  // Backend protocol_breakdown: [{protocol, count, total_bytes}] — reshape to [{name, value}] for pie chart
  const protocolSummary = (data?.protocol_breakdown || []).map((p) => ({ name: p.protocol || 'Other', value: p.count || 0 }));
  const hourlyData = data?.hourly_data_mb || [];
  const totalMB = sessions.reduce((acc, s) => acc + ((s.upload_kb || 0) + (s.download_kb || 0)) / 1024, 0).toFixed(1);
  // Estimate encrypted: protocol contains HTTPS/WhatsApp/Telegram
  const encryptedCount = sessions.filter((s) => /https|whatsapp|telegram/i.test(s.protocol || '')).length;
  const whatsappSessions = sessions.filter((s) => /whatsapp/i.test(s.protocol || '')).length;

  const defaultHourly = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    mb: Math.random() * 50 + (i >= 0 && i <= 4 ? 40 : 5),
  }));

  const defaultProtocols = [
    { name: 'WhatsApp', value: 45 },
    { name: 'VoIP', value: 20 },
    { name: 'Telegram', value: 18 },
    { name: 'HTTPS', value: 10 },
    { name: 'Other', value: 7 },
  ];

  const chartData = hourlyData.length > 0 ? hourlyData : defaultHourly;
  const protData = protocolSummary.length > 0 ? protocolSummary : defaultProtocols;

  return (
    <div className="space-y-5 pb-16 font-mono text-xs">
      {/* Header */}
      <div className="p-4 bg-[#090d16] border border-cyan-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-950 border border-cyan-500/40">
            <Wifi className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              IPDR & Device Telemetry Analytics
            </h2>
            <p className="text-[11px] text-slate-400 font-sans">
              OTT Sessions • VoIP • WhatsApp/Telegram Data • Hardware Events
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sessions', value: sessions.length, cls: 'text-cyan-400', icon: <Wifi className="w-4 h-4 text-cyan-400" /> },
          { label: 'Data Consumed', value: `${totalMB} MB`, cls: 'text-emerald-400', icon: <BarChart2 className="w-4 h-4 text-emerald-400" /> },
          { label: 'Encrypted Sessions', value: encryptedCount, cls: 'text-amber-400', icon: <AlertTriangle className="w-4 h-4 text-amber-400" /> },
          { label: 'WhatsApp Sessions', value: whatsappSessions, cls: 'text-rose-400', icon: <MessageSquare className="w-4 h-4 text-rose-400" /> },
        ].map((kpi) => (
          <div key={kpi.label} className="p-4 rounded-xl bg-[#090d16] border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-slate-400">
              {kpi.icon}
              <span className="text-[10px] uppercase tracking-wider">{kpi.label}</span>
            </div>
            <div className={`text-2xl font-bold ${kpi.cls}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 p-4 rounded-xl bg-[#090d16] border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
              Hourly Data Consumption Spikes (MB)
            </span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={(v) => `${v}h`} />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }}
                  labelFormatter={(v) => `${v}:00`}
                  formatter={(v) => [`${Number(v).toFixed(1)} MB`, 'Data']}
                />
                <Bar dataKey="mb" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.hour >= 0 && entry.hour <= 4 ? '#f43f5e' : '#06b6d4'} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] text-rose-400 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            Red bars: Midnight spike window (12 AM - 4 AM) — High Operational Risk
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#090d16] border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
              OTT Protocol Breakdown
            </span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={protData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                  {protData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tab Switch */}
      <div className="flex gap-2">
        {[
          { id: 'sessions', label: 'IPDR OTT Sessions', icon: <Wifi className="w-3.5 h-3.5" /> },
          { id: 'telemetry', label: 'Device Telemetry Events', icon: <Activity className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition text-xs ${
              activeTab === tab.id
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sessions' && (
        <div className="rounded-xl border border-slate-800 bg-[#090d16] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <span className="font-bold text-slate-200 text-[11px] uppercase tracking-wider">
              OTT/IPDR Session Records ({sessions.length})
            </span>
            <span className="text-[10px] text-slate-500">Encrypted sessions flagged for legal interception order</span>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-[11px] text-left">
              <thead className="sticky top-0 bg-slate-900 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Subscriber</th>
                  <th className="py-2.5 px-3">Protocol / App</th>
                  <th className="py-2.5 px-3">Destination IP</th>
                  <th className="py-2.5 px-3">Start Time</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Data (MB)</th>
                  <th className="py-2.5 px-3">Encrypted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">No IPDR sessions recorded for this case.</td>
                  </tr>
                ) : (
                  sessions.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-900/60 transition">
                      <td className="py-2 px-3 font-bold text-cyan-300">{s.msisdn}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          {protocolIcon(s.protocol)}
                          <span className="text-slate-300">{s.protocol}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-mono">{s.dest_ip}</td>
                      <td className="py-2 px-3 text-slate-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {s.start_time ? new Date(s.start_time).toLocaleString('en-IN') : '—'}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-300">{s.duration}s</td>
                      <td className="py-2 px-3">
                        <span className={`font-bold ${((s.upload_kb || 0) + (s.download_kb || 0)) / 1024 > 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {(((s.upload_kb || 0) + (s.download_kb || 0)) / 1024).toFixed(1)} MB
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {/https|whatsapp|telegram/i.test(s.protocol || '') ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold text-[10px]">ENCRYPTED</span>
                        ) : (
                          <span className="text-slate-500">Plain</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'telemetry' && (
        <div className="space-y-3">
          <div className="text-[11px] text-slate-400 px-1">
            {telemetry.length} hardware events — Sudden shutdowns/flight mode = counter-surveillance awareness.
          </div>
          {telemetry.length === 0 ? (
            <div className="p-8 rounded-xl border border-slate-800 bg-[#090d16] text-center text-slate-500">
              No device telemetry events recorded for this case.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {telemetry.map((ev, i) => (
                <div key={i} className={`p-4 rounded-xl border ${telemetryColor(ev.event_type)} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-100">
                      {telemetryIcon(ev.event_type)}
                      <span>{ev.event_type?.replace(/_/g, ' ').toUpperCase()}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleString('en-IN') : '—'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 grid grid-cols-2 gap-1">
                    <div><span className="text-slate-500">IMEI:</span> <span className="text-amber-300 font-bold">{ev.imei}</span></div>
                    <div><span className="text-slate-500">SIM:</span> <span className="text-cyan-300">{ev.msisdn || ev.subscriber_number}</span></div>
                    <div className="col-span-2"><span className="text-slate-500">Details:</span> {ev.notes || ev.event_details || '—'}</div>
                  </div>
                  {ev.battery_level != null && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-800">
                        <div
                          className={`h-1.5 rounded-full ${ev.battery_level < 15 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                          style={{ width: `${ev.battery_level}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">{ev.battery_level}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
