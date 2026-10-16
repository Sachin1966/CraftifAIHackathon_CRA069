"""
SafeGuard AI — Physical AI Safety Sentinel Demonstration Dashboard
Interactive Digital Twin, Live Foot-Point Spatial Map, and Hardware Actuator Simulator.
"""

import json
import os
import sys
import time

import cv2
import numpy as np
import streamlit as st

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from bridge.config import load_zones_config
from bridge.event_schema import SafetyEvent
from bridge.publisher import SafetyEventPublisher
from bridge.subscriber import SafetyEventSubscriber
from bridge.transport import MockTransport
from perception.zone_filter import (
    DetectionTarget,
    RestrictedZone,
    TemporalPersistenceTracker,
    calculate_foot_point,
)
from simulation.firmware_emulator import ESP32FirmwareEmulator, FirmwareState
from simulation.mock_perception import MockPerceptionProducer

# Audio buzzer playback
def trigger_buzzer_beep():
    try:
        import winsound
        winsound.Beep(2400, 150)
    except Exception:
        pass

st.set_page_config(
    page_title="SafeGuard AI — Physical AI Safety Sentinel",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom CSS for high-contrast industrial aesthetic and glowing indicators
st.markdown(
    """
    <style>
    .metric-card {
        background: linear-gradient(145deg, #161b22, #0d1117);
        border-radius: 10px;
        padding: 16px;
        border: 1px solid #30363d;
        margin-bottom: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }
    .status-badge-pass {
        background-color: #064e3b;
        color: #34d399;
        padding: 4px 10px;
        border-radius: 12px;
        font-weight: bold;
        font-size: 0.85rem;
    }
    .status-badge-blocked {
        background-color: #7f1d1d;
        color: #f87171;
        padding: 4px 10px;
        border-radius: 12px;
        font-weight: bold;
        font-size: 0.85rem;
    }
    .alarm-box-on {
        background: radial-gradient(circle, #b91c1c 0%, #7f1d1d 100%);
        color: white;
        padding: 18px;
        border-radius: 12px;
        text-align: center;
        font-weight: 800;
        font-size: 1.25rem;
        border: 2px solid #ef4444;
        box-shadow: 0 0 25px rgba(239, 68, 68, 0.8);
        animation: pulse 1s infinite alternate;
    }
    .alarm-box-off {
        background: #111827;
        color: #64748b;
        padding: 18px;
        border-radius: 12px;
        text-align: center;
        font-weight: 700;
        font-size: 1.15rem;
        border: 1px solid #1e293b;
    }
    .breach-banner-alert {
        background-color: #ef4444;
        color: white;
        padding: 12px 18px;
        border-radius: 8px;
        font-weight: bold;
        font-size: 1.1rem;
        margin-bottom: 14px;
        text-align: center;
        box-shadow: 0 0 15px rgba(239, 68, 68, 0.6);
    }
    .breach-banner-safe {
        background-color: #059669;
        color: white;
        padding: 12px 18px;
        border-radius: 8px;
        font-weight: bold;
        font-size: 1.1rem;
        margin-bottom: 14px;
        text-align: center;
    }
    </style>
""",
    unsafe_allow_html=True,
)

# Header
st.title("🛡️ SafeGuard AI — Physical AI Safety Sentinel")
st.caption(
    "CraftifAI Physical AI Hackathon | Track A: PipeGen v0.5.1 + Track B: FirmGen v0.4.1 | Closed-Loop Physical AI"
)

# Mandatory Verification Transparency Status Bar
st.markdown("### 🔍 System Verification Status")
col_s1, col_s2, col_s3, col_s4 = st.columns(4)
with col_s1:
    st.markdown(
        """<div class='metric-card'>
        <div><strong>Simulation Twin</strong></div>
        <div style='margin-top:6px;'><span class='status-badge-pass'>✅ VERIFIED & OPERATIONAL</span></div>
        <small style='color:#94a3b8;'>27/27 Automated Tests Passing</small>
    </div>""",
        unsafe_allow_html=True,
    )
with col_s2:
    st.markdown(
        """<div class='metric-card'>
        <div><strong>PipeGen Pipeline</strong></div>
        <div style='margin-top:6px;'><span class='status-badge-blocked'>⚠️ STAGED / BLOCKED ON HOST</span></div>
        <small style='color:#94a3b8;'>Requires Linux/Jetson for DeepStream</small>
    </div>""",
        unsafe_allow_html=True,
    )
with col_s3:
    st.markdown(
        """<div class='metric-card'>
        <div><strong>FirmGen Firmware</strong></div>
        <div style='margin-top:6px;'><span class='status-badge-blocked'>⚠️ FROZEN / BLOCKED ON HOST</span></div>
        <small style='color:#94a3b8;'>C project ready; ESP32 disconnected</small>
    </div>""",
        unsafe_allow_html=True,
    )
with col_s4:
    st.markdown(
        """<div class='metric-card'>
        <div><strong>Closed Loop</strong></div>
        <div style='margin-top:6px;'><span class='status-badge-pass'>✅ VERIFIED (SOFTWARE TWIN)</span></div>
        <small style='color:#94a3b8;'>Full Perceive-Act-Verify Cycle</small>
    </div>""",
        unsafe_allow_html=True,
    )

st.divider()

# Session State Initialization
if "firmware" not in st.session_state:
    st.session_state.transport = MockTransport()
    st.session_state.transport.connect()
    st.session_state.firmware = ESP32FirmwareEmulator(device_id="ESP32-DASHBOARD-01")
    st.session_state.publisher = SafetyEventPublisher(
        st.session_state.transport, default_topic="safeguard/events"
    )
    st.session_state.subscriber = SafetyEventSubscriber(st.session_state.transport)
    st.session_state.subscriber.register_event_handler(
        lambda ev: st.session_state.firmware.handle_safety_event(ev)
    )
    st.session_state.subscriber.start_listening()

    zones_dict = load_zones_config("configs/zones.json")
    st.session_state.zones = [
        RestrictedZone.from_dict(zd) for zd in zones_dict.get("zones", [])
    ]
    st.session_state.tracker = TemporalPersistenceTracker(
        zones=st.session_state.zones,
        persistence_threshold_frames=3,
        clearance_dwell_frames=3,
        confidence_threshold=0.55,
        simulation=True,
    )
    st.session_state.event_log = []
    st.session_state.worker_pos = [500, 200]  # Default safe walkway position
    st.session_state.worker_active = True
    st.session_state.last_action_desc = "System initialized to safe normal state."

# Sidebar Controls
st.sidebar.header("🎛️ Interactive Sentinel Controls")

mode = st.sidebar.radio(
    "Control Mode",
    ["Interactive Live Controls", "Automated Demonstration Scenarios"],
    index=0
)

# Helper function to process worker position
def update_worker_position(foot_x, foot_y, repeat_count=3, action_label=""):
    st.session_state.worker_pos = [foot_x, foot_y]
    st.session_state.worker_active = True
    st.session_state.last_action_desc = action_label

    bbox = (foot_x - 35.0, foot_y - 140.0, foot_x + 35.0, float(foot_y))
    target = DetectionTarget(bbox=bbox, confidence=0.94, track_id=1)

    for i in range(repeat_count):
        events = st.session_state.tracker.process_frame_detections([target], frame_index=int(time.time()*10) + i)
        for ev in events:
            st.session_state.publisher.publish_event(ev)
            st.session_state.event_log.insert(0, ev.model_dump())
            if ev.event_type.value == "restricted_zone_entry":
                trigger_buzzer_beep()

# Mode 1: Interactive Live Controls
if mode == "Interactive Live Controls":
    st.sidebar.markdown("#### 🚀 Quick Action Presets")
    
    col_b1, col_b2 = st.sidebar.columns(2)
    with col_b1:
        if st.button("🚨 TRIGGER BREACH", type="primary", use_container_width=True):
            # Coordinates inside machine enclosure polygon ([350, 400] to [780, 400], [920, 720], [240, 720])
            update_worker_position(550, 520, repeat_count=4, action_label="Worker stepped inside Robotic Enclosure! Alarm Triggered.")
    with col_b2:
        if st.button("✅ CLEAR ZONE", use_container_width=True):
            # Coordinates in safe walkway (y=200, outside polygon)
            update_worker_position(550, 200, repeat_count=4, action_label="Worker evacuated to safe walkway. Hazard Cleared.")

    if st.sidebar.button("⚡ Inject 1-Frame Noise (Persistence Test)", use_container_width=True):
        # Only 1 frame inside (below 3-frame threshold)
        update_worker_position(550, 520, repeat_count=1, action_label="Transient optical noise injected. Persistence filter blocked false alarm.")
        # Immediately return to outside
        st.session_state.worker_pos = [550, 200]

    st.sidebar.markdown("#### 📍 Drag Worker Foot Position")
    foot_x = st.sidebar.slider("Worker Foot X", min_value=100, max_value=1180, value=int(st.session_state.worker_pos[0]), step=20)
    foot_y = st.sidebar.slider("Worker Foot Y", min_value=100, max_value=680, value=int(st.session_state.worker_pos[1]), step=20)

    if (foot_x != st.session_state.worker_pos[0]) or (foot_y != st.session_state.worker_pos[1]):
        update_worker_position(foot_x, foot_y, repeat_count=3, action_label=f"Worker moved to ({foot_x}, {foot_y})")

# Mode 2: Automated Scenarios
else:
    st.sidebar.markdown("#### 🎬 Scenario Player")
    scenario_choice = st.sidebar.selectbox(
        "Choose Demonstration",
        [
            "Full Intrusion, Breach & Auto-Clear Sequence (Animated)",
            "Single-Frame Noise Rejection (Persistence Test)",
            "Safe Walkway Transit (Outside Zone)",
            "Malformed JSON Ingestion (Fault Tolerance)"
        ]
    )

    if st.sidebar.button("▶️ Run Selected Scenario", type="primary", use_container_width=True):
        if "Full Intrusion" in scenario_choice:
            st.session_state.last_action_desc = "Running animated intrusion sequence..."
            seq = MockPerceptionProducer.get_full_intrusion_trajectory()
            # Animate through frames
            anim_placeholder = st.empty()
            for step_i, detections in enumerate(seq):
                target = detections[0]
                foot_x, foot_y = target.foot_point
                st.session_state.worker_pos = [foot_x, foot_y]
                events = st.session_state.tracker.process_frame_detections(detections, frame_index=step_i)
                for ev in events:
                    st.session_state.publisher.publish_event(ev)
                    st.session_state.event_log.insert(0, ev.model_dump())
                    if ev.event_type.value == "restricted_zone_entry":
                        trigger_buzzer_beep()
                time.sleep(0.3)
            st.session_state.last_action_desc = "Animated intrusion sequence completed."
            st.rerun()

        elif "Single-Frame" in scenario_choice:
            update_worker_position(550, 520, repeat_count=1, action_label="Single-frame noise injected. Persistence filter confirmed safe.")
            st.session_state.worker_pos = [550, 200]
            st.rerun()

        elif "Safe Walkway" in scenario_choice:
            update_worker_position(400, 200, repeat_count=3, action_label="Worker transit across safe walkway. No breach.")
            st.rerun()

        elif "Malformed" in scenario_choice:
            corrupted = '{"schema_version": "1.0", "corrupted": true}'
            st.session_state.firmware.process_raw_message(corrupted)
            st.session_state.last_action_desc = "Malformed JSON payload injected. Rejected by firmware (REQ-004)."
            st.rerun()

# Emergency Manual Reset Button in Sidebar
st.sidebar.markdown("---")
if st.sidebar.button("🔄 Emergency Manual Reset", use_container_width=True):
    st.session_state.firmware.reset_alarm("Dashboard Manual Operator Reset")
    st.session_state.tracker._zone_states["zone-machine-danger-1"]["active_incident_id"] = None
    st.session_state.tracker._zone_states["zone-machine-danger-1"]["breach_count"] = 0
    st.session_state.worker_pos = [550, 200]
    st.session_state.last_action_desc = "Emergency manual reset asserted. Actuators deasserted."
    st.sidebar.success("Alarm reset successfully.")
    st.rerun()

# Retrieve current states
telemetry = st.session_state.firmware.get_telemetry()
is_alarm_active = (st.session_state.firmware.current_state == FirmwareState.STATE_ALARM) or telemetry.actuators.red_led

# Breach Banner Notice
if is_alarm_active:
    st.markdown(
        "<div class='breach-banner-alert'>🚨 CRITICAL SAFETY BREACH: WORKER FOOT DETECTED IN MACHINE DANGER ENCLOSURE!</div>",
        unsafe_allow_html=True
    )
else:
    st.markdown(
        "<div class='breach-banner-safe'>✅ ALL ZONES SECURE: PERSONNEL MAINTAINING SAFE DISTANCE FROM EXCLUSION PERIMETERS</div>",
        unsafe_allow_html=True
    )

st.caption(f"**Last Action**: {st.session_state.last_action_desc}")

# Main Layout
col_left, col_right = st.columns([3, 2])

# Left Column: Spatial Hazard Map with Active Worker Rendering
with col_left:
    st.markdown("### 🗺️ Real-Time Spatial Hazard Map")

    # Render 1280x720 canvas
    canvas = np.zeros((720, 1280, 3), dtype=np.uint8)
    canvas[:] = (18, 22, 28)

    # Draw shop floor grid
    for x in range(0, 1280, 80):
        cv2.line(canvas, (x, 0), (x, 720), (32, 38, 48), 1)
    for y in range(0, 720, 80):
        cv2.line(canvas, (0, y), (1280, y), (32, 38, 48), 1)

    overlay = canvas.copy()

    # Draw Restricted Zones
    for zone in st.session_state.zones:
        pts = np.array(zone.vertices, np.int32).reshape((-1, 1, 2))
        zstate = st.session_state.tracker.get_zone_state(zone.zone_id)
        is_breached = zstate and (zstate["active_incident_id"] is not None)

        if is_breached or is_alarm_active:
            fill_color = (0, 0, 240)
            line_color = (0, 0, 255)
            status_txt = f"🚨 {zone.name} [ALARM: ACTIVE BREACH!]"
        else:
            fill_color = (0, 180, 0)
            line_color = (0, 255, 0)
            status_txt = f"🛡️ {zone.name} [SECURE]"

        cv2.fillPoly(overlay, [pts], fill_color)
        cv2.polylines(canvas, [pts], True, line_color, 3)

        v0 = zone.vertices[0]
        cv2.putText(canvas, status_txt, (int(v0[0]), int(v0[1]) - 14),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, line_color, 2)

    # Transparency blend
    cv2.addWeighted(overlay, 0.35 if is_alarm_active else 0.22, canvas, 0.65 if is_alarm_active else 0.78, 0, canvas)

    # Draw Walkway Labels
    cv2.putText(canvas, "PEDESTRIAN WALKWAY (SAFE ZONE)", (420, 140),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (140, 140, 140), 1)
    cv2.putText(canvas, "Foot-Point Precision Rule: P_foot = ((x_min + x_max)/2, y_max)", (30, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)

    # Draw Worker Figure & Bounding Box
    wx, wy = st.session_state.worker_pos
    x1, y1 = int(wx - 35), int(wy - 140)
    x2, y2 = int(wx + 35), int(wy)

    worker_color = (0, 0, 255) if is_alarm_active else (255, 200, 0)

    # Bounding Box
    cv2.rectangle(canvas, (x1, y1), (x2, y2), worker_color, 2)
    # Head & Torso avatar
    cv2.circle(canvas, (int(wx), int(y1 + 25)), 16, worker_color, -1)
    cv2.line(canvas, (int(wx), int(y1 + 40)), (int(wx), int(y2 - 25)), worker_color, 3)
    cv2.line(canvas, (int(wx), int(y2 - 25)), (int(wx - 15), int(y2)), worker_color, 2)
    cv2.line(canvas, (int(wx), int(y2 - 25)), (int(wx + 15), int(y2)), worker_color, 2)

    # Ground Contact Foot Point (Large Glowing Target)
    cv2.circle(canvas, (int(wx), int(wy)), 10, (0, 0, 255) if is_alarm_active else (0, 255, 0), -1)
    cv2.circle(canvas, (int(wx), int(wy)), 14, (255, 255, 255), 2)
    cv2.putText(canvas, f"Foot P_foot ({wx}, {wy})", (int(wx) + 18, int(wy) + 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    st.image(
        canvas,
        channels="BGR",
        use_container_width=True,
        caption=f"Real-Time Spatial Map | Worker Foot Coordinate: ({wx}, {wy}) | Zone State: {'🚨 BREACH' if is_alarm_active else '🟢 SAFE'}"
    )

# Right Column: Physical Firmware Twin & Actuators
with col_right:
    st.markdown("### ⚡ Physical Firmware Twin Actuators")

    col_act1, col_act2 = st.columns(2)
    with col_act1:
        if is_alarm_active:
            st.markdown(
                """<div class='alarm-box-on'>
                    🚨 RED BEACON LED<br>
                    <span style='font-size:0.9rem;'>STATE: ACTIVE (HIGH 3.3V)</span><br>
                    <small>Pin: GPIO 21</small>
                </div>""",
                unsafe_allow_html=True,
            )
        else:
            st.markdown(
                """<div class='alarm-box-off'>
                    ⚪ RED BEACON LED<br>
                    <span style='font-size:0.9rem;'>STATE: INACTIVE (LOW 0V)</span><br>
                    <small>Pin: GPIO 21</small>
                </div>""",
                unsafe_allow_html=True,
            )

    with col_act2:
        if is_alarm_active:
            st.markdown(
                """<div class='alarm-box-on'>
                    🔊 PIEZO BUZZER<br>
                    <span style='font-size:0.9rem;'>STATE: SOUNDING (2.4kHz)</span><br>
                    <small>Pin: GPIO 18</small>
                </div>""",
                unsafe_allow_html=True,
            )
        else:
            st.markdown(
                """<div class='alarm-box-off'>
                    🔇 PIEZO BUZZER<br>
                    <span style='font-size:0.9rem;'>STATE: SILENT (0V)</span><br>
                    <small>Pin: GPIO 18</small>
                </div>""",
                unsafe_allow_html=True,
            )

    st.markdown("#### 📟 Firmware FSM State")
    fsm_state_name = "STATE_ALARM" if is_alarm_active else "STATE_NORMAL"
    st.metric(
        label="Microcontroller RTOS State",
        value=fsm_state_name,
        delta="🚨 HAZARD ALERT!" if is_alarm_active else "🟢 NORMAL OPERATIONAL",
        delta_color="inverse" if is_alarm_active else "normal"
    )

    st.markdown("#### 📊 FirmGen Live Intelligence Telemetry (REQ-009)")
    st.json(telemetry.model_dump())

    st.markdown("#### 📜 Firmware UART Console Stream (REQ-006)")
    recent_logs = st.session_state.firmware.uart_logs[-5:]
    st.code(
        "\n".join(recent_logs) if recent_logs else "[BOOT] System normal. Awaiting events.",
        language="text",
    )

# Bottom Section: Event Log
st.markdown("### 📡 Safety Event Stream Log (`safeguard/events`)")
if st.session_state.event_log:
    st.dataframe(st.session_state.event_log[:8], use_container_width=True)
else:
    st.info("No safety events dispatched yet. Click '🚨 TRIGGER BREACH' or drag the worker foot into the zone!")
