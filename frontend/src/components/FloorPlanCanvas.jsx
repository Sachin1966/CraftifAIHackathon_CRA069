import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Crosshair, 
  AlertTriangle, 
  CheckCircle2, 
  Move, 
  Maximize2, 
  Sliders, 
  Compass, 
  MapPin 
} from 'lucide-react';

export default function FloorPlanCanvas({ 
  zones = [], 
  workerPos = { x: 200, y: 200 }, 
  onMoveWorker, 
  onTriggerIncursion, 
  isAlarmActive,
  currentZoneId 
}) {
  const svgRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localPos, setLocalPos] = useState(workerPos);
  const [mouseCanvasCoords, setMouseCanvasCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setLocalPos(workerPos);
  }, [workerPos]);

  // Transform client mouse coordinate into SVG viewBox coordinates (800x600)
  const getSVGCoordinates = useCallback((e) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = 800 / rect.width;
    const scaleY = 600 / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    let x = (clientX - rect.left) * scaleX;
    let y = (clientY - rect.top) * scaleY;

    // Constrain to canvas bounds
    x = Math.max(20, Math.min(780, Math.round(x)));
    y = Math.max(20, Math.min(580, Math.round(y)));

    return { x, y };
  }, []);

  const handlePointerDown = (e) => {
    setIsDragging(true);
    const coords = getSVGCoordinates(e);
    setLocalPos(coords);
    onMoveWorker(coords.x, coords.y);
  };

  const handlePointerMove = (e) => {
    const coords = getSVGCoordinates(e);
    setMouseCanvasCoords(coords);

    if (isDragging) {
      setLocalPos(coords);
      onMoveWorker(coords.x, coords.y);
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Convert polygon vertices array [[x, y], ...] into SVG points string "x1,y1 x2,y2 ..."
  const formatPolygonPoints = (vertices) => {
    return vertices.map(([x, y]) => `${x},${y}`).join(' ');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:p-6 shadow-xl flex flex-col gap-4">
      
      {/* Header & Controls bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-blue-400" />
            Interactive Factory Floor Digital Twin
          </h2>
          <p className="text-xs text-slate-400">
            Click or drag the personnel avatar to simulate real-time spatial breach detection.
          </p>
        </div>

        {/* Live Coordinate Badges */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center gap-1.5">
            <span className="text-slate-500">POS:</span>
            <span className="text-blue-400 font-bold">X:{Math.round(localPos.x)} Y:{Math.round(localPos.y)}</span>
          </div>

          <div className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 font-bold ${
            isAlarmActive 
              ? 'bg-red-950/80 border-red-700 text-red-300 animate-pulse' 
              : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
          }`}>
            {isAlarmActive ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span>ZONE BREACH: {currentZoneId || 'ACTIVE'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>SAFE PASSAGE</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Interactive SVG Floor Map */}
      <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner select-none cursor-crosshair">
        
        {/* Background Grid Pattern */}
        <svg 
          ref={svgRef}
          viewBox="0 0 800 600" 
          className="w-full h-full"
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        >
          <defs>
            {/* Fine Grid Blueprint */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
            </pattern>
            <pattern id="majorGrid" width="160" height="160" patternUnits="userSpaceOnUse">
              <path d="M 160 0 L 0 0 0 160" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1.5" />
            </pattern>

            {/* Warning Diagonal Stripe Pattern */}
            <pattern id="dangerHatch" width="20" height="20" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="20" stroke="rgba(239, 68, 68, 0.25)" strokeWidth="8" />
            </pattern>
            <pattern id="cautionHatch" width="20" height="20" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="20" stroke="rgba(245, 158, 11, 0.2)" strokeWidth="6" />
            </pattern>
          </defs>

          {/* Grid Background */}
          <rect width="800" height="600" fill="#070b14" />
          <rect width="800" height="600" fill="url(#grid)" />
          <rect width="800" height="600" fill="url(#majorGrid)" />

          {/* Safe Walkway Demarcation Lines */}
          <path 
            d="M 50 250 L 750 250 M 50 290 L 750 290" 
            stroke="rgba(34, 197, 94, 0.25)" 
            strokeWidth="2" 
            strokeDasharray="6 6" 
          />
          <text x="60" y="275" fill="rgba(34, 197, 94, 0.4)" fontSize="12" fontFamily="monospace" fontWeight="bold">
            GREEN WALKWAY CORRIDOR (AUTHORIZED ACCESS)
          </text>

          {/* Restricted Zones Rendered from Config */}
          {zones.map((zone) => {
            const isTargetZone = zone.zone_id === 'zone-machine-danger-1';
            const isBreached = isAlarmActive && currentZoneId === zone.zone_id;

            return (
              <g key={zone.zone_id}>
                {/* Hazard Polygon Fill & Stroke */}
                <polygon
                  points={formatPolygonPoints(zone.polygon)}
                  fill={isTargetZone ? 'url(#dangerHatch)' : 'url(#cautionHatch)'}
                  stroke={isBreached ? '#ef4444' : (isTargetZone ? '#dc2626' : '#d97706')}
                  strokeWidth={isBreached ? '4' : '2'}
                  strokeDasharray={isBreached ? 'none' : '8 4'}
                  className={`transition-all duration-300 ${isBreached ? 'filter drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]' : ''}`}
                />

                {/* Zone Label & Boundary Tag */}
                <text
                  x={zone.polygon[0][0] + 12}
                  y={zone.polygon[0][1] + 24}
                  fill={isTargetZone ? '#f87171' : '#fbbf24'}
                  fontSize="12"
                  fontFamily="monospace"
                  fontWeight="bold"
                  className="pointer-events-none select-none"
                >
                  ⚠️ {zone.zone_name.toUpperCase()} [{zone.severity}]
                </text>
              </g>
            );
          })}

          {/* Machine Work Cell Asset Mockups */}
          {/* Robotic Arm Base inside Stamping Cell */}
          <rect x="470" y="400" width="60" height="60" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />
          <circle cx="500" cy="430" r="18" fill="#334155" stroke="#64748b" strokeWidth="2" />
          <text x="465" y="480" fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="middle">
            ROBOT CELL 01
          </text>

          {/* AGV Crossing Node */}
          <rect x="140" y="90" width="70" height="40" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
          <text x="175" y="115" fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="middle">
            AGV DOCK
          </text>

          {/* Worker Personnel Puck & Foot Point (Draggable) */}
          <g transform={`translate(${localPos.x}, ${localPos.y})`} className="cursor-grab active:cursor-grabbing transition-transform">
            
            {/* Outer detection halo */}
            <circle 
              r="24" 
              fill={isAlarmActive ? "rgba(239, 68, 68, 0.25)" : "rgba(59, 130, 246, 0.2)"} 
              stroke={isAlarmActive ? "#ef4444" : "#3b82f6"} 
              strokeWidth="2" 
              className={isAlarmActive ? "animate-ping" : ""}
            />

            {/* Target Crosshair */}
            <line x1="-14" y1="0" x2="14" y2="0" stroke={isAlarmActive ? "#ef4444" : "#3b82f6"} strokeWidth="1.5" />
            <line x1="0" y1="-14" x2="0" y2="14" stroke={isAlarmActive ? "#ef4444" : "#3b82f6"} strokeWidth="1.5" />

            {/* Center Foot Point Dot */}
            <circle 
              r="5" 
              fill={isAlarmActive ? "#ef4444" : "#3b82f6"} 
              stroke="#ffffff" 
              strokeWidth="1.5" 
            />

            {/* Personnel Badge Tag */}
            <g transform="translate(0, -32)">
              <rect 
                x="-45" 
                y="-14" 
                width="90" 
                height="20" 
                rx="4" 
                fill="#0f172a" 
                stroke={isAlarmActive ? "#ef4444" : "#475569"} 
                strokeWidth="1" 
              />
              <text 
                x="0" 
                y="0" 
                fill={isAlarmActive ? "#fca5a5" : "#e2e8f0"} 
                fontSize="10" 
                fontFamily="monospace" 
                fontWeight="bold" 
                textAnchor="middle"
              >
                {isAlarmActive ? '🚨 INTRUDER' : '👤 WORKER-01'}
              </text>
            </g>
          </g>
        </svg>

        {/* Overlay Instructions Badge */}
        <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 font-mono px-3 py-1.5 rounded-lg backdrop-blur-sm pointer-events-none flex items-center gap-2">
          <Move className="w-3.5 h-3.5 text-blue-400" />
          <span>DRAG WORKER TO TEST BOUNDARIES</span>
        </div>
      </div>

      {/* Interactive Controls & Preset Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        
        {/* Instant Scenario Trigger Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTriggerIncursion('breach')}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 active:scale-95 transition-all"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>TRIGGER INTRUSION (BREACH)</span>
          </button>

          <button
            onClick={() => onTriggerIncursion('clear')}
            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>CLEAR TO SAFE WALKWAY</span>
          </button>
        </div>

        {/* Sliders for Precision Coordinate Positioning */}
        <div className="flex items-center gap-4 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 font-mono text-xs">
          <div className="flex-1 flex items-center gap-2">
            <span className="text-slate-500 font-bold">X:</span>
            <input 
              type="range" 
              min="30" 
              max="770" 
              value={localPos.x} 
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setLocalPos(prev => ({ ...prev, x: val }));
                onMoveWorker(val, localPos.y);
              }}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-slate-300 w-8 text-right">{Math.round(localPos.x)}</span>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <span className="text-slate-500 font-bold">Y:</span>
            <input 
              type="range" 
              min="30" 
              max="570" 
              value={localPos.y} 
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setLocalPos(prev => ({ ...prev, y: val }));
                onMoveWorker(localPos.x, val);
              }}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-slate-300 w-8 text-right">{Math.round(localPos.y)}</span>
          </div>
        </div>

      </div>

    </div>
  );
}
