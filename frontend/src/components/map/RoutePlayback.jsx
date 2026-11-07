import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Clock, Navigation } from 'lucide-react';

export default function RoutePlayback({
  route = [],
  currentIndex = 0,
  onIndexChange,
  targetNumber = ''
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000); // ms per step

  useEffect(() => {
    let timer;
    if (isPlaying && route.length > 0) {
      timer = setInterval(() => {
        onIndexChange((prev) => {
          if (prev >= route.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, route.length, speed, onIndexChange]);

  if (!route || route.length === 0) {
    return null;
  }

  const currentPt = route[currentIndex] || route[0];

  return (
    <div className="p-4 rounded-xl cyber-card border border-rose-500/30 bg-[#090d16]/95 backdrop-blur-md space-y-3 font-mono">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-rose-400 animate-pulse" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Suspect Movement Playback
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/30">
            {targetNumber}
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          Step <b>{currentIndex + 1}</b> of <b>{route.length}</b>
        </div>
      </div>

      {/* Scrubbing timeline slider */}
      <input
        type="range"
        min={0}
        max={route.length - 1}
        value={currentIndex}
        onChange={(e) => onIndexChange(Number(e.target.value))}
        className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
      />

      {/* Playback Controls & Speed */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onIndexChange((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-900/30"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'Pause' : 'Play Route'}
          </button>

          <button
            onClick={() => onIndexChange((prev) => Math.min(route.length - 1, prev + 1))}
            disabled={currentIndex === route.length - 1}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              onIndexChange(0);
            }}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Reset to beginning"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Speed toggle */}
        <div className="flex items-center gap-1 text-[10px]">
          <span className="text-slate-500 mr-1">Speed:</span>
          {[
            { label: '1x', val: 1200 },
            { label: '2x', val: 600 },
            { label: '5x', val: 250 },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => setSpeed(s.val)}
              className={`px-2 py-0.5 rounded ${
                speed === s.val ? 'bg-rose-500 text-white font-bold' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Current Breadcrumb Details */}
      {currentPt && (
        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-300">
          <div>
            <div className="text-[10px] text-slate-500">TIMESTAMP</div>
            <div className="text-rose-400 font-bold">{new Date(currentPt.timestamp).toLocaleTimeString()}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">CELL TOWER ID</div>
            <div className="truncate text-cyan-300">{currentPt.tower_id || 'N/A'}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">COUNTERPART</div>
            <div className="truncate">{currentPt.receiver}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">DURATION / TYPE</div>
            <div>{currentPt.duration}s ({currentPt.call_type})</div>
          </div>
        </div>
      )}
    </div>
  );
}
