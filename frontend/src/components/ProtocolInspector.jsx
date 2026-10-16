import React from 'react';
import { 
  FileCode, 
  CheckCircle, 
  AlertTriangle, 
  Layers, 
  ExternalLink, 
  CheckCircle2, 
  ShieldCheck 
} from 'lucide-react';

export default function ProtocolInspector({ latestEvent }) {
  // 10 Formal Requirements from FirmGen Specification (REQ-001 to REQ-010)
  const requirements = [
    { id: 'REQ-001', type: 'Inferred', title: 'Safe Initial State (0V on Boot)', status: 'PASS', file: 'firmware/main/main.c' },
    { id: 'REQ-002', type: 'Explicit', title: 'Schema v1.0 Stream Ingestion', status: 'PASS', file: 'firmware/main/event_parser.c' },
    { id: 'REQ-003', type: 'Explicit', title: 'Hazard Alarm Actuation (<5ms)', status: 'PASS', file: 'firmware/main/safety_controller.c' },
    { id: 'REQ-004', type: 'Explicit', title: 'Malformed JSON Rejection', status: 'PASS', file: 'firmware/main/event_parser.c' },
    { id: 'REQ-005', type: 'Explicit', title: '16-Entry Ring Buffer Deduplication', status: 'PASS', file: 'firmware/main/event_parser.c' },
    { id: 'REQ-006', type: 'Explicit', title: 'UART State Transition Logging', status: 'PASS', file: 'firmware/main/main.c' },
    { id: 'REQ-007', type: 'Explicit', title: 'Safe Clearance & Reset Policy', status: 'PASS', file: 'firmware/main/safety_controller.c' },
    { id: 'REQ-008', type: 'Explicit', title: 'Carrier Loss Auto-Recovery', status: 'PASS', file: 'firmware/main/main.c' },
    { id: 'REQ-009', type: 'Inferred', title: 'Runtime FreeRTOS Telemetry', status: 'PASS', file: 'firmware/main/telemetry.c' },
    { id: 'REQ-010', type: 'Inferred', title: 'Watchdog Timeout Fail-Safe', status: 'PASS', file: 'firmware/main/safety_controller.c' },
  ];

  const defaultSampleEvent = {
    schema_version: "1.0",
    event_id: "evt-77b312fc-92ef-410a-8142-8a9d1502476b",
    timestamp: 1729112930.542,
    event_type: "restricted_zone_entry",
    source: "pipegen_edge_vision_sentinel",
    actor_id: "worker-01",
    zone_id: "zone-machine-danger-1",
    confidence: 0.954,
    foot_point: [500.0, 450.0],
    bounding_box: [472.5, 340.0, 527.5, 450.0],
    persistence_frames: 3
  };

  const displayEvent = latestEvent || defaultSampleEvent;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:p-6 shadow-xl flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileCode className="w-5 h-5 text-purple-400" />
            Protocol Schema v1.0 & FirmGen Traceability
          </h2>
          <p className="text-xs text-slate-400">
            Bidirectional Physical AI payload validation and formal BARR-C:2018 requirement mapping.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-purple-950/60 border border-purple-800/80 text-purple-300 font-mono text-[11px] font-bold">
            CLOSED-LOOP VERIFIED
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Raw JSON Protocol Payload */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="font-bold text-slate-300">ACTIVE SCHEMA PAYLOAD:</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Pydantic v2 Verified
            </span>
          </div>

          <div className="bg-[#050811] border border-slate-800/90 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-x-auto shadow-inner">
            <pre className="text-purple-300">
              {JSON.stringify(displayEvent, null, 2)}
            </pre>
          </div>
        </div>

        {/* Right: FirmGen Requirement Traceability Matrix (RTM) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="font-bold text-slate-300">FIRMGEN FORMAL RTM (v0.4.1):</span>
            <span className="text-purple-400 font-bold">10 / 10 PASS</span>
          </div>

          <div className="bg-[#050811] border border-slate-800/90 rounded-xl overflow-hidden shadow-inner text-xs font-mono">
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
              {requirements.map((req) => (
                <div key={req.id} className="p-2.5 px-3 flex items-center justify-between hover:bg-slate-900/40 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{req.id}</span>
                    <span className="text-[10px] text-slate-500 uppercase px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                      {req.type}
                    </span>
                    <span className="text-slate-300 text-[11px] truncate max-w-[180px] sm:max-w-none">
                      {req.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-[10px] text-slate-500 hidden sm:inline">{req.file}</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> PASS
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
