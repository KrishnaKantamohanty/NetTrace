import React, { useState } from 'react';
import { Radio, Crosshair, Users, MapPin, Search } from 'lucide-react';
import { cdrService } from '../../services/cdrService';
import { useCDRStore } from '../../store/useCDRStore';

export default function TowerDumpVisualizer({ availableTowers = [], onSelectSuspect }) {
  const { selectedCaseId, showToast } = useCDRStore();
  const [selectedTowers, setSelectedTowers] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggleTower = (id) => {
    if (selectedTowers.includes(id)) {
      setSelectedTowers(selectedTowers.filter((t) => t !== id));
    } else {
      setSelectedTowers([...selectedTowers, id]);
    }
  };

  const handleRunDump = async () => {
    if (selectedTowers.length === 0) {
      showToast('Please select at least 1 cell tower to run dump analysis.');
      return;
    }
    try {
      setLoading(true);
      const res = await cdrService.runTowerDump(selectedCaseId, {
        tower_ids: selectedTowers,
      });
      setResults(res);
      showToast(`Dump completed: ${res.unique_numbers_found} subscribers identified.`);
    } catch (err) {
      showToast('Error analyzing tower dump: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-cyan-400" />
          <h4 className="font-bold text-slate-200 uppercase tracking-wider">
            Multi-Tower Dump Intersection Engine
          </h4>
        </div>
      </div>

      {/* Tower Selector checkboxes */}
      <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-2">
        <div className="text-[11px] text-slate-400">
          Select target cell towers to find co-located subscribers across crime sites:
        </div>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
          {availableTowers.map((tw) => {
            const isSelected = selectedTowers.includes(tw.tower_id);
            return (
              <button
                key={tw.tower_id}
                onClick={() => toggleTower(tw.tower_id)}
                className={`px-2.5 py-1 rounded-md text-[11px] border transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500 font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <Radio className={`w-3 h-3 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tw.tower_id}</span>
                <span className="text-[9px] text-slate-500">({tw.total_hits})</span>
              </button>
            );
          })}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleRunDump}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-2 shadow-sm transition"
          >
            <Search className="w-3.5 h-3.5" />
            {loading ? 'Analyzing Intersections...' : 'Find Intersecting Suspects'}
          </button>
        </div>
      </div>

      {/* Dump Matches Table */}
      {results && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <div>
              Intersection Matches: <b className="text-cyan-300">{results.intersection_matches.length}</b> suspects
            </div>
            <div>Analyzed Records: <b>{results.total_records_analyzed}</b></div>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="py-2 px-3">Subscriber</th>
                  <th className="py-2 px-3">Towers Visited</th>
                  <th className="py-2 px-3">Total Hits</th>
                  <th className="py-2 px-3">Co-Presence Score</th>
                  <th className="py-2 px-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {results.intersection_matches.map((item, idx) => (
                  <tr key={idx} className="hover:bg-cyan-950/20 transition-colors">
                    <td className="py-2 px-3 font-bold text-cyan-300">{item.phone_number}</td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        item.unique_towers_count > 1 ? 'bg-rose-950 text-rose-300 border border-rose-800 font-bold' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {item.unique_towers_count} / {results.target_towers.length} towers
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400">{item.tower_hits} hits</td>
                    <td className="py-2 px-3">
                      <span className="text-emerald-400 font-bold">{(item.co_presence_score * 100).toFixed(0)}%</span>
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => onSelectSuspect && onSelectSuspect(item.phone_number)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-950 hover:text-cyan-300 text-slate-300 text-[10px] border border-slate-700"
                      >
                        Trace Route
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
