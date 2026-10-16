"""
SafeGuard AI — Physical AI Safety Sentinel
Enterprise FastAPI Backend Server
Integrates:
 - PipeGen Perception (YOLOv8 + Foot-Point Polygon Containment + Temporal Persistence)
 - Protocol Schema v1.0 Event Bridge
 - FirmGen ESP32 Firmware Subsystem & Bit-Exact Digital Twin
 - Live Intelligence Telemetry & UART Streaming (REST + WebSockets)
"""

import os
import sys
import time
import json
import asyncio
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from bridge.config import load_zones_config
from bridge.event_schema import (
    SafetyEvent,
    EventType,
    EventSource,
    FootPoint,
    BoundingBox,
    FirmwareTelemetry,
    ActuatorState,
)
from perception.zone_filter import (
    RestrictedZone,
    TemporalPersistenceTracker,
    DetectionTarget,
    calculate_foot_point,
)
from simulation.firmware_emulator import ESP32FirmwareEmulator, FirmwareState

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("safeguard.backend")

app = FastAPI(
    title="SafeGuard AI — Physical AI Safety Sentinel API",
    description="Backend microservice uniting edge vision perception with BARR-C compliant ESP32 firmware",
    version="1.0.0",
)

# Enable CORS for React frontend (Vite default is 5173 or 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# Global Subsystem Singletons
# ---------------------------------------------------------
ZONES_FILE_PATH = str(PROJECT_ROOT / "configs" / "zones.json")
raw_zones_data = load_zones_config(ZONES_FILE_PATH)
parsed_zones = [RestrictedZone.from_dict(z) for z in raw_zones_data.get("zones", [])]

persistence_tracker = TemporalPersistenceTracker(
    zones=parsed_zones,
    persistence_threshold_frames=3,
    clearance_dwell_frames=5,
    confidence_threshold=0.55,
    simulation=True,
)
firmware_emulator = ESP32FirmwareEmulator(device_id="ESP32-SAFEGUARD-PRO", duplicate_window_size=16)

# Connected WebSocket clients
active_websockets: List[WebSocket] = []

# Global in-memory state tracking
latest_worker_position = {"x": 200.0, "y": 200.0, "actor_id": "worker-01"}
latest_event: Optional[Dict[str, Any]] = None
custom_uploaded_video_path: Optional[str] = None
frame_counter = 0


class PositionUpdate(BaseModel):
    x: float = Field(..., description="Worker X coordinate")
    y: float = Field(..., description="Worker Y coordinate")
    actor_id: str = Field("worker-01", description="Identifier of tracked worker")
    confidence: float = Field(0.95, description="Detection confidence score")


class IncursionTrigger(BaseModel):
    scenario: str = Field("breach", description="'breach' or 'clear'")
    actor_id: str = Field("worker-01", description="Identifier of worker")


# ---------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------
async def broadcast_state_update():
    """Broadcast current state to all connected WebSocket clients."""
    if not active_websockets:
        return

    telemetry = firmware_emulator.get_telemetry()
    payload = {
        "type": "TELEMETRY_UPDATE",
        "timestamp": time.time(),
        "firmware": {
            "device_id": firmware_emulator.device_id,
            "state": firmware_emulator.current_state,
            "red_led": firmware_emulator.red_led,
            "buzzer": firmware_emulator.buzzer_active,
            "uptime_sec": round(time.time() - firmware_emulator.boot_time, 1),
            "free_heap_bytes": telemetry.free_heap_bytes,
            "total_events": firmware_emulator.total_events_received,
            "duplicate_dropped": firmware_emulator.duplicate_events_dropped,
            "malformed_rejected": firmware_emulator.malformed_events_rejected,
            "active_incident_id": firmware_emulator.active_incident_id,
        },
        "worker": latest_worker_position,
        "latest_event": latest_event,
        "recent_logs": firmware_emulator.uart_logs[-15:],
    }

    dead_connections = []
    for ws in active_websockets:
        try:
            await ws.send_json(payload)
        except Exception:
            dead_connections.append(ws)

    for dead in dead_connections:
        if dead in active_websockets:
            active_websockets.remove(dead)


# ---------------------------------------------------------
# REST API Endpoints
# ---------------------------------------------------------
@app.get("/api/status")
async def get_system_status():
    """Returns the overall health and operational status of SafeGuard AI."""
    telemetry = firmware_emulator.get_telemetry()
    return {
        "status": "OPERATIONAL",
        "system": "SafeGuard AI — Physical AI Safety Sentinel",
        "version": "1.0.0",
        "track": "Track #1: Workplace Safety Sentinel",
        "tools": {
            "perception": "CraftifAI PipeGen v0.5.1",
            "firmware": "CraftifAI FirmGen v0.4.1 (BARR-C:2018)",
            "standards": "FreeRTOS ESP-IDF v5.5",
        },
        "bonuses": {
            "closed_loop": True,
            "live_intelligence": True,
        },
        "firmware": {
            "state": firmware_emulator.current_state,
            "red_led": firmware_emulator.red_led,
            "buzzer_active": firmware_emulator.buzzer_active,
            "uptime_sec": round(time.time() - firmware_emulator.boot_time, 1),
            "free_heap_bytes": telemetry.free_heap_bytes,
            "total_events": firmware_emulator.total_events_received,
            "duplicates_dropped": firmware_emulator.duplicate_events_dropped,
        },
        "zones_count": len(parsed_zones),
    }


@app.get("/api/zones")
async def get_zones():
    """Returns all registered restricted hazard zones with polygon coordinates."""
    return {"zones": raw_zones_data.get("zones", [])}


@app.post("/api/simulate/move")
async def simulate_worker_movement(update: PositionUpdate):
    """
    Receives worker coordinates from interactive canvas/sliders.
    Evaluates foot-point geometry against hazard polygons.
    Dispatches Protocol Schema v1.0 JSON payloads to the firmware emulator.
    """
    global latest_worker_position, latest_event, frame_counter
    frame_counter += 1

    latest_worker_position = {
        "x": update.x,
        "y": update.y,
        "actor_id": update.actor_id,
    }

    # Synthesize bounding box where bottom center is (update.x, update.y)
    box_w = 50.0
    box_h = 100.0
    target_bbox = (
        update.x - box_w / 2.0,
        update.y - box_h,
        update.x + box_w / 2.0,
        update.y,
    )
    target = DetectionTarget(bbox=target_bbox, confidence=update.confidence, track_id=1)

    # Process frame through temporal persistence tracker
    events = persistence_tracker.process_frame_detections([target], frame_index=frame_counter)

    event_emitted = None
    if events:
        for ev in events:
            # Protocol Schema v1.0 JSON serialization
            raw_json = ev.model_dump_json()
            # Send to ESP32 Firmware Emulator via BARR-C ring buffer ingestion
            firmware_emulator.process_raw_message(raw_json)
            event_emitted = ev.model_dump()
            latest_event = event_emitted

    # Broadcast real-time update to all WebSocket listeners
    asyncio.create_task(broadcast_state_update())

    # Check whether worker is currently inside any zone geometrically
    inside_zone_id = None
    foot_point = (update.x, update.y)
    for z in parsed_zones:
        if z.contains_point(foot_point):
            inside_zone_id = z.zone_id
            break

    return {
        "worker": latest_worker_position,
        "inside_zone": inside_zone_id is not None,
        "zone_id": inside_zone_id,
        "firmware_state": firmware_emulator.current_state,
        "red_led": firmware_emulator.red_led,
        "buzzer_active": firmware_emulator.buzzer_active,
        "alarm_active": firmware_emulator.current_state == FirmwareState.STATE_ALARM,
        "event_emitted": event_emitted,
    }


@app.post("/api/simulate/incursion")
async def trigger_incursion(trigger: IncursionTrigger):
    """Triggers an instantaneous breach or safe clearance scenario."""
    if trigger.scenario == "breach":
        # Target coordinate inside zone-machine-danger-1
        coords = PositionUpdate(x=500.0, y=450.0, actor_id=trigger.actor_id)
        # Simulate 3 consecutive frames to satisfy temporal persistence
        res = None
        for _ in range(3):
            res = await simulate_worker_movement(coords)
        return res
    else:
        # Move outside into safe corridor
        coords = PositionUpdate(x=200.0, y=200.0, actor_id=trigger.actor_id)
        # Simulate 5 clearance dwell frames
        res = None
        for _ in range(5):
            res = await simulate_worker_movement(coords)
        return res


@app.post("/api/firmware/reset")
async def reset_firmware():
    """Manual Operator Reset Command (REQ-007)."""
    global latest_event
    firmware_emulator.reset_alarm("Manual Dashboard Operator Reset Button")
    latest_event = None
    asyncio.create_task(broadcast_state_update())
    return {
        "status": "RESET_SUCCESSFUL",
        "current_state": firmware_emulator.current_state,
        "red_led": firmware_emulator.red_led,
        "buzzer": firmware_emulator.buzzer_active,
    }


@app.get("/api/telemetry")
async def get_telemetry():
    """Returns Live Intelligence FreeRTOS telemetry metrics (REQ-009)."""
    telemetry = firmware_emulator.get_telemetry()
    return {
        "device_id": telemetry.device_id,
        "uptime_sec": telemetry.uptime_sec,
        "free_heap_bytes": telemetry.free_heap_bytes,
        "state": telemetry.state,
        "stats": {
            "total_events_received": telemetry.stats.total_events_received,
            "duplicate_events_dropped": telemetry.stats.duplicate_events_dropped,
            "malformed_events_rejected": telemetry.stats.malformed_events_rejected,
        },
        "actuators": {
            "red_led": telemetry.actuators.red_led,
            "buzzer_active": telemetry.actuators.buzzer_active,
        },
    }


@app.get("/api/logs")
async def get_uart_logs(limit: int = 50):
    """Returns recent UART serial logs at 115200 baud (REQ-006)."""
    return {
        "logs": firmware_emulator.uart_logs[-limit:],
        "total_count": len(firmware_emulator.uart_logs),
    }


@app.post("/api/upload/video")
async def upload_video(file: UploadFile = File(...)):
    """Upload custom video for real-time CCTV analysis."""
    global custom_uploaded_video_path
    upload_dir = PROJECT_ROOT / "data" / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / file.filename

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    custom_uploaded_video_path = str(file_path)
    logger.info(f"Custom video uploaded: {custom_uploaded_video_path} ({len(content)} bytes)")
    return {
        "filename": file.filename,
        "size_bytes": len(content),
        "path": custom_uploaded_video_path,
        "status": "READY_FOR_STREAMING",
    }


# ---------------------------------------------------------
# WebSocket for Live Real-Time Telemetry & Console
# ---------------------------------------------------------
@app.websocket("/ws")
async def websocket_telemetry(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    logger.info(f"WebSocket client connected. Active: {len(active_websockets)}")

    # Send initial snapshot immediately
    try:
        await broadcast_state_update()
        while True:
            # Keep connection alive and accept incoming messages (e.g. heartbeat or client commands)
            data = await websocket.receive_text()
            try:
                cmd = json.loads(data)
                if cmd.get("action") == "RESET":
                    firmware_emulator.reset_alarm("Remote WebSocket Operator Reset")
                    await broadcast_state_update()
            except Exception:
                pass
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
    finally:
        if websocket in active_websockets:
            active_websockets.remove(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.server:app", host="0.0.0.0", port=8000, reload=False)
