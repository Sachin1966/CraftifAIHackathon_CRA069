import React, { useRef, useEffect, useState } from 'react';
import { 
  Terminal, 
  Cpu, 
  Activity, 
  Trash2, 
  Copy, 
  Check, 
  ShieldAlert, 
  HardDrive 
} from 'lucide-react';

export default function UartConsole({ 
  logs = [], 
  freeHeapBytes = 294812, 
  uptimeSec = 0, 
  totalEvents = 0, 
  duplicateDropped = 0,
  firmwareState = 'STATE_NORMAL' 
}) {
  const terminalEndRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [localLogs, setLocalLogs] = useState(logs);

  useEffect(() => {
    setLocalLogs(logs);
  }, [logs]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localLogs]);

  const handleCopy = () => {
    navigator.clipboard.writeText(localLogs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setLocalLogs([]);
  };

  // Color syntax highlighter for UART log lines
  const renderLogLine = (line, idx) => {
    let colorClass = "text-slate-300";
    if (line.includes("STATE_ALARM")) colorClass = "text-red-400 font-bold";
    else if (line.includes("STATE_NORMAL")) colorClass = "text-emerald-400 font-semibold";
    else if (line.includes("BOOT") || line.includes("REQ-001")) colorClass = "text-cyan-400";
    else if (line.includes("ERR_") || line.includes("MALFORMED")) colorClass = "text-amber-400";
    else if (line.includes("WARN_DUPLICATE")) colorClass = "text-yellow-400";

    return (
      <div key={idx} className={`leading-relaxed py-0.5 ${colorClass}`}>
        <span className="text-slate-600 select-none mr-2 font-mono text-[10px]">
          {(idx + 1).toString().padStart(3, '0')}
        </span>
        {line}
      </div>
    );
  };

  const maxHeap = 520000; // 520 KB ESP32 SRAM
  const heapPercent = Math.min(100, Math.round((freeHeapBytes / maxHeap) * 100));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:p-6 shadow-xl flex flex-col gap-4">
      
      {/* Header & Terminal Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-cyan-400" />
            ESP32 UART Diagnostic Console (115200 Baud)
          </h2>
          <p className="text-xs text-slate-400">
            Real-time serial stream from FirmGen-synthesized firmware (REQ-006 & REQ-009).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleClear}
            className="p-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 text-xs font-mono flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Hardware Telemetry Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        
        {/* Free Internal Heap */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center justify-between">
            <span>Free Heap (SRAM)</span>
            <HardDrive className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="text-sm font-mono font-bold text-white mt-1">
            {freeHeapBytes.toLocaleString()} <span className="text-xs font-normal text-slate-500">bytes</span>
          </div>
          {/* Heap Progress Bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-cyan-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${heapPercent}%` }} 
            />
          </div>
        </div>

        {/* System Uptime */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center justify-between">
            <span>FreeRTOS Uptime</span>
            <Activity className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="text-sm font-mono font-bold text-emerald-400 mt-1">
            {uptimeSec} <span className="text-xs font-normal text-slate-500">seconds</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-2">Zero Drift Task</div>
        </div>

        {/* Duplicate Ring Buffer Dropped */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center justify-between">
            <span>Duplicates Dropped</span>
            <Cpu className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-sm font-mono font-bold text-amber-400 mt-1">
            {duplicateDropped} <span className="text-xs font-normal text-slate-500">suppressed</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-2">16-Entry Ring Buffer</div>
        </div>

        {/* Total Events Ingested */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center justify-between">
            <span>Total Events Ingested</span>
            <Check className="w-3 h-3 text-blue-400" />
          </div>
          <div className="text-sm font-mono font-bold text-blue-400 mt-1">
            {totalEvents} <span className="text-xs font-normal text-slate-500">packets</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-2">Schema v1.0 Validated</div>
        </div>

      </div>

      {/* Retro-Monospace UART Terminal Box */}
      <div className="bg-[#050811] border border-slate-800/90 rounded-xl p-4 font-mono text-xs overflow-y-auto max-h-72 min-h-[180px] shadow-inner select-text">
        {localLogs.length === 0 ? (
          <div className="text-slate-600 italic">Waiting for serial telemetry from ESP32 UART...</div>
        ) : (
          localLogs.map((log, idx) => renderLogLine(log, idx))
        )}
        <div ref={terminalEndRef} />
      </div>

    </div>
  );
}
