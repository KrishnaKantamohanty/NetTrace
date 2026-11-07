import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea
} from 'recharts';

export default function TimelineChart({ hourlyData = [] }) {
  if (!hourlyData || hourlyData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs font-mono text-slate-500">
        No temporal data available.
      </div>
    );
  }

  const formattedData = hourlyData.map((d) => ({
    hour: `${String(d.hour).padStart(2, '0')}:00`,
    hourRaw: d.hour,
    Total: d.total,
    Voice: d.voice,
    SMS: d.sms,
    Duration: d.duration_minutes,
  }));

  return (
    <div className="w-full h-72">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">24-Hour Call Frequency Distribution</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/60 border border-rose-500/30 text-rose-400">
            Hazard Zone: 12 AM - 4 AM
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400"></div>
            <span className="text-slate-400">Voice Calls</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-400"></div>
            <span className="text-slate-400">SMS</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="88%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="voiceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="smsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="hour"
            stroke="#64748b"
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
          />
          {/* Highlight 12 AM to 4 AM hazard window */}
          <ReferenceArea
            x1="00:00"
            x2="04:00"
            stroke="#f43f5e"
            strokeOpacity={0.4}
            fill="#f43f5e"
            fillOpacity={0.08}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0b0f19',
              borderColor: '#1e293b',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '11px',
            }}
          />
          <Area
            type="monotone"
            dataKey="Voice"
            stroke="#06b6d4"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#voiceGradient)"
          />
          <Area
            type="monotone"
            dataKey="SMS"
            stroke="#8b5cf6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#smsGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
