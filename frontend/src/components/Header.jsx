import React from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Cpu, 
  Radio, 
  Wifi, 
  WifiOff 
} from 'lucide-react';

export default function Header({ 
  firmwareState, 
  redLed, 
  buzzerActive, 
  audioEnabled, 
  onToggleAudio, 
  onResetFirmware, 
  isConnected,
  uptimeSec 
}) {
  const isAlarm = firmwareState === 'STATE_ALARM';

  const formatUptime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  return (
    <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md px-4 lg:px-8 py-3.5 shadow-xl transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: Branding & Subsystem Specs */}
        <div className="flex items-center gap-3.5">
          <div className={`p-2.5 rounded-xl border flex items-center justify-center transition-all duration-300 ${
            isAlarm 
              ? 'bg-red-500/10 border-red-500/40 text-red-400 animate-beacon' 
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            {isAlarm ? <ShieldAlert className="w-6 h-6 animate-pulse" /> : <ShieldCheck className="w-6 h-6" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                SafeGuard AI
              </h1>
              <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-medium">
                Physical AI Sentinel
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>PipeGen v0.5.1</span>
              <span>•</span>
              <span>FirmGen v0.4.1 (BARR-C)</span>
              <span>•</span>
              <span className="font-mono text-slate-400">ESP-IDF v5.5</span>
            </div>
          </div>
        </div>

        {/* Center: Live Actuator Hardware Pills */}
        <div className="flex items-center gap-3 bg-slate-950/70 px-4 py-2 rounded-xl border border-slate-800/80 shadow-inner">
          
          {/* FSM State Badge */}
          <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">State:</span>
            <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-all ${
              isAlarm 
                ? 'bg-red-950/80 border-red-600 text-red-300 animate-pulse shadow-sm shadow-red-500/30' 
                : 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isAlarm ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`} />
              {firmwareState || 'STATE_NORMAL'}
            </span>
          </div>

          {/* Actuator Statuses */}
          <div className="flex items-center gap-2.5 text-xs font-mono">
            {/* Red Beacon LED */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">GPIO 2 (LED):</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                redLed 
                  ? 'bg-red-500 text-white border-red-400 animate-pulse shadow-md shadow-red-500/50' 
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {redLed ? 'HIGH (ON)' : 'LOW (OFF)'}
              </span>
            </div>

            {/* Piezo Buzzer */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <span className="text-slate-400">GPIO 4 (BUZZ):</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                buzzerActive 
                  ? 'bg-amber-500 text-black border-amber-400 animate-pulse shadow-md shadow-amber-500/40' 
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {buzzerActive ? '2.4kHz ACTIVE' : 'IDLE'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Controls & Connection Pill */}
        <div className="flex items-center gap-2.5">
          {/* Audio Synthesizer Toggle */}
          <button
            onClick={onToggleAudio}
            title={audioEnabled ? "Mute Acoustic Warning Buzzer" : "Enable Acoustic Warning Buzzer"}
            className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              audioEnabled 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                : 'bg-slate-900 hover:bg-slate-800 text-slate-500 border-slate-800 line-through'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            <span className="hidden sm:inline">{audioEnabled ? 'Audio Buzzer ON' : 'Muted'}</span>
          </button>

          {/* Manual Emergency Reset Button */}
          <button
            onClick={onResetFirmware}
            title="Manual Operator Reset Command (REQ-007)"
            className="px-3 py-2 rounded-lg bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset FSM</span>
          </button>

          {/* WebSocket Connection Pill */}
          <div 
            title={isConnected ? "WebSocket stream connected" : "Connecting to backend..."}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium ${
              isConnected 
                ? 'bg-emerald-950/50 border-emerald-800/80 text-emerald-400' 
                : 'bg-amber-950/50 border-amber-800/80 text-amber-400 animate-pulse'
            }`}
          >
            {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden xl:inline">{isConnected ? 'WS LIVE' : 'CONNECTING'}</span>
          </div>
        </div>

      </div>
    </header>
  );
}
