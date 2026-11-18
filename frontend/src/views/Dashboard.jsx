import React, { useEffect, useState } from 'react';
import {
  PhoneCall,
  Share2,
  Moon,
  Smartphone,
  MapPin,
  Flame,
  Award,
  ArrowRight,
  Upload,
  FileText,
  FileSpreadsheet,
  RotateCcw,
  Sliders,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { useCDRStore } from '../store/useCDRStore';
import { cdrService } from '../services/cdrService';
import { graphService } from '../services/graphService';
import CentralUploadHero from '../components/common/CentralUploadHero';
import StatsCard from '../components/common/StatsCard';
import TimelineChart from '../components/analytics/TimelineChart';
import LateNightSpikes from '../components/analytics/LateNightSpikes';
import IMEISwapTable from '../components/analytics/IMEISwapTable';
import SilentPeriodAlerts from '../components/analytics/SilentPeriodAlerts';
import IMEISIMTimelineMatrix from '../components/analytics/IMEISIMTimelineMatrix';
import NetworkGraph from '../components/graph/NetworkGraph';
import GeoMap from '../components/map/GeoMap';
import RoutePlayback from '../components/map/RoutePlayback';
import Loader from '../components/common/Loader';

export default function Dashboard() {
  const {
    selectedCaseId,
    setActiveView,
    setSelectedSuspect,
    hasUploadedData,
    setHasUploadedData,
  } = useCDRStore();

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [imeiData, setImeiData] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [towers, setTowers] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [minWeight, setMinWeight] = useState(1);
  const [graphLayout, setGraphLayout] = useState('cose');

  // Trajectory playback in Center/Top GIS Map
  const [suspectRoute, setSuspectRoute] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [activePlaybackPhone, setActivePlaybackPhone] = useState('9811012345');

  const loadDashboardData = async () => {
    if (!selectedCaseId) return;
    try {
      setLoading(true);
      const [sumRes, timeRes, imeiRes, netRes, towRes, routeRes] = await Promise.allSettled([
        cdrService.getCaseSummary(selectedCaseId),
        cdrService.getTimeline(selectedCaseId),
        cdrService.getIMEISwaps(selectedCaseId),
        graphService.getNetworkGraph(selectedCaseId, minWeight, 120),
        cdrService.getCaseTowers(selectedCaseId),
        cdrService.getSuspectRoute(selectedCaseId, activePlaybackPhone),
      ]);

      if (sumRes.status === 'fulfilled') setSummary(sumRes.value);
      if (timeRes.status === 'fulfilled') setTimeline(timeRes.value);
      if (imeiRes.status === 'fulfilled') setImeiData(imeiRes.value);
      if (netRes.status === 'fulfilled') setGraphData(netRes.value);
      if (towRes.status === 'fulfilled') setTowers(towRes.value);
      if (routeRes.status === 'fulfilled') {
        setSuspectRoute(routeRes.value?.route || []);
        setCurrentStepIndex(0);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasUploadedData) {
      loadDashboardData();
    }
  }, [selectedCaseId, hasUploadedData, minWeight, activePlaybackPhone]);

  // If user hasn't uploaded data yet, show the Initial Landing Screen (Central Upload Box)
  if (!hasUploadedData) {
    return (
      <div className="w-full">
        <CentralUploadHero onUploadSuccess={() => setHasUploadedData(true)} />
      </div>
    );
  }

  if (loading && !summary) {
    return <Loader text="Unlocking Unified Forensic Intelligence Matrix..." />;
  }

  const totalCalls = summary?.total_records || timeline?.total_records || 0;
  const lateNightCount = summary?.late_night_calls_count || timeline?.late_night_count || 0;
  const imeiSwapsCount = summary?.multi_sim_devices || imeiData?.multi_sim_handsets_count || 0;
  const networkNodesCount = summary?.total_network_nodes || graphData?.nodes?.length || 0;

  // Active breadcrumb point coordinates for center
  const activePt = suspectRoute[currentStepIndex];
  const mapCenter = activePt?.latitude && activePt?.longitude
    ? [activePt.latitude, activePt.longitude]
    : towers.length > 0
    ? [towers[0].latitude, towers[0].longitude]
    : [28.6139, 77.2090];

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Activated Case Banner & Controls */}
      <div className="p-5 rounded-2xl cyber-card-glow flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              INTELLIGENCE ACTIVE
            </span>
            <span className="text-xs text-slate-400">{summary?.case_id}</span>
          </div>
          <h1 className="text-lg font-bold text-white tracking-wide">
            {summary?.case_name || 'Unified CDR Intelligence Case'}
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Investigator: <b className="text-slate-200">{summary?.investigator}</b> • Evidentiary Cut-off: {summary?.generated_at}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto text-xs">
          <button
            onClick={() => setActiveView('deep_investigation')}
            className="px-3.5 py-1.5 rounded-xl bg-purple-950/70 border border-purple-500/50 hover:bg-purple-900 text-purple-300 font-bold flex items-center gap-1.5 shadow-md shadow-purple-950 transition"
            title="Launch Deep Multi-Factor Investigation Module"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Deep Investigation
          </button>

          <button
            onClick={() => setActiveView('party_analysis')}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-cyan-300 flex items-center gap-1.5 transition"
            title="Open Party A / Party B Directional Communications"
          >
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
            Party A / B
          </button>

          <button
            onClick={() => setActiveView('duration_analysis')}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 flex items-center gap-1.5 transition"
            title="Open Call Duration & Airtime Analysis"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            Airtime
          </button>

          <button
            onClick={() => setHasUploadedData(false)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-white flex items-center gap-1.5 transition"
            title="Upload another CDR file or switch cases"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            Ingest More
          </button>

          <button
            onClick={() => window.open(cdrService.exportPdfUrl(selectedCaseId), '_blank')}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-rose-950 transition"
          >
            <FileText className="w-3.5 h-3.5" />
            Court PDF
          </button>
        </div>
      </div>

      {/* 4 HUD KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="CDR Transactions"
          value={totalCalls.toLocaleString()}
          subtitle={`${summary?.total_duration_minutes || 0} total talk minutes`}
          icon={PhoneCall}
          color="cyan"
        />
        <StatsCard
          title="Network Graph Nodes"
          value={networkNodesCount}
          subtitle={`${graphData?.edges?.length || 0} link connections mapped`}
          icon={Share2}
          color="emerald"
        />
        <StatsCard
          title="Late-Night Spike Calls"
          value={lateNightCount}
          subtitle="Between 12:00 AM - 04:00 AM"
          icon={Moon}
          color="rose"
          alert={lateNightCount > 0}
        />
        <StatsCard
          title="IMEI Handset Swaps"
          value={imeiSwapsCount}
          subtitle={`${imeiData?.total_unique_imeis || 0} unique hardware IMEIs`}
          icon={Smartphone}
          color="amber"
          alert={imeiSwapsCount > 0}
        />
      </div>

      {/* 3-PANEL UNIFIED DASHBOARD:
          Panel 1 (Left): Network Link Graph (Nodes & Links)
          Panel 2 (Center/Top): GIS Geo-Spatial Map (Tower movement playback)
          Panel 3 (Right/Bottom): Call Analytics & Automated Alerts
      */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* PANEL 1 (LEFT): Network Link Graph (Nodes & Links) */}
        <div className="xl:col-span-5 p-5 rounded-2xl cyber-card space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                PANEL 1: Network Link Graph (Nodes & Links)
              </h3>
            </div>
            <button
              onClick={() => setActiveView('network')}
              className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
            >
              Full Screen <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Quick Graph controls */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Min Weight: <b>{minWeight}</b></span>
              <input
                type="range"
                min={1}
                max={10}
                value={minWeight}
                onChange={(e) => setMinWeight(Number(e.target.value))}
                className="w-20 accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
              />
            </div>
            <div className="flex gap-1 text-[10px]">
              {['cose', 'circle', 'concentric'].map((l) => (
                <button
                  key={l}
                  onClick={() => setGraphLayout(l)}
                  className={`px-2 py-0.5 rounded uppercase ${
                    graphLayout === l ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Cytoscape Network Graph Canvas */}
          <div className="h-[420px] rounded-xl overflow-hidden border border-slate-800 relative">
            <NetworkGraph
              nodes={graphData.nodes}
              edges={graphData.edges}
              layoutName={graphLayout}
              selectedNodeId={selectedNode?.id}
              onSelectNode={(node) => {
                setSelectedNode(node);
                setActivePlaybackPhone(node.id);
              }}
            />
          </div>

          {/* Key Hubs Summary inside Panel 1 */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-bold">Primary Hub Targets:</span>
              <span className="text-cyan-400 text-[10px]">Click node to trace route</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {(summary?.top_suspects || []).slice(0, 6).map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedNode(s);
                    setActivePlaybackPhone(s.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] border transition flex items-center gap-1.5 ${
                    activePlaybackPhone === s.id
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-500 font-bold'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>{s.id}</span>
                  <span className="text-cyan-400 font-bold">({s.total_calls})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* PANEL 2 (CENTER/TOP): GIS Geo-Spatial Map (Tower movement) */}
        <div className="xl:col-span-7 p-5 rounded-2xl cyber-card space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                PANEL 2: GIS Geo-Spatial Map (Tower Movement & Azimuths)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400">
                Suspect: <b className="text-rose-400">{activePlaybackPhone}</b>
              </span>
              <button
                onClick={() => setActiveView('gis')}
                className="text-[11px] text-rose-400 hover:underline flex items-center gap-1"
              >
                Tower Dumps <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Leaflet Map Canvas */}
          <div className="h-[380px] rounded-xl overflow-hidden border border-slate-800 relative">
            <GeoMap
              towers={towers}
              routePoints={suspectRoute}
              activePointIndex={currentStepIndex}
              center={mapCenter}
              zoom={11}
            />
          </div>

          {/* Movement Playback Scrubber */}
          {suspectRoute.length > 0 && (
            <div className="pt-1">
              <RoutePlayback
                route={suspectRoute}
                currentIndex={currentStepIndex}
                onIndexChange={setCurrentStepIndex}
                targetNumber={activePlaybackPhone}
              />
            </div>
          )}
        </div>
      </div>

      {/* PANEL 3 (RIGHT/BOTTOM): Call Analytics & Automated Alerts */}
      <div className="p-6 rounded-2xl cyber-card space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Award className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              PANEL 3: Forensic Call Analytics & Automated Alerts
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30">
            Automated Threat & Anomaly Filters
          </span>
        </div>

        {/* 24-Hour Spikes with 12 AM - 4 AM Hazard Highlight */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80">
          <TimelineChart hourlyData={timeline?.hourly_matrix || []} />
        </div>

        {/* Dual Tables: Late Night Spikes + Silent Period Detection */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80">
            <LateNightSpikes records={timeline?.late_night_records || []} />
          </div>

          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80">
            <SilentPeriodAlerts caseId={selectedCaseId} targetPhone={activePlaybackPhone} />
          </div>
        </div>

        {/* Dual Hardware Analytics: IMEI Swap Heuristics + Full IMEI-SIM Swap Timeline */}
        <div className="grid grid-cols-1 gap-6">
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80">
            <IMEISIMTimelineMatrix caseId={selectedCaseId} targetPhone={activePlaybackPhone} />
          </div>

          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80">
            <IMEISwapTable imeiData={imeiData} />
          </div>
        </div>
      </div>
    </div>
  );
}
