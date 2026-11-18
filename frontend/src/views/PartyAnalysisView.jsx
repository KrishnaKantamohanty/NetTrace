import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Filter,
  Search,
  Calendar,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet,
  Download,
  AlertCircle
} from 'lucide-react';
import { useCDRStore } from '../store/useCDRStore';
import { cdrService } from '../services/cdrService';
import Loader from '../components/common/Loader';

export default function PartyAnalysisView() {
  const { selectedCaseId, showToast } = useCDRStore();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Filters
  const [partyA, setPartyA] = useState('');
  const [partyB, setPartyB] = useState('');
  const [direction, setDirection] = useState('ALL'); // ALL, A_TO_B, B_TO_A
  const [callType, setCallType] = useState('');
  const [minDuration, setMinDuration] = useState('');
  const [maxDuration, setMaxDuration] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const fetchData = async () => {
    if (!selectedCaseId) return;
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        page_size: pageSize,
        direction,
      };
      if (partyA.trim()) params.party_a = partyA.trim();
      if (partyB.trim()) params.party_b = partyB.trim();
      if (callType.trim()) params.call_type = callType.trim();
      if (minDuration !== '') params.min_duration = parseInt(minDuration, 10);
      if (maxDuration !== '') params.max_duration = parseInt(maxDuration, 10);

      const res = await cdrService.getPartyAnalysis(selectedCaseId, params);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch party analysis:', err);
      setError(err.response?.data?.detail || err.message || 'Error loading party analysis.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCaseId, page, direction]);

  const handleApplyFilters = (e) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const handleResetFilters = () => {
    setPartyA('');
    setPartyB('');
    setDirection('ALL');
    setCallType('');
    setMinDuration('');
    setMaxDuration('');
    setPage(1);
    setTimeout(() => fetchData(), 50);
  };

  const pairSummary = data?.pair_summary;
  const targetPartyA = data?.party_a_stats;
  const targetPartyB = data?.party_b_stats;

  return (
    <div className="space-y-6 pb-12">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
              Party A ↔ Party B Directional Communication Analysis
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30">
              FEATURE 2
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic directional attribution between communicating parties, duration metrics, and call history
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-xs font-mono text-slate-300 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <form onSubmit={handleApplyFilters} className="p-4 rounded-xl bg-[#090d16] border border-cyan-500/20 shadow-md space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 font-semibold border-b border-slate-800 pb-2">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span>Party & Direction Query Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs font-mono">
          <div>
            <label className="block text-slate-400 mb-1">Party A (Target / Caller)</label>
            <input
              type="text"
              value={partyA}
              onChange={(e) => setPartyA(e.target.value)}
              placeholder="e.g. 9811012345"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-600 focus:border-cyan-500 outline-none text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Party B (Receiver / Callee)</label>
            <input
              type="text"
              value={partyB}
              onChange={(e) => setPartyB(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-600 focus:border-cyan-500 outline-none text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Call Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:border-cyan-500 outline-none text-xs font-mono"
            >
              <option value="ALL">All Directions (⇄ Both)</option>
              <option value="A_TO_B">Party A → Party B (Outgoing from A)</option>
              <option value="B_TO_A">Party B → Party A (Incoming to A)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Call Type</label>
            <select
              value={callType}
              onChange={(e) => setCallType(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:border-cyan-500 outline-none text-xs font-mono"
            >
              <option value="">All Types (Voice/SMS)</option>
              <option value="VOICE">VOICE (Calls)</option>
              <option value="SMS">SMS / Messaging</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Min Duration (sec)</label>
            <input
              type="number"
              min="0"
              value={minDuration}
              onChange={(e) => setMinDuration(e.target.value)}
              placeholder="e.g. 0"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-600 focus:border-cyan-500 outline-none text-xs font-mono"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="flex-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition text-xs font-mono flex items-center justify-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              Apply
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs font-mono"
            >
              Reset
            </button>
          </div>
        </div>
      </form>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Analytical KPI Cards & Direction Visualizer */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Party A Profile */}
          <div className="p-4 rounded-xl bg-[#090d16] border border-cyan-500/20 font-mono space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Party A Entity</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30">
                Primary Anchor
              </span>
            </div>
            <div className="text-base font-bold text-cyan-300 truncate">
              {partyA || targetPartyA?.phone || 'All Callers (Global)'}
            </div>
            {targetPartyA && (
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/60">
                <div>
                  <div className="text-slate-400 text-[10px]">Total Outgoing:</div>
                  <div className="text-emerald-400 font-bold">{targetPartyA.total_outgoing} calls</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Total Incoming:</div>
                  <div className="text-blue-400 font-bold">{targetPartyA.total_incoming} calls</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Unique Peers:</div>
                  <div className="text-slate-200 font-bold">{targetPartyA.unique_contacts} numbers</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Talking Time:</div>
                  <div className="text-cyan-300 font-bold">{targetPartyA.formatted_talking_time}</div>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Directional Inter-Party Relationship */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-[#0b1220] to-[#090d16] border border-cyan-500/30 font-mono space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs text-cyan-300 uppercase tracking-wider font-bold">Directional Exchange</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-500/30">
                Pair Metrics
              </span>
            </div>

            {pairSummary ? (
              <div className="space-y-3">
                {/* Arrow visualizer */}
                <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="text-center">
                    <div className="text-[10px] text-slate-400">Party A</div>
                    <div className="text-xs font-bold text-cyan-300 truncate max-w-[80px]">{pairSummary.party_a}</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
                      <span>{pairSummary.a_to_b_count}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-blue-400 font-bold">
                      <ArrowLeft className="w-3.5 h-3.5 text-blue-400" />
                      <span>{pairSummary.b_to_a_count}</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-slate-400">Party B</div>
                    <div className="text-xs font-bold text-amber-300 truncate max-w-[80px]">{pairSummary.party_b}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px]">Total Exchanged:</span>
                    <div className="text-white font-bold">{pairSummary.total_calls} calls</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Cumulative Duration:</span>
                    <div className="text-cyan-300 font-bold">{pairSummary.formatted_total_duration}</div>
                  </div>
                  <div className="col-span-2 text-[10px] text-slate-400">
                    <div>First Contact: <span className="text-slate-200">{pairSummary.first_communication || 'N/A'}</span></div>
                    <div>Last Contact: <span className="text-slate-200">{pairSummary.last_communication || 'N/A'}</span></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-500">
                Specify both Party A and Party B above to generate comparative directional metrics.
              </div>
            )}
          </div>

          {/* Card 3: Party B Profile */}
          <div className="p-4 rounded-xl bg-[#090d16] border border-cyan-500/20 font-mono space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Party B Entity</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30">
                Destination / Peer
              </span>
            </div>
            <div className="text-base font-bold text-amber-300 truncate">
              {partyB || targetPartyB?.phone || 'All Receivers (Global)'}
            </div>
            {targetPartyB ? (
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/60">
                <div>
                  <div className="text-slate-400 text-[10px]">Total Outgoing:</div>
                  <div className="text-emerald-400 font-bold">{targetPartyB.total_outgoing} calls</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Total Incoming:</div>
                  <div className="text-blue-400 font-bold">{targetPartyB.total_incoming} calls</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Unique Contacts:</div>
                  <div className="text-slate-200 font-bold">{targetPartyB.unique_contacts} numbers</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Talking Time:</div>
                  <div className="text-amber-300 font-bold">{targetPartyB.formatted_talking_time}</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 pt-2">
                Enter Party B phone number in filters to unlock peer entity stats.
              </div>
            )}
          </div>

        </div>
      )}

      {/* Top Communication Pairs (Frequent Contacts) */}
      {data?.top_pairs && data.top_pairs.length > 0 && (
        <div className="p-4 rounded-xl bg-[#090d16] border border-slate-800 space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Most Frequent Communicating Pairs in this Investigation
            </h3>
            <span className="text-[11px] text-slate-500">Sorted by Call Frequency</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {data.top_pairs.slice(0, 6).map((pair, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setPartyA(pair.party_a);
                  setPartyB(pair.party_b);
                  setPage(1);
                }}
                className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="text-cyan-300">{pair.party_a}</span>
                    <span className="text-slate-500">→</span>
                    <span className="text-amber-300">{pair.party_b}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[10px] font-bold">
                    {pair.total_calls} calls
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Total Duration: {pair.formatted_duration || `${pair.total_duration}s`}</span>
                  <span className="text-cyan-400 hover:underline">Inspect Pair &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Interactive Communications Table */}
      <div className="rounded-xl bg-[#090d16] border border-cyan-500/20 overflow-hidden shadow-xl font-mono">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Communication Records (Total Found: {data?.pagination?.total || 0})
            </h2>
          </div>
          <div className="text-xs text-slate-400">
            Page {data?.pagination?.page || 1} of {data?.pagination?.total_pages || 1}
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader />
          </div>
        ) : !data?.records || data.records.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <div>No communication records found matching your active filter criteria.</div>
            <button
              onClick={handleResetFilters}
              className="text-cyan-400 underline hover:text-cyan-300"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Party A (Origin)</th>
                  <th className="py-3 px-4 text-center">Direction</th>
                  <th className="py-3 px-4">Party B (Destination)</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Cell Tower / CGI</th>
                  <th className="py-3 px-4">IMEI Hardware</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.records.map((rec, index) => {
                  const isAtoB = rec.direction_indicator === 'A_TO_B' || !rec.direction_indicator;
                  return (
                    <tr
                      key={rec.id || index}
                      className="hover:bg-cyan-950/20 transition-colors text-slate-300"
                    >
                      <td className="py-2.5 px-4 text-slate-500 text-[10px]">
                        {(page - 1) * pageSize + index + 1}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-cyan-300 select-all">
                        {rec.caller_msisdn}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isAtoB
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                              : 'bg-blue-950 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {isAtoB ? 'Party A → Party B' : 'Party B → Party A'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-amber-300 select-all">
                        {rec.receiver_msisdn}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap">
                        {rec.timestamp}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-100">
                          {rec.formatted_duration || `${rec.duration}s`}
                        </span>
                        {rec.duration === 0 && (
                          <span className="ml-1 text-[9px] text-amber-400 font-semibold">(Missed)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {rec.call_type || 'VOICE'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px] truncate max-w-[120px]">
                        {rec.first_cgi || rec.cell_tower_id || 'N/A'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px] truncate max-w-[120px] font-mono">
                        {rec.imei || 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data?.pagination && data.pagination.total_pages > 1 && (
          <div className="p-3 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.pagination.total)} of{' '}
              {data.pagination.total} records
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-cyan-400 font-bold px-2">
                {page} / {data.pagination.total_pages}
              </span>
              <button
                disabled={page >= data.pagination.total_pages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

