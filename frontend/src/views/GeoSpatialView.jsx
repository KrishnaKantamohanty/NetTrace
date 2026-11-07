import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, Radio, Layers, Search, Crosshair, AlertTriangle, Shield, Users } from 'lucide-react';
import { useCDRStore } from '../store/useCDRStore';
import { cdrService } from '../services/cdrService';
import { forensicsService } from '../services/forensicsService';
import GeoMap from '../components/map/GeoMap';
import RoutePlayback from '../components/map/RoutePlayback';
import TowerDumpVisualizer from '../components/map/TowerDumpVisualizer';
import CoTravelerVisualizer from '../components/map/CoTravelerVisualizer';
import OSINTModal from '../components/common/OSINTModal';
import Loader from '../components/common/Loader';

export default function GeoSpatialView() {
  const { selectedCaseId, selectedSuspect, setSelectedSuspect, showToast } = useCDRStore();
  const [loading, setLoading] = useState(true);
  const [towers, setTowers] = useState([]);
  const [suspectRoute, setSuspectRoute] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetPhone, setTargetPhone] = useState(selectedSuspect || '9811012345');
  const [activeTab, setActiveTab] = useState('route'); // 'route' | 'tower_dump'
  const [geofences, setGeofences] = useState([]);
  const [breaches, setBreaches] = useState([]);
  const [geofenceVisible, setGeofenceVisible] = useState(true);
  const [osintPhone, setOsintPhone] = useState(null);

  useEffect(() => {
    async function initGIS() {
      if (!selectedCaseId) return;
      try {
        setLoading(true);
        const [towRes, gfRules, gfBreaches] = await Promise.allSettled([
          cdrService.getCaseTowers(selectedCaseId),
          forensicsService.getGeofenceRules(selectedCaseId),
          forensicsService.getGeofenceBreaches(selectedCaseId),
        ]);

        if (towRes.status === 'fulfilled') setTowers(towRes.value);
        if (gfRules.status === 'fulfilled') {
          const rules = gfRules.value?.rules || gfRules.value || [];
          const bData = gfBreaches.status === 'fulfilled'
            ? (gfBreaches.value?.breaches || gfBreaches.value || [])
            : [];
          setBreaches(bData);
          // Merge breach info into geofence rules — backend returns fence_id on breach records
          const breachSet = new Set(bData.map((b) => b.fence_id || b.geofence_id));
          const breachCounts = bData.reduce((acc, b) => {
            const id = b.fence_id || b.geofence_id;
            acc[id] = (acc[id] || 0) + 1;
            return acc;
          }, {});
          setGeofences(rules.map((gf) => ({
            ...gf,
            has_breach: breachSet.has(gf.id),
            breach_count: breachCounts[gf.id] || gf.breach_count || 0,
          })));
        }

        if (targetPhone) {
          const routeRes = await cdrService.getSuspectRoute(selectedCaseId, targetPhone);
          setSuspectRoute(routeRes.route || []);
          setCurrentStepIndex(0);
        }
      } catch (err) {
        showToast('Error loading GIS data: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    initGIS();
  }, [selectedCaseId]);

  const handleFetchRoute = async (phone) => {
    if (!phone) return;
    try {
      setTargetPhone(phone);
      const res = await cdrService.getSuspectRoute(selectedCaseId, phone);
      setSuspectRoute(res.route || []);
      setCurrentStepIndex(0);
      showToast(`Loaded ${res.route?.length || 0} breadcrumbs for ${phone}`);
    } catch (err) {
      showToast('Error loading route: ' + err.message);
    }
  };

  if (loading && towers.length === 0) {
    return <Loader text="Triangulating Cell Sites & Trajectory GPS..." />;
  }

  const activePt = suspectRoute[currentStepIndex];
  const mapCenter = activePt?.latitude && activePt?.longitude
    ? [activePt.latitude, activePt.longitude]
    : towers.length > 0
    ? [towers[0].latitude, towers[0].longitude]
    : [28.6139, 77.2090];

  // Backend breach records don't have a severity field — all geofence breaches are operationally significant
  const criticalBreaches = breaches; // show all

  return (
    <div className="space-y-4 pb-12 font-mono text-xs">
      {/* Geofence Breach Alert Banner */}
      {criticalBreaches.length > 0 && (
        <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/50 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <div className="font-bold text-rose-300 text-xs">
              GEOFENCE BREACH ALERT: {criticalBreaches.length} suspect(s) detected inside restricted zones
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {criticalBreaches.slice(0, 5).map((b, i) => {
                // Backend uses 'subscriber' field; also handle 'subscriber_number'
                const sub = b.subscriber || b.subscriber_number;
                const gfName = b.fence_name || b.geofence_name;
                return (
                  <button
                    key={i}
                    onClick={() => { setTargetPhone(sub); handleFetchRoute(sub); setActiveTab('route'); }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-rose-950 border border-rose-700 text-rose-300 hover:bg-rose-900 transition"
                  >
                    <span className="text-[10px] font-bold">{sub}</span>
                    <span className="text-[9px] text-slate-400">@ {gfName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Top Tab Bar & Target Selector */}
      <div className="p-3 bg-[#090d16] border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('route')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold transition ${
              activeTab === 'route'
                ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            Suspect Movement Playback
          </button>

          <button
            onClick={() => setActiveTab('tower_dump')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold transition ${
              activeTab === 'tower_dump'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            Multi-Tower Dump Intersections
          </button>

          <button
            onClick={() => setActiveTab('co_travelers')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold transition ${
              activeTab === 'co_travelers'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            Trajectory & Co-Travelers
          </button>

          {/* Geofence toggle */}
          {geofences.length > 0 && (
            <button
              onClick={() => setGeofenceVisible(!geofenceVisible)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold transition ${
                geofenceVisible
                  ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                  : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Geofences ({geofences.length})
              {breaches.length > 0 && (
                <span className="px-1 rounded bg-rose-700 text-white text-[9px] font-bold">{breaches.length}</span>
              )}
            </button>
          )}
        </div>

        {/* Suspect Phone Input */}
        {activeTab === 'route' && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Suspect SIM:</span>
            <input
              type="text"
              value={targetPhone}
              onChange={(e) => setTargetPhone(e.target.value)}
              placeholder="e.g. 9811012345"
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-rose-300 outline-none w-36 font-bold"
            />
            <button
              onClick={() => handleFetchRoute(targetPhone)}
              className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold"
            >
              Trace
            </button>
            <button
              onClick={() => setOsintPhone(targetPhone)}
              className="px-3 py-1 rounded bg-cyan-950 border border-cyan-500/40 hover:bg-cyan-900 text-cyan-300 font-bold"
              title="Open OSINT Dossier for this suspect"
            >
              OSINT
            </button>
          </div>
        )}
      </div>

      {/* Main GIS Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[720px]">
        {/* Full Interactive Leaflet Map */}
        <div className="lg:col-span-3 h-full relative rounded-xl overflow-hidden border border-slate-800">
          <GeoMap
            towers={towers}
            routePoints={suspectRoute}
            activePointIndex={currentStepIndex}
            center={mapCenter}
            zoom={12}
            geofences={geofenceVisible ? geofences : []}
          />

          {/* Route Playback Overlay at Bottom */}
          {activeTab === 'route' && suspectRoute.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 z-[1000] max-w-2xl mx-auto">
              <RoutePlayback
                route={suspectRoute}
                currentIndex={currentStepIndex}
                onIndexChange={setCurrentStepIndex}
                targetNumber={targetPhone}
              />
            </div>
          )}
        </div>

        {/* Right Panel: Tower Dump Visualizer or Cell Tower Inventory */}
        <div className="p-4 rounded-xl cyber-card flex flex-col overflow-y-auto">
          {activeTab === 'co_travelers' ? (
            <CoTravelerVisualizer
              caseId={selectedCaseId}
              targetPhone={targetPhone}
              onSelectCompanion={(phone) => {
                handleFetchRoute(phone);
                setActiveTab('route');
              }}
            />
          ) : activeTab === 'tower_dump' ? (
            <TowerDumpVisualizer
              availableTowers={towers}
              onSelectSuspect={(phone) => {
                handleFetchRoute(phone);
                setActiveTab('route');
              }}
            />
          ) : (
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 font-bold text-slate-200">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <span>Cell Sites ({towers.length})</span>
                </div>
              </div>

              {/* Geofence Breach Summary */}
              {breaches.length > 0 && (
                <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/30 space-y-1.5">
                  <div className="text-[10px] font-bold text-rose-400 uppercase">Geofence Breaches</div>
                  {breaches.slice(0, 4).map((b, i) => {
                    const sub = b.subscriber || b.subscriber_number;
                    const gfName = b.fence_name || b.geofence_name;
                    return (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <span className="text-cyan-300 font-bold">{sub}</span>
                        <span className="text-[10px] text-rose-300 truncate ml-1">@ {gfName}</span>
                      </div>
                    );
                  })}
                  {breaches.length > 4 && (
                    <div className="text-[10px] text-slate-500">+{breaches.length - 4} more breaches</div>
                  )}
                </div>
              )}

              <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                {towers.map((tw) => (
                  <div
                    key={tw.tower_id}
                    className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/40 text-[11px] space-y-1 transition"
                  >
                    <div className="font-bold text-cyan-300 truncate">{tw.tower_id}</div>
                    <div className="flex justify-between text-slate-400 text-[10px]">
                      <span>Operator: {tw.operator}</span>
                      <span className="font-bold text-emerald-400">{tw.total_hits} hits</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      GPS: {round(tw.latitude)}, {round(tw.longitude)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OSINT Modal */}
      {osintPhone && (
        <OSINTModal phone={osintPhone} onClose={() => setOsintPhone(null)} />
      )}
    </div>
  );
}

function round(n) {
  return typeof n === 'number' ? n.toFixed(4) : n;
}
