import React from 'react';
import { Award, Target, GitCommit, Zap } from 'lucide-react';

export default function CentralityRanks({ rankedNodes = [], onSelectNode, selectedNodeId = null }) {
  if (!rankedNodes || rankedNodes.length === 0) {
    return (
      <div className="p-4 text-xs font-mono text-slate-500">
        No centrality ranks computed yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-cyan-400" />
          <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
            Network Centrality & Hub Leaderboard
          </h4>
        </div>
        <span className="text-[10px] text-slate-400">Top {rankedNodes.length} Nodes</span>
      </div>

      <div className="overflow-y-auto max-h-72 space-y-1.5 pr-1">
        {rankedNodes.map((n, idx) => {
          const isSelected = selectedNodeId === n.id;
          return (
            <div
              key={n.id}
              onClick={() => onSelectNode && onSelectNode(n)}
              className={`p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                isSelected
                  ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-sm'
                  : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] w-4 text-slate-400 font-bold">#{idx + 1}</span>
                <div>
                  <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <span>{n.id}</span>
                    {n.is_hub && (
                      <span className="text-[9px] px-1 rounded bg-cyan-950 text-cyan-400 border border-cyan-700/60 font-semibold">
                        HUB
                      </span>
                    )}
                    {n.is_bridge && (
                      <span className="text-[9px] px-1 rounded bg-amber-950 text-amber-400 border border-amber-700/60 font-semibold">
                        BRIDGE
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>Calls: {n.total_calls}</span>
                    <span>•</span>
                    <span>Late: <b className="text-rose-400">{n.late_night_calls}</b></span>
                    <span>•</span>
                    <span>Op: {n.operator}</span>
                  </div>
                </div>
              </div>

              <div className="text-right text-[10px]">
                <div className="text-cyan-400 font-bold">Deg: {n.degree_centrality}</div>
                <div className="text-amber-400">Btw: {n.betweenness_centrality}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
