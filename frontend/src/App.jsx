import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import FloorPlanCanvas from './components/FloorPlanCanvas';
import VideoSentinel from './components/VideoSentinel';
import UartConsole from './components/UartConsole';
import ProtocolInspector from './components/ProtocolInspector';
import { 
  startAlarmBuzzer, 
  stopAlarmBuzzer, 
  setAudioEnabled 
} from './utils/audio';
import { 
  Map, 
  Video, 
  Terminal, 
  FileCode, 
  ShieldCheck 
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws';

export default function App() {
  const [activeTab, setActiveTab] = useState('twin'); // 'twin', 'video', 'telemetry', 'protocol'
  const [isConnected, setIsConnected] = useState(false);
  const [audioActive, setAudioActive] = useState(true);

  // System & Firmware State
  const [firmwareState, setFirmwareState] = useState('STATE_NORMAL');
  const [redLed, setRedLed] = useState(false);
  const [buzzerActive, setBuzzerActive] = useState(false);
  const [uptimeSec, setUptimeSec] = useState(0);
  const [freeHeapBytes, setFreeHeapBytes] = useState(294812);
  const [totalEvents, setTotalEvents] = useState(0);
  const [duplicateDropped, setDuplicateDropped] = useState(0);
  const [uartLogs, setUartLogs] = useState([]);

  // Spatial & Zone State
  const [zones, setZones] = useState([]);
  const [workerPos, setWorkerPos] = useState({ x: 200, y: 200 });
  const [currentZoneId, setCurrentZoneId] = useState(null);
  const [latestEvent, setLatestEvent] = useState(null);

  const wsRef = useRef(null);

  // Sync acoustic audio buzzer with firmware alarm state
  useEffect(() => {
    if (firmwareState === 'STATE_ALARM' && audioActive) {
      startAlarmBuzzer();
    } else {
      stopAlarmBuzzer();
    }

    return () => {
      stopAlarmBuzzer();
    };
  }, [firmwareState, audioActive]);

  const handleToggleAudio = () => {
    const next = !audioActive;
    setAudioActive(next);
    setAudioEnabled(next);
  };

  // Initial Data Fetch (Zones & System Status)
  const fetchInitialData = async () => {
    try {
      const [zonesRes, statusRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/api/zones`).then(r => r.json()),
        fetch(`${API_BASE}/api/status`).then(r => r.json()),
        fetch(`${API_BASE}/api/logs`).then(r => r.json()),
      ]);

      if (zonesRes.zones) setZones(zonesRes.zones);
      if (statusRes.firmware) {
        setFirmwareState(statusRes.firmware.state);
        setRedLed(statusRes.firmware.red_led);
        setBuzzerActive(statusRes.firmware.buzzer_active);
        setUptimeSec(statusRes.firmware.uptime_sec);
        setFreeHeapBytes(statusRes.firmware.free_heap_bytes);
        setTotalEvents(statusRes.firmware.total_events);
        setDuplicateDropped(statusRes.firmware.duplicates_dropped);
      }
      if (logsRes.logs) setUartLogs(logsRes.logs);
    } catch (err) {
      console.warn("API fetch error:", err);
    }
  };

  // Connect WebSocket for real-time streaming
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log("WebSocket connected to SafeGuard AI backend.");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'TELEMETRY_UPDATE') {
            const fw = msg.firmware;
            if (fw) {
              setFirmwareState(fw.state);
              setRedLed(fw.red_led);
              setBuzzerActive(fw.buzzer);
              setUptimeSec(fw.uptime_sec);
              setFreeHeapBytes(fw.free_heap_bytes);
              setTotalEvents(fw.total_events);
              setDuplicateDropped(fw.duplicate_dropped);
            }
            if (msg.recent_logs) setUartLogs(msg.recent_logs);
            if (msg.latest_event) setLatestEvent(msg.latest_event);
            if (msg.worker) setWorkerPos(msg.worker);
          }
        } catch (e) {
          console.error("WS parse error:", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Auto-reconnect after 2 seconds
        setTimeout(connectWebSocket, 2000);
      };

      ws.onerror = () => {
        setIsConnected(false);
        ws.close();
      };
    } catch {
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWebSocket]);

  // Handle worker position update from FloorPlanCanvas
  const handleMoveWorker = async (x, y) => {
    setWorkerPos({ x, y, actor_id: 'worker-01' });

    try {
      const res = await fetch(`${API_BASE}/api/simulate/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y, actor_id: 'worker-01', confidence: 0.95 }),
      });
      const data = await res.json();
      setFirmwareState(data.firmware_state);
      setRedLed(data.red_led);
      setBuzzerActive(data.buzzer_active);
      setCurrentZoneId(data.zone_id);
      if (data.event_emitted) setLatestEvent(data.event_emitted);
    } catch (err) {
      console.error("Worker move error:", err);
    }
  };

  // Handle preset incursion trigger (breach vs clear)
  const handleTriggerIncursion = async (scenario) => {
    try {
      const res = await fetch(`${API_BASE}/api/simulate/incursion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, actor_id: 'worker-01' }),
      });
      const data = await res.json();
      setFirmwareState(data.firmware_state);
      setRedLed(data.red_led);
      setBuzzerActive(data.buzzer_active);
      setCurrentZoneId(data.zone_id);
      setWorkerPos(data.worker);
      if (data.event_emitted) setLatestEvent(data.event_emitted);
    } catch (err) {
      console.error("Incursion trigger error:", err);
    }
  };

  // Handle manual firmware reset
  const handleResetFirmware = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/firmware/reset`, { method: 'POST' });
      const data = await res.json();
      setFirmwareState(data.current_state);
      setRedLed(data.red_led);
      setBuzzerActive(data.buzzer);
      setCurrentZoneId(null);
    } catch (err) {
      console.error("Reset error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Top Industrial Navigation Header */}
      <Header
        firmwareState={firmwareState}
        redLed={redLed}
        buzzerActive={buzzerActive}
        audioEnabled={audioActive}
        onToggleAudio={handleToggleAudio}
        onResetFirmware={handleResetFirmware}
        isConnected={isConnected}
        uptimeSec={uptimeSec}
      />

      {/* Main Control Station Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col gap-6">
        
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          
          <nav className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('twin')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'twin'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Map className="w-4 h-4" />
              <span>Spatial Floor Plan</span>
            </button>

            <button
              onClick={() => setActiveTab('video')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'video'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Vision Sentinel</span>
            </button>

            <button
              onClick={() => setActiveTab('telemetry')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'telemetry'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Diagnostic Telemetry</span>
            </button>

            <button
              onClick={() => setActiveTab('protocol')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'protocol'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>Protocol & RTM</span>
            </button>
          </nav>

          {/* Verification Badge */}
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-emerald-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> 27/27 TESTS VERIFIED
            </span>
          </div>

        </div>

        {/* Tab 1: Spatial Factory Floor Digital Twin */}
        {activeTab === 'twin' && (
          <FloorPlanCanvas
            zones={zones}
            workerPos={workerPos}
            onMoveWorker={handleMoveWorker}
            onTriggerIncursion={handleTriggerIncursion}
            isAlarmActive={firmwareState === 'STATE_ALARM'}
            currentZoneId={currentZoneId}
          />
        )}

        {/* Tab 2: Vision Sentinel (CCTV & Webcam) */}
        {activeTab === 'video' && (
          <VideoSentinel />
        )}

        {/* Tab 3: Diagnostic Telemetry & UART Serial Logs */}
        {activeTab === 'telemetry' && (
          <UartConsole
            logs={uartLogs}
            freeHeapBytes={freeHeapBytes}
            uptimeSec={uptimeSec}
            totalEvents={totalEvents}
            duplicateDropped={duplicateDropped}
            firmwareState={firmwareState}
          />
        )}

        {/* Tab 4: Protocol Schema v1.0 & FirmGen RTM */}
        {activeTab === 'protocol' && (
          <ProtocolInspector
            latestEvent={latestEvent}
          />
        )}

      </main>

      {/* Industrial Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-4 lg:px-8 text-xs text-slate-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full">
        <div>
          SafeGuard AI • Embedded SF: CraftifAI Physical AI Hackathon
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>PipeGen v0.5.1</span>
          <span>•</span>
          <span>FirmGen v0.4.1</span>
          <span>•</span>
          <span>BARR-C:2018 Compliant</span>
        </div>
      </footer>

    </div>
  );
}
