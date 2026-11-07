import React from 'react';
import { LayoutDashboard, Share2, MapPin, FileCheck2, Wifi, Mic, ShieldAlert, ChevronRight } from 'lucide-react';
import { useCDRStore } from '../../store/useCDRStore';

export default function Sidebar() {
  const { activeView, setActiveView } = useCDRStore();

  const navGroups = [
    {
      label: 'Core Intelligence',
      items: [
        { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
        { id: 'network', label: 'Network Link Graph', icon: Share2, badge: 'Graph' },
        { id: 'gis', label: 'Geo-Spatial GIS Map', icon: MapPin, badge: 'Towers' },
      ],
    },
    {
      label: 'Advanced Forensics',
      items: [
        { id: 'ipdr', label: 'IPDR & Telemetry', icon: Wifi, badge: 'New' },
        { id: 'speech', label: 'Speech & OCR', icon: Mic, badge: 'AI' },
        { id: 'forensics', label: 'Evidence Report', icon: FileCheck2 },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-[#070b14] border-r border-slate-800/80 flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)] sticky top-16">
      <div className="p-4 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 px-3 mb-1.5 font-bold">
              {group.label}
            </div>
            <nav className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-mono font-medium transition-all ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${
                        item.badge === 'New' || item.badge === 'AI'
                          ? 'bg-purple-950 text-purple-300 border-purple-700'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}

        {/* Tactical Status Panel */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-cyan-500/20 font-mono text-xs space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-[11px]">
            <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
            <span>Forensic Engine Status</span>
          </div>
          <div className="text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Ingestion:</span>
              <span className="text-emerald-400">ONLINE</span>
            </div>
            <div className="flex justify-between">
              <span>Graph Linker:</span>
              <span className="text-emerald-400">READY</span>
            </div>
            <div className="flex justify-between">
              <span>GIS Engine:</span>
              <span className="text-cyan-400">ACTIVE</span>
            </div>
            <div className="flex justify-between">
              <span>AI Whisper:</span>
              <span className="text-purple-400">STANDBY</span>
            </div>
            <div className="flex justify-between">
              <span>OSINT Engine:</span>
              <span className="text-emerald-400">READY</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-900 text-[10px] font-mono text-slate-400 space-y-1">
        <div className="text-slate-400">Indian Telecom Parser V3</div>
        <div className="text-slate-500">Airtel • Jio • Vodafone Idea</div>
      </div>
    </aside>
  );
}
