import React, { useState, useEffect } from 'react';
import {
  Clock,
  Timer,
  TrendingUp,
  BarChart2,
  Calendar,
  Filter,
  Search,
  Download,
  PhoneIncoming,
  PhoneOutgoing,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { useCDRStore } from '../store/useCDRStore';
import { cdrService } from '../services/cdrService';
import Loader from '../components/common/Loader';

export default function DurationAnalysisView() {
  const { selectedCaseId } = useCDRStore();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Filters
  const [targetParty, setTargetParty] = useState('');
  const [peerParty, setPeerParty] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [callType, setCallType] = useState('');
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
      };
      if (targetParty.trim()) params.target_party = targetParty.trim();
      if (peerParty.trim()) params.peer_party = peerParty.trim();
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (callType.trim()) params.call_type = callType.trim();

      const res = await cdrService.getDurationAnalysis(selectedCaseId, params);
      setData(res);
    } catch (err) {
      console.error('Failed to load duration analytics:', err);
      setError(err.response?.data?.detail || err.message || 'Error loading duration analysis.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCaseId, page]);

  const handleApplyFilters = (e) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const handleResetFilters = () => {
    setTargetParty('');
    setPeerParty('');
    setStartDate('');
    setEndDate('');
    setCallType('');
    setPage(1);
    setTimeout(() => fetchData(), 50);
  };

  const metrics = data?.overall_metrics;
  const distribution = data?.duration_distribution;
  const dailyTrends = data?.daily_duration_trend || [];

  // Compute max daily duration for bar scaling
  const maxDailyDuration = Math.max(...dailyTrends.map(d => d.total_duration_seconds), 1);

  return (
    <div className="space-y-6 pb-12">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
              <Timer className="w-5 h-5 text-cyan-400" />
              Conversation Duration Analytics &amp; Airtime Intelligence
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30">
              FEATURE 3
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Exact conversation duration in HH:MM:SS, incoming vs outgoing airtime distribution, and temporal trend metrics
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
      <form onSubmit={handleApplyFilters} className="p-4 rounded-xl bg-[#090d16] border border-cyan-500/20 shadow-md space-y-4 font-mono">
        <div className="flex items-center gap-2 text-xs text-cyan-300 font-semibold border-b border-slate-800 pb-2">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span>Duration Query Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Target Phone Number</label>
            <input
              type="text"
              value={targetParty}
              onChange={(e) => setTargetParty(e.target.value)}
              placeholder="Filter by Target MSISDN"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-600 focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Peer Phone Number</label>
            <input
              type="text"
              value={peerParty}
              onChange={(e) => setPeerParty(e.target.value)}
              placeholder="Filter by Interlocutor"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-600 focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:border-cyan-500 outline-none"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="flex-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition text-xs flex items-center justify-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              Apply
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs"
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

      {/* KPI Cards Grid */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
          
          <div className="p-3.5 rounded-xl bg-[#090d16] border border-cyan-500/30">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Total Airtime</div>
            <div className="text-base font-bold text-cyan-300 mt-1 truncate">
              {metrics.formatted_total_talking_time}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{metrics.total_talking_time_seconds.toLocaleString()}s total</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#090d16] border border-cyan-500/20">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Average Call</div>
            <div className="text-base font-bold text-slate-100 mt-1 truncate">
              {metrics.formatted_average_duration}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{metrics.average_call_duration_seconds}s avg</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#090d16] border border-emerald-500/30">
            <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold flex items-center gap-1">
              <PhoneOutgoing className="w-3 h-3" />
              <span>Outgoing Airtime</span>
            </div>
            <div className="text-base font-bold text-emerald-300 mt-1 truncate">
              {metrics.formatted_outgoing_talking_time}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{metrics.outgoing_calls_count} outgoing calls</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#090d16] border border-blue-500/30">
            <div className="text-[10px] text-blue-400 uppercase tracking-wider font-bold flex items-center gap-1">
              <PhoneIncoming className="w-3 h-3" />
              <span>Incoming Airtime</span>
            </div>
            <div className="text-base font-bold text-blue-300 mt-1 truncate">
              {metrics.formatted_incoming_talking_time}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{metrics.incoming_calls_count} incoming calls</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#090d16] border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Peak / Longest Call</div>
            <div className="text-base font-bold text-purple-300 mt-1 truncate">
              {metrics.formatted_longest_call}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Min: {metrics.formatted_shortest_call}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#090d16] border border-amber-500/30">
            <div className="text-[10px] text-amber-400 uppercase tracking-wider font-bold">Zero-Duration / Ping</div>
            <div className="text-base font-bold text-amber-300 mt-1">
              {metrics.zero_duration_calls}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Missed calls / pings</div>
          </div>

        </div>
      )}

      {/* Visual Analytics: Duration Brackets & Daily Histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 font-mono">
        
        {/* Duration Distribution Brackets */}
        <div className="p-4 rounded-xl bg-[#090d16] border border-cyan-500/20 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
              <BarChart2 className="w-4 h-4 text-cyan-400" />
              <span>Call Duration Distribution Brackets</span>
            </div>
            <span className="text-[10px] text-slate-500">Call Count Breakdown</span>
          </div>

          {distribution ? (
            <div className="space-y-3 pt-1">
              {[
                { label: 'Zero Duration (Missed / Rejected)', count: distribution.zero_duration, color: 'bg-amber-500', text: 'text-amber-400' },
                { label: '1 - 60s (Quick / Tactical Ping)', count: distribution.under_1_min, color: 'bg-cyan-500', text: 'text-cyan-400' },
                { label: '1 - 5 mins (Standard Operational)', count: distribution['1_to_5_min'], color: 'bg-blue-500', text: 'text-blue-400' },
                { label: '5 - 15 mins (Substantive Discussion)', count: distribution['5_to_15_min'], color: 'bg-purple-500', text: 'text-purple-400' },
                { label: '15 - 30 mins (Extended Debrief)', count: distribution['15_to_30_min'], color: 'bg-rose-500', text: 'text-rose-400' },
                { label: '30+ mins (Deep Consultation)', count: distribution.over_30_min, color: 'bg-emerald-500', text: 'text-emerald-400' },
              ].map((bracket, idx) => {
                const total = metrics?.total_calls_analyzed || 1;
                const pct = Math.round((bracket.count / total) * 100);
                return (
                  <div key={idx} className="space-y-1 text-xs">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">{bracket.label}</span>
                      <span className={`font-bold ${bracket.text}`}>{bracket.count} calls ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className={`h-full ${bracket.color} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-slate-500">No distribution data available.</div>
          )}
        </div>

        {/* Daily Duration Trend Chart */}
        <div className="p-4 rounded-xl bg-[#090d16] border border-cyan-500/20 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>Daily Cumulative Airtime Trend</span>
            </div>
            <span className="text-[10px] text-slate-500">Timeline Histogram</span>
          </div>

          {dailyTrends.length > 0 ? (
            <div className="space-y-2 pt-2">
              <div className="h-44 flex items-end gap-2 border-b border-slate-800 pb-2 px-2 overflow-x-auto">
                {dailyTrends.map((d, idx) => {
                  const heightPct = Math.max(Math.round((d.total_duration_seconds / maxDailyDuration) * 100), 8);
                  return (
                    <div key={idx} className="flex-1 min-w-[32px] flex flex-col items-center gap-1 group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-cyan-500/40 text-cyan-300 text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-20">
                        {d.date}: {d.formatted_duration} ({d.calls} calls)
                      </div>
                      
                      <div
                        className="w-full bg-gradient-to-t from-cyan-600 to-blue-500 rounded-t group-hover:from-cyan-400 group-hover:to-blue-400 transition"
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="text-[9px] text-slate-400 truncate max-w-[32px]">{d.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 px-2 pt-1">
                <span>Start: {dailyTrends[0]?.date}</span>
                <span>Latest: {dailyTrends[dailyTrends.length - 1]?.date}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-xs text-slate-500">
              No chronological airtime records found.
            </div>
          )}
        </div>

      </div>

      {/* Detailed Call History Table with exact HH:MM:SS Duration */}
      <div className="rounded-xl bg-[#090d16] border border-cyan-500/20 overflow-hidden shadow-xl font-mono">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Exact Call Airtime Forensic Ledger
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
          <div className="p-12 text-center text-xs text-slate-500">
            No call records found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Caller (Origin)</th>
                  <th className="py-3 px-4">Receiver (Destination)</th>
                  <th className="py-3 px-4">Call Timestamp</th>
                  <th className="py-3 px-4">Airtime (HH:MM:SS)</th>
                  <th className="py-3 px-4">Duration (sec)</th>
                  <th className="py-3 px-4">Call Type</th>
                  <th className="py-3 px-4">Cell Tower / LAC</th>
                  <th className="py-3 px-4">IMEI Hardware</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.records.map((rec, index) => (
                  <tr key={rec.id || index} className="hover:bg-cyan-950/20 transition-colors text-slate-300">
                    <td className="py-2.5 px-4 text-slate-500 text-[10px]">
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-cyan-300 select-all">
                      {rec.caller_msisdn}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-amber-300 select-all">
                      {rec.receiver_msisdn}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap">
                      {rec.timestamp}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="font-bold text-slate-100 font-mono">
                        {rec.formatted_duration || '00:00:00'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-cyan-400 font-bold">
                      {rec.duration}s
                      {rec.duration === 0 && (
                        <span className="ml-1 text-[9px] text-amber-400 font-normal">(0s)</span>
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
                ))}
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

