import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  UserCheck,
  Share2,
  MapPin,
  Clock,
  Smartphone,
  Flame,
  Radio,
  FileText,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  GitFork,
  ArrowRight,
  Layers,
  Database
} from 'lucide-react';
import { useCDRStore } from '../store/useCDRStore';
import { cdrService } from '../services/cdrService';
import Loader from '../components/common/Loader';
import NetworkGraph from '../components/graph/NetworkGraph';
import GeoMap from '../components/map/GeoMap';

export default function DeepInvestigationView() {
  const { selectedCaseId, selectedSuspect, setSelectedSuspect } = useCDRStore();

  const [targetPhone, setTargetPhone] = useState(selectedSuspect || '9811012345');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [direction, setDirection] = useState('ALL');
  const [minDuration, setMinDuration] = useState('');
  const [maxDuration, setMaxDuration] = useState('');
  const [towerId, setTowerId] = useState('');
  const [imei, setImei] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [loading, setLoading] = useState(false);
  const [investigationData, setInvestigationData] = useState(null);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('overview'); // 'overview', 'network', 'gis', 'timeline', 'records'

  const runInvestigation = async () => {
    if (!selectedCaseId || !targetPhone.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const params = {
        target_phone: targetPhone.trim(),
        direction,
        page,
        page_size: pageSize,
      };
      if (secondaryPhone.trim()) params.secondary_phone = secondaryPhone.trim();
      if (minDuration !== '') params.min_duration = parseInt(minDuration, 10);
      if (maxDuration !== '') params.max_duration = parseInt(maxDuration, 10);
      if (towerId.trim()) params.tower_id = towerId.trim();
      if (imei.trim()) params.imei = imei.trim();
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await cdrService.getDeepInvestigation(selectedCaseId, params);
      setInvestigationData(res);
      setSelectedSuspect(targetPhone.trim());
    } catch (err) {
      console.error('Deep investigation query failed:', err);
      setError(err.response?.data?.detail || err.message || 'Investigation query failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSuspect && selectedSuspect !== targetPhone) {
      setTargetPhone(selectedSuspect);
    }
  }, [selectedSuspect]);

  useEffect(() => {
    runInvestigation();
  }, [selectedCaseId, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    runInvestigation();
  };

  const profile = investigationData?.profile;
  const graphData = investigationData?.graph_ego_network || { nodes: [], edges: [] };
  const towers = investigationData?.cell_tower_locations || [];
  const coTravelers = investigationData?.co_travelers || [];
  const imeiHistory = investigationData?.imei_history || [];
  const silentPeriods = investigationData?.silent_periods || [];
  const hypotheses = investigationData?.investigative_hypotheses || [];
  const sourceRecords = investigationData?.source_records || [];
  const pagination = investigationData?.pagination;

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-purple-400" />
              Unified Deep Investigation Workspace
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30">
              FEATURE 4
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            End-to-end multi-dimensional intelligence synthesis: ego-network, spatial mobility, SIM-swaps, and hypothesis reasoning
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(cdrService.exportPdfUrl(selectedCaseId), '_blank')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 text-xs font-mono transition"
          >
            <FileText className="w-3.5 h-3.5" />
            Export Dossier
          </button>
          <button
            onClick={() => runInvestigation()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-xs font-mono text-slate-300 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Target Search & Query Configuration Bar */}
      <form onSubmit={handleSearchSubmit} className="p-4 rounded-xl bg-[#090d16] border border-cyan-500/20 shadow-xl space-y-4 font-mono">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
            <Search className="w-4 h-4 text-cyan-400" />
            <span>Target Selection &amp; Multi-Factor Filters</span>
          </div>
          <span className="text-[10px] text-slate-400">Case ID: {selectedCaseId}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-bold">
              Target Phone Number (MSISDN) *
            </label>
            <input
              type="text"
              required
              value={targetPhone}
              onChange={(e) => setTargetPhone(e.target.value)}
              placeholder="e.g. 9811012345"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-cyan-500/50 text-cyan-300 font-bold focus:border-cyan-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">
              Secondary Interlocutor (Path / Common Contacts)
            </label>
            <input
              type="text"
              value={secondaryPhone}
              onChange={(e) => setSecondaryPhone(e.target.value)}
              placeholder="Optional: compare with 2nd MSISDN"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Direction Filter</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:border-cyan-500 outline-none"
            >
              <option value="ALL">ALL Directions (Incoming &amp; Outgoing)</option>
              <option value="OUTGOING">OUTGOING Only</option>
              <option value="INCOMING">INCOMING Only</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Hardware IMEI Filter</label>
            <input
              type="text"
              value={imei}
              onChange={(e) => setImei(e.target.value)}
              placeholder="15-digit TAC/IMEI"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-cyan-500 outline-none"
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

          <div>
            <label className="block text-slate-400 mb-1">Cell Tower ID / CGI</label>
            <input
              type="text"
              value={towerId}
              onChange={(e) => setTowerId(e.target.value)}
              placeholder="e.g. DEL-TOW-801"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-cyan-500 outline-none"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-semibold transition text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-900/30"
            >
              <Search className="w-3.5 h-3.5" />
              Run Deep Investigation
            </button>
          </div>
        </div>
      </form>

      {/* Error notification */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Target Profile KPI Strip */}
      {profile && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 font-mono">
          <div className="p-3 rounded-xl bg-[#090d16] border border-purple-500/30">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Investigated Entity</div>
            <div className="text-sm font-bold text-purple-300 mt-1 truncate">{profile.target_number}</div>
            <div className="text-[10px] text-slate-500">{profile.total_calls} total events</div>
          </div>

          <div className="p-3 rounded-xl bg-[#090d16] border border-cyan-500/20">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Total Airtime</div>
            <div className="text-sm font-bold text-cyan-300 mt-1 truncate">{profile.formatted_duration}</div>
            <div className="text-[10px] text-slate-500">Duration in HH:MM:SS</div>
          </div>

          <div className="p-3 rounded-xl bg-[#090d16] border border-emerald-500/20">
            <div className="text-[10px] text-emerald-400 uppercase font-bold">Outgoing Calls</div>
            <div className="text-sm font-bold text-emerald-300 mt-1">{profile.outgoing_calls}</div>
            <div className="text-[10px] text-slate-500">Initiated communications</div>
          </div>

          <div className="p-3 rounded-xl bg-[#090d16] border border-blue-500/20">
            <div className="text-[10px] text-blue-400 uppercase font-bold">Incoming Calls</div>
            <div className="text-sm font-bold text-blue-300 mt-1">{profile.incoming_calls}</div>
            <div className="text-[10px] text-slate-500">Received communications</div>
          </div>

          <div className="p-3 rounded-xl bg-[#090d16] border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Unique Contacts</div>
            <div className="text-sm font-bold text-slate-100 mt-1">{profile.unique_interlocutors}</div>
            <div className="text-[10px] text-slate-500">Degree 1 peers</div>
          </div>

          <div className="p-3 rounded-xl bg-[#090d16] border border-amber-500/20">
            <div className="text-[10px] text-amber-400 uppercase font-bold">IMEI Devices</div>
            <div className="text-sm font-bold text-amber-300 mt-1">{profile.unique_imeis}</div>
            <div className="text-[10px] text-slate-500">Handset swaps</div>
          </div>

          <div className="p-3 rounded-xl bg-[#090d16] border border-rose-500/20">
            <div className="text-[10px] text-rose-400 uppercase font-bold">Towers Visited</div>
            <div className="text-sm font-bold text-rose-300 mt-1">{profile.unique_towers}</div>
            <div className="text-[10px] text-slate-500">Cell locations</div>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-800 bg-[#090d16] rounded-xl p-1 text-xs font-mono">
        {[
          { id: 'overview', label: '1. Multi-Factor Overview', icon: Layers },
          { id: 'network', label: '2. Ego-Network Graph & Shortest Paths', icon: Share2 },
          { id: 'gis', label: '3. Cell Towers & Co-Travelers', icon: MapPin },
          { id: 'timeline', label: '4. Silent Periods & IMEI Swaps', icon: Clock },
          { id: 'records', label: '5. Underlying Source Records', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 rounded-lg font-semibold transition ${
                isActive
                  ? 'bg-purple-950/60 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: OVERVIEW & HYPOTHESIS ENGINE */}
      {activeSection === 'overview' && (
        <div className="space-y-6 font-mono">
          
          {/* Investigative Hypotheses Notice */}
          <div className="p-4 rounded-xl bg-[#0d101e] border border-purple-500/30 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
                <Lightbulb className="w-4 h-4 text-purple-400" />
                <span>Investigative Hypotheses &amp; Behavioral Observations</span>
              </div>
              <span className="text-[10px] text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded bg-amber-950/40">
                Notice: Investigative Lead Only — Not Proof of Guilt
              </span>
            </div>

            {hypotheses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {hypotheses.map((h, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                      h.severity === 'HIGH'
                        ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                        : 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-white">{h.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 font-mono">
                        {h.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{h.observation}</p>
                    <div className="text-[10px] text-slate-400 border-t border-slate-800/60 pt-1">
                      Lead Recommendation: <span className="text-slate-200">{h.actionable_lead}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-2">
                No high-anomaly behavioral triggers (late-night spikes, rapid IMEI swapping, or extensive silent periods) detected for this entity.
              </div>
            )}
          </div>

          {/* Top Contacted Parties & Hourly Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Top Contacts */}
            <div className="p-4 rounded-xl bg-[#090d16] border border-cyan-500/20 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  Top Frequent Interlocutors (Degree 1)
                </span>
                <span className="text-[10px] text-slate-400">Ranked by Call Count</span>
              </div>

              {investigationData?.top_contacts && investigationData.top_contacts.length > 0 ? (
                <div className="space-y-2">
                  {investigationData.top_contacts.slice(0, 6).map((c, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSecondaryPhone(c.contact_number);
                        setActiveSection('network');
                      }}
                      className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 cursor-pointer flex items-center justify-between text-xs transition"
                    >
                      <div>
                        <div className="font-bold text-slate-200 select-all">{c.contact_number}</div>
                        <div className="text-[10px] text-slate-400">
                          Out: {c.outgoing} | In: {c.incoming} | Total Duration: {c.formatted_duration || `${c.total_duration}s`}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-bold text-xs">
                          {c.total_calls} calls
                        </span>
                        <div className="text-[9px] text-cyan-400 mt-0.5">Explore Path &rarr;</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-4 text-center">No interlocutors found.</div>
              )}
            </div>

            {/* 24-Hour Activity Pattern */}
            <div className="p-4 rounded-xl bg-[#090d16] border border-cyan-500/20 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  24-Hour Diurnal Activity Distribution
                </span>
                <span className="text-[10px] text-slate-400">Hour 00 to 23</span>
              </div>

              {investigationData?.hourly_distribution ? (
                <div className="space-y-2 pt-2">
                  <div className="h-40 flex items-end gap-1.5 border-b border-slate-800 pb-2 px-1">
                    {investigationData.hourly_distribution.map((h, idx) => {
                      const maxH = Math.max(...investigationData.hourly_distribution.map(x => x.calls), 1);
                      const height = Math.max(Math.round((h.calls / maxH) * 100), 5);
                      const isLateNight = h.hour >= 23 || h.hour <= 5;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div className="absolute -top-7 opacity-0 group-hover:opacity-100 bg-slate-900 border border-slate-700 text-cyan-300 text-[9px] px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-20">
                            {String(h.hour).padStart(2, '0')}:00 &rarr; {h.calls} calls
                          </div>
                          <div
                            className={`w-full rounded-t transition ${
                              isLateNight ? 'bg-rose-500 hover:bg-rose-400' : 'bg-cyan-500 hover:bg-cyan-400'
                            }`}
                            style={{ height: `${height}%` }}
                          />
                          <span className="text-[8px] text-slate-500">{h.hour}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 px-1">
                    <span className="flex items-center gap-1 text-rose-400">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span> Late Night Window (23:00 - 05:00)
                    </span>
                    <span className="flex items-center gap-1 text-cyan-400">
                      <span className="w-2 h-2 rounded-full bg-cyan-500"></span> Day Operations
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-4 text-center">No hourly data.</div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* SECTION 2: EGO-NETWORK & SHORTEST PATH */}
      {activeSection === 'network' && (
        <div className="space-y-4 font-mono">
          <div className="p-4 rounded-xl bg-[#090d16] border border-cyan-500/20 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                <GitFork className="w-4 h-4 text-cyan-400" />
                <span>Inter-Party Linkage: Common Contacts &amp; Shortest Communication Path</span>
              </div>
              {secondaryPhone && (
                <span className="text-[10px] text-cyan-400">
                  Target: {targetPhone} ↔ Secondary: {secondaryPhone}
                </span>
              )}
            </div>

            {investigationData?.common_contacts && investigationData.common_contacts.length > 0 ? (
              <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-xs space-y-1">
                <div className="font-bold text-cyan-300">
                  Common Interlocutors Identified ({investigationData.common_contacts.length}):
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {investigationData.common_contacts.map((c, idx) => (
                    <span key={idx} className="px-2 py-1 rounded bg-slate-900 border border-cyan-500/40 text-cyan-200 select-all font-bold">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ) : secondaryPhone ? (
              <div className="text-xs text-slate-400">
                No direct common contacts between {targetPhone} and {secondaryPhone} within degree-1 CDR bounds.
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Provide a Secondary Interlocutor in filters to compute mutual bridge contacts and shortest path.
              </div>
            )}

            {investigationData?.shortest_path && (
              <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-500/30 text-xs space-y-1">
                <div className="font-bold text-purple-300">Shortest Telecommunication Hop Path:</div>
                <div className="flex items-center gap-2 pt-1 overflow-x-auto text-xs">
                  {investigationData.shortest_path.map((node, idx) => (
                    <React.Fragment key={idx}>
                      <span className="px-2.5 py-1 rounded bg-slate-900 border border-purple-500/40 text-purple-200 font-bold">
                        {node}
                      </span>
                      {idx < investigationData.shortest_path.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-purple-400 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Embedded Cytoscape Graph */}
          <div className="h-[460px] rounded-xl bg-[#090d16] border border-cyan-500/20 overflow-hidden relative">
            <NetworkGraph
              data={graphData}
              layout="cose"
              onNodeSelect={(node) => {
                if (node.id !== targetPhone) {
                  setSecondaryPhone(node.id);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* SECTION 3: CELL TOWERS & CO-TRAVELERS */}
      {activeSection === 'gis' && (
        <div className="space-y-4 font-mono">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Tower Sequence List */}
            <div className="p-4 rounded-xl bg-[#090d16] border border-cyan-500/20 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  Visited Towers ({towers.length})
                </span>
                <span className="text-[10px] text-slate-400">Spatial Footprint</span>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {towers.map((tow, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-0.5">
                    <div className="flex justify-between font-bold text-slate-200">
                      <span>{tow.cell_id || `Tower #${idx + 1}`}</span>
                      <span className="text-cyan-400">{tow.call_count} calls</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Coords: {tow.latitude.toFixed(4)}, {tow.longitude.toFixed(4)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Co-Travelers Module */}
            <div className="p-4 rounded-xl bg-[#090d16] border border-cyan-500/20 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Co-Traveler Device Matches
                </span>
                <span className="text-[10px] text-slate-400">Same-Tower 30m Window</span>
              </div>

              {coTravelers.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {coTravelers.map((ct, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs space-y-1">
                      <div className="flex justify-between font-bold text-amber-200">
                        <span>{ct.co_traveler_msisdn}</span>
                        <span className="text-amber-400">{ct.common_tower_count} towers</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Confidence: {(ct.confidence_score * 100).toFixed(0)}% correlation
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-6 text-center">
                  No co-moving devices identified within the active spatial window.
                </div>
              )}
            </div>

            {/* Embedded GIS Leaflet Map */}
            <div className="h-96 rounded-xl bg-[#090d16] border border-cyan-500/20 overflow-hidden relative">
              <GeoMap towers={towers} suspects={[]} />
            </div>

          </div>
        </div>
      )}

      {/* SECTION 4: SILENT PERIODS & IMEI SWAPS */}
      {activeSection === 'timeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 font-mono">
          
          {/* Silent Period Alerts */}
          <div className="p-4 rounded-xl bg-[#090d16] border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Suspicious Silent Periods (Radio Gaps &ge; 3.0h)</span>
              </div>
              <span className="text-[10px] text-slate-400">Total: {silentPeriods.length}</span>
            </div>

            {silentPeriods.length > 0 ? (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto">
                {silentPeriods.map((gap, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/40 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-amber-200">
                        Gap #{idx + 1}: {gap.gap_duration_hours.toFixed(1)} Hours Inactive
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-400 text-[10px] font-bold">
                        {gap.formatted_gap}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Inactive From: <span className="text-white">{gap.gap_start}</span> &rarr; Resumed:{' '}
                      <span className="text-white">{gap.gap_end}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-8 text-center">
                No silent windows exceeding threshold detected.
              </div>
            )}
          </div>

          {/* IMEI Hardware Swaps */}
          <div className="p-4 rounded-xl bg-[#090d16] border border-cyan-500/20 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Handset IMEI Usage Timeline</span>
              </div>
              <span className="text-[10px] text-slate-400">Unique Devices: {imeiHistory.length}</span>
            </div>

            {imeiHistory.length > 0 ? (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto">
                {imeiHistory.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-200">
                      <span className="select-all text-cyan-300 font-mono">{item.imei || 'Unknown IMEI'}</span>
                      <span className="text-slate-400 text-[11px]">{item.call_count} calls</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Active: {item.first_seen} &rarr; {item.last_seen}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-8 text-center">
                No IMEI swap history recorded.
              </div>
            )}
          </div>

        </div>
      )}

      {/* SECTION 5: UNDERLYING SOURCE RECORDS */}
      {activeSection === 'records' && (
        <div className="rounded-xl bg-[#090d16] border border-cyan-500/20 overflow-hidden shadow-xl font-mono">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>Evidence Ledger: Primary Telecommunications Source Records</span>
            </div>
            <div className="text-xs text-slate-400">
              Page {pagination?.page || 1} of {pagination?.total_pages || 1}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Caller</th>
                  <th className="py-3 px-4">Receiver</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Airtime (HH:MM:SS)</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Tower / CGI</th>
                  <th className="py-3 px-4">IMEI Hardware</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sourceRecords.map((rec, index) => (
                  <tr key={rec.id || index} className="hover:bg-cyan-950/20 transition-colors text-slate-300">
                    <td className="py-2 px-4 text-slate-500 text-[10px]">
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td className="py-2 px-4 font-bold text-cyan-300 select-all">{rec.caller_msisdn}</td>
                    <td className="py-2 px-4 font-bold text-amber-300 select-all">{rec.receiver_msisdn}</td>
                    <td className="py-2 px-4 text-slate-300 whitespace-nowrap">{rec.timestamp}</td>
                    <td className="py-2 px-4 font-mono font-bold text-white">{rec.formatted_duration || '00:00:00'}</td>
                    <td className="py-2 px-4 text-cyan-400">{rec.duration}s</td>
                    <td className="py-2 px-4 text-slate-400 text-[11px]">{rec.cell_tower_id || rec.first_cgi || 'N/A'}</td>
                    <td className="py-2 px-4 text-slate-400 text-[11px] font-mono">{rec.imei || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.total_pages > 1 && (
            <div className="p-3 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, pagination.total)} of{' '}
                {pagination.total} records
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-cyan-400 font-bold px-2">{page} / {pagination.total_pages}</span>
                <button
                  disabled={page >= pagination.total_pages}
                  onClick={() => setPage(page + 1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

