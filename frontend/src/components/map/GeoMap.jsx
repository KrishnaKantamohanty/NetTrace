import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';

// Center updater helper
function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

export default function GeoMap({
  towers = [],
  routePoints = [],
  activePointIndex = null,
  center = [28.6139, 77.2090], // Delhi NCR center default
  zoom = 11,
  onSelectTower = null,
  geofences = [],
}) {
  // Custom DivIcon for cell towers
  const createTowerIcon = (hits) => {
    return L.divIcon({
      className: 'custom-tower-marker',
      html: `
        <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(6, 182, 212, 0.25); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 14px; height: 14px; border-radius: 50%; background: #06b6d4; border: 2px solid #ffffff; box-shadow: 0 0 8px #06b6d4;"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  // Custom DivIcon for suspect breadcrumb point
  const createSuspectIcon = (isCurrent = false) => {
    const bg = isCurrent ? '#f43f5e' : '#e11d48';
    const size = isCurrent ? 20 : 12;
    return L.divIcon({
      className: 'custom-suspect-marker',
      html: `
        <div style="width: ${size}px; height: ${size}px; border-radius: 50%; background: ${bg}; border: 2px solid #ffffff; box-shadow: 0 0 10px ${bg}; ${isCurrent ? 'animation: bounce 1s infinite;' : ''}"></div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  // Polyline coordinates from route points
  const polylinePositions = routePoints
    .filter(p => p.latitude && p.longitude)
    .map(p => [p.latitude, p.longitude]);

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden border border-slate-800 bg-[#070b14]">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: '100%', height: '100%', background: '#070b14' }}
        scrollWheelZoom={true}
        className="dark-tiles"
      >
        <ChangeView center={center} zoom={zoom} />
        {/* OpenStreetMap tiles - free, no API key required */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains={['a', 'b', 'c']}
          maxZoom={19}
        />

        {/* Cell Tower Markers */}
        {towers.map((tw) => (
          <Marker
            key={tw.tower_id}
            position={[tw.latitude, tw.longitude]}
            icon={createTowerIcon(tw.total_hits)}
            eventHandlers={{
              click: () => onSelectTower && onSelectTower(tw),
            }}
          >
            <Popup className="custom-popup">
              <div className="p-1 font-mono text-xs text-slate-800">
                <div className="font-bold text-cyan-800">{tw.tower_id}</div>
                <div>Operator: <b>{tw.operator}</b></div>
                <div>Total Hits: <b>{tw.total_hits}</b></div>
                <div>Coordinates: {roundCoord(tw.latitude)}, {roundCoord(tw.longitude)}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Suspect Route Polyline */}
        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{ color: '#f43f5e', weight: 3, opacity: 0.8, dashArray: '6, 6' }}
          />
        )}

        {/* Suspect Breadcrumbs */}
        {routePoints.map((pt, idx) => {
          const isCurrent = activePointIndex === idx;
          return (
            <Marker
              key={pt.id || idx}
              position={[pt.latitude, pt.longitude]}
              icon={createSuspectIcon(isCurrent)}
            >
              <Popup>
                <div className="p-1 font-mono text-xs text-slate-800">
                  <div className="font-bold text-rose-700">Suspect Step #{idx + 1}</div>
                  <div>Time: {new Date(pt.timestamp).toLocaleString()}</div>
                  <div>Caller: {pt.caller}</div>
                  <div>Receiver: {pt.receiver}</div>
                  <div>Tower: {pt.tower_id}</div>
                  <div>Duration: {pt.duration}s ({pt.call_type})</div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Geofence Perimeter Circles */}
        {geofences.map((gf, i) => (
          <Circle
            key={gf.id || i}
            center={[gf.center_lat, gf.center_lng]}
            radius={gf.radius_meters || 500}
            pathOptions={{
              color: gf.has_breach ? '#f43f5e' : '#f59e0b',
              fillColor: gf.has_breach ? '#f43f5e' : '#f59e0b',
              fillOpacity: 0.08,
              weight: 2,
              dashArray: gf.has_breach ? '4, 4' : '8, 4',
            }}
          >
            <Popup>
              <div className="p-1 font-mono text-xs">
                <div className="font-bold text-amber-700">{gf.name || `Geofence ${i + 1}`}</div>
                <div>Radius: {gf.radius_meters}m</div>
                <div>Status: {gf.has_breach ? '🔴 BREACH DETECTED' : '🟡 Active'}</div>
                {gf.breach_count > 0 && <div>Breaches: {gf.breach_count}</div>}
              </div>
            </Popup>
          </Circle>
        ))}
      </MapContainer>

      {/* Map Legend HUD - Top Right to avoid collision with playback scrubber */}
      <div className="absolute top-4 right-4 bg-[#090d16]/90 border border-slate-700/80 backdrop-blur-md rounded-lg p-2.5 font-mono text-[10px] space-y-1.5 z-[1000] shadow-xl pointer-events-none">
        <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Map Legend</div>
        <div className="flex items-center gap-2 text-slate-300">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-white"></div>
          <span>Cell Tower (BTS)</span>
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white"></div>
          <span>Suspect Breadcrumb</span>
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <div className="w-4 h-0.5 border-t-2 border-dashed border-rose-500"></div>
          <span>Trajectory Path</span>
        </div>
        {geofences.length > 0 && (
          <div className="flex items-center gap-2 text-slate-300">
            <div className="w-2.5 h-2.5 rounded-full border-2 border-amber-400 bg-amber-400/10"></div>
            <span>Geofence Zone</span>
          </div>
        )}
      </div>
    </div>
  );
}

function roundCoord(c) {
  return typeof c === 'number' ? c.toFixed(4) : c;
}
