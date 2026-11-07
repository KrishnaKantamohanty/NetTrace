import React from 'react';

export default function StatsCard({ title, value, subtitle, icon: Icon, color = 'cyan', alert = false }) {
  const colorMap = {
    cyan: 'border-cyan-500/30 text-cyan-400 bg-cyan-950/20',
    rose: 'border-rose-500/30 text-rose-400 bg-rose-950/20',
    amber: 'border-amber-500/30 text-amber-400 bg-amber-950/20',
    emerald: 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20',
    purple: 'border-purple-500/30 text-purple-400 bg-purple-950/20',
  };

  const badgeClass = colorMap[color] || colorMap.cyan;

  return (
    <div className={`p-4 rounded-xl cyber-card relative overflow-hidden transition-all duration-300 hover:border-slate-700 ${alert ? 'border-rose-500/40 shadow-rose-950/30' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-1">
            {title}
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            {value}
          </div>
          {subtitle && (
            <div className="text-[11px] text-slate-400 font-sans mt-1">
              {subtitle}
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg border ${badgeClass}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {alert && (
        <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-rose-500 animate-ping mr-2 mt-2"></div>
      )}
    </div>
  );
}
