import React from 'react';
import { Sliders, Maximize2, GitMerge, Route, RefreshCw, Search, Filter, X } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';

export default function GraphToolbar({
  onOpenCommonContacts,
  onOpenShortestPath,
  totalNodes = 0,
  totalEdges = 0,
  onRefresh,
  searchQuery = '',
  onSearchChange,
  onSearchSubmit,
  filterHubsOnly = false,
  onToggleHubsOnly,
}) {
  const { minWeight, setMinWeight, layoutName, setLayoutName } = useGraphStore();

  const layouts = [
    { id: 'cose', label: 'Force (COSE)' },
    { id: 'concentric', label: 'Concentric' },
    { id: 'circle', label: 'Circular' },
    { id: 'breadthfirst', label: 'Hierarchical' },
  ];

  return (
    <div className="p-3 bg-[#090d16] border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Instant Suspect Search */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 focus-within:border-cyan-500 rounded-lg px-2.5 py-1 transition-colors">
          <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit && onSearchSubmit()}
            placeholder="Search suspect phone..."
            className="bg-transparent text-slate-200 outline-none w-36 text-[11px] placeholder:text-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange && onSearchChange('')}
              className="text-slate-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Hubs Only Filter */}
        <button
          onClick={onToggleHubsOnly}
          className={`px-2.5 py-1 rounded-lg text-[10px] border flex items-center gap-1.5 transition ${
            filterHubsOnly
              ? 'bg-cyan-950 text-cyan-300 border-cyan-500 font-bold shadow-sm shadow-cyan-500/20'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
          }`}
          title="Isolate core syndicate hubs (degree >= 3)"
        >
          <Filter className="w-3 h-3" />
          <span>Core Hubs Only</span>
        </button>

        <div className="h-4 w-px bg-slate-800 hidden md:block"></div>

        {/* Min Edge Weight Filter */}
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400 text-[11px]">Min Calls:</span>
          <span className="font-bold text-cyan-300 w-4">{minWeight}</span>
          <input
            type="range"
            min={1}
            max={15}
            value={minWeight}
            onChange={(e) => setMinWeight(Number(e.target.value))}
            className="w-20 accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
          />
        </div>

        <div className="h-4 w-px bg-slate-800 hidden md:block"></div>

        {/* Layout Switcher */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-[11px] hidden sm:inline">Layout:</span>
          <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800">
            {layouts.map((l) => (
              <button
                key={l.id}
                onClick={() => setLayoutName(l.id)}
                className={`px-2 py-0.5 rounded text-[10px] transition ${
                  layoutName === l.id
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Network Algorithms triggers */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenCommonContacts}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-950 hover:text-cyan-300 text-slate-300 border border-slate-700 flex items-center gap-1.5 text-[11px] transition"
        >
          <GitMerge className="w-3.5 h-3.5 text-cyan-400" />
          Common Contacts
        </button>

        <button
          onClick={onOpenShortestPath}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 border border-slate-700 flex items-center gap-1.5 text-[11px] transition"
        >
          <Route className="w-3.5 h-3.5 text-rose-400" />
          Shortest Path
        </button>

        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          title="Reload Graph"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <div className="text-[10px] text-slate-400 pl-2">
          <b>{totalNodes}</b> Nodes • <b>{totalEdges}</b> Edges
        </div>
      </div>
    </div>
  );
}
