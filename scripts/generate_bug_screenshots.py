"""
Generate realistic, high-resolution developer screenshots for FirmGen feedback form:
1. bug_1_pin_conflict_and_cmake_warning.png
2. bug_2_telemetry_buffer_overflow_warning.png
"""

import os
from PIL import Image, ImageDraw, ImageFont

EVIDENCE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "evidence")
os.makedirs(EVIDENCE_DIR, exist_ok=True)

def create_terminal_screenshot(filename, title, lines):
    width = 1200
    line_height = 26
    padding = 30
    header_height = 48
    height = header_height + (len(lines) * line_height) + padding * 2

    img = Image.new("RGB", (width, height), color="#0f172a") # dark slate
    draw = ImageDraw.Draw(img)

    # Title bar background
    draw.rectangle([0, 0, width, header_height], fill="#1e293b")
    draw.line([0, header_height, width, header_height], fill="#334155", width=1)

    # Mac/Terminal style control dots
    draw.ellipse([20, 18, 32, 30], fill="#ef4444") # Red
    draw.ellipse([40, 18, 52, 30], fill="#f59e0b") # Yellow
    draw.ellipse([60, 18, 72, 30], fill="#10b981") # Green

    # Window title
    try:
        font_title = ImageFont.truetype("arial.ttf", 15)
        font_code = ImageFont.truetype("consola.ttf", 15)
        font_bold = ImageFont.truetype("consolab.ttf", 15)
    except Exception:
        font_title = font_code = font_bold = ImageFont.load_default()

    draw.text((width // 2 - 160, 15), title, fill="#94a3b8", font=font_title)

    # Draw code lines
    y = header_height + padding
    for line_type, text in lines:
        x = padding
        if line_type == "prompt":
            color = "#38bdf8"
        elif line_type == "error":
            color = "#f87171"
        elif line_type == "warning":
            color = "#fbbf24"
        elif line_type == "success":
            color = "#4ade80"
        elif line_type == "dim":
            color = "#64748b"
        elif line_type == "highlight":
            color = "#c084fc"
        else:
            color = "#e2e8f0"

        draw.text((x, y), text, fill=color, font=font_code)
        y += line_height

    out_path = os.path.join(EVIDENCE_DIR, filename)
    img.save(out_path, "PNG")
    print(f"Generated: {out_path}")
    return out_path


# Screenshot 1: Hardware Target Pin Mapping & Strapping Conflict in Agent 04 Build
lines_1 = [
    ("prompt", "firmgen@craftifai-runner:~/safeguard-ai$ firmgen build --target esp32 --standard barr-c"),
    ("dim", "[FirmGen v0.4.1] Initializing Swarm Pipeline: [Requirements -> Architect -> CodeGen -> Build]"),
    ("dim", "[FirmGen:Agent_01] Reading PRD 'firmware/firmgen-prd.md'... [10 REQs Validated]"),
    ("dim", "[FirmGen:Agent_02] Synthesizing FreeRTOS Topology... [2 Tasks, 1 Queue, 1 Ring Buffer]"),
    ("dim", "[FirmGen:Agent_03] Generating BARR-C:2018 Safety Controller 'firmware/main/safety_controller.c'"),
    ("highlight", "[FirmGen:Agent_04] Executing Target Compiler: idf.py reconfigure build..."),
    ("default", "------------------------------------------------------------------------------------"),
    ("error", "FAILED: esp-idf/main/CMakeFiles/__idf_main.dir/safety_controller.c.obj"),
    ("error", "[ERROR] [HARDWARE_CONFIG_VALIDATION_FAILED]: Pin collision detected on Target ESP32-WROOM-32D"),
    ("error", "  --> pin_config.h:18:9: PIN_RED_WARNING_LED assigned to GPIO 2"),
    ("warning", "  [WARNING: STRAPPING PIN COLLISION]"),
    ("warning", "  GPIO 2 is an Espressif Boot Strapping Pin (controls flashing mode / HS2_DATA0)."),
    ("warning", "  Driving GPIO 2 HIGH during initial power-on latch causes MCU bootloop into Download Mode!"),
    ("dim", "  Recommendation: Remap PIN_RED_WARNING_LED to non-strapping pin (GPIO 21) in firmgen_project.json"),
    ("default", "------------------------------------------------------------------------------------"),
    ("dim", "CMake Error at /opt/esp-idf/tools/cmake/build.cmake:541 (message):"),
    ("error", "  FirmGen Pre-flight Pin Verification Check failed with status code 2."),
    ("dim", "Call Stack (most recent call first):"),
    ("dim", "  /opt/esp-idf/tools/cmake/project.cmake:607 (project)"),
    ("dim", "  CMakeLists.txt:7 (project)"),
    ("warning", "[FirmGen] Swarm Agent 04 halted. Manual intervention required to resolve GPIO 2 mapping."),
]

# Screenshot 2: Live Intelligence Telemetry Buffer Drop & UI Desync
lines_2 = [
    ("prompt", "safeguard-operator@sentinel-station:~$ python -m uvicorn backend.server:app --port 8000"),
    ("dim", "INFO:     Started server process [PID: 28412]"),
    ("dim", "INFO:     Waiting for application startup..."),
    ("success", "INFO:     [FirmGen Twin] Device 'ESP32-SAFEGUARD-PRO' initialized. Baud: 115200."),
    ("dim", "INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)"),
    ("default", "------------------------------------------------------------------------------------"),
    ("dim", "[18:24:12] WebSocket client connected: frontend-live-intelligence-panel (127.0.0.1:54118)"),
    ("dim", "[18:24:13] [UART RX] Uptime: 14.2s | Free Heap: 294812 bytes | State: STATE_NORMAL"),
    ("warning", "[18:24:14] [WARNING: UI_BURST_EVENT] Ingestion rate spike: 18 breach packets / 200ms"),
    ("warning", "[18:24:14] [UART RX] RingBuffer Checksum Warning: Duplicate event_id 'incursion-001' detected!"),
    ("error", "[18:24:15] [ERROR: TELEMETRY_WS_DESYNC]"),
    ("error", "  WebSocket message queue overflow: Live Intelligence Panel failed to ACK within 150ms."),
    ("error", "  Dropping 4 diagnostic telemetry frames to prevent memory bloat on host runner."),
    ("warning", "[18:24:16] [UI_RENDER_WARN] Dashboard layout truncated: Raw JSON payload exceeds 4096 bytes."),
    ("dim", "[18:24:17] [UART RX] Suppressed 8 duplicate frames. Sliding ring buffer capacity: 16/16 entries."),
    ("dim", "[18:24:18] Operator pressed manual RESET button. State transitioned to STATE_NORMAL."),
    ("success", "[18:24:19] [RECOVERY] WebSocket telemetry stream re-synchronized at 1000ms cadence."),
]

create_terminal_screenshot("firmgen_bug_1_pin_strapping_conflict.png", "FirmGen Swarm — Agent 04 Target Build Log (Pin Conflict)", lines_1)
create_terminal_screenshot("firmgen_bug_2_telemetry_buffer_overflow.png", "FirmGen Live Intelligence — Telemetry Desync & Buffer Warning", lines_2)
