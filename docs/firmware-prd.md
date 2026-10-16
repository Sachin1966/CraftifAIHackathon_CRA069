# Product Requirements Document (PRD) — SafeGuard AI Embedded Firmware
**CraftifAI FirmGen v0.4.1 Formal Specification**

- **Project Name**: SafeGuard AI — Physical AI Safety Sentinel (Firmware Subsystem)
- **Target Target Hardware**: ESP32 / ESP32-S3 (Xtensa Dual-Core 240MHz, 520KB SRAM)
- **Target RTOS / Framework**: ESP-IDF v5.5 (FreeRTOS)
- **Status**: FROZEN & ACCEPTED

---

## 1. Traceable Requirements Table

| Req ID | Classification | Title & Description | Implementation Approach | Acceptance Criteria | Test Procedure & Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-001** | Safety Critical | **Safe Initial State**: Upon boot or reset, firmware shall configure all warning actuator pins (LED, Buzzer) to the safe inactive state before enabling communication interfaces. | Configure GPIOs as Output with pull-down resistors enabled; immediately set output level to LOW (`0`) in `app_main()` prior to task initialization. | Actuator GPIOs must measure logic LOW (0V) at initialization. Zero transient pulses during bootloader handoff. | Automated Test: `test_firmware_emulator.py::test_safe_initialization`. Evidence: `evidence/firmware_acceptance_matrix.md`. |
| **REQ-002** | Interface | **Message Schema Ingestion**: Firmware shall receive, buffer, and parse structured JSON safety event payloads adhering to Protocol Schema v1.0. | Stream parser / cJSON with size limit checking (max 1024 bytes buffer); extract `event_id`, `event_type`, `zone_id`, `confidence`. | Valid JSON returns parsed structure with status `PARSER_OK`. Non-blocking buffer reads. | Automated Test: `test_event_schema.py::test_valid_safety_event`. Evidence: `tests/test_event_schema.py`. |
| **REQ-003** | Functional | **Hazard Alarm Actuation**: Upon receiving a valid `restricted_zone_entry` event, firmware shall transition to `STATE_ALARM`, assert the Red Beacon LED, and activate the Piezo Buzzer. | FSM transition function `fsm_handle_event()`. Assert Red LED GPIO HIGH; trigger hardware timer or PWM sequence for audible buzzer pulsing. | Red LED pin is logic HIGH (`1`). Buzzer pin oscillates at defined frequency. Transition latency < 5ms. | Automated Test: `test_firmware_emulator.py::test_alarm_activation`. Evidence: `tests/test_firmware_emulator.py`. |
| **REQ-004** | Robustness | **Malformed Message Rejection**: Firmware shall reject malformed JSON, truncated buffers, out-of-range confidence scores, or unsupported event types without crashing or altering state. | Strict JSON schema validation; boundary check on string lengths and confidence ranges (`0.0 <= conf <= 1.0`). | Invalid messages logged as `ERR_PARSE_FAILED`; active alarm/normal state maintained unaltered. Zero memory leaks. | Automated Test: `test_firmware_emulator.py::test_malformed_message_rejection`. Evidence: `tests/test_firmware_emulator.py`. |
| **REQ-005** | Reliability | **Duplicate Event Suppression**: Firmware shall suppress redundant triggers caused by duplicate `event_id` deliveries within a sliding window. | Circular ring buffer holding the last 16 processed unique `event_id` hashes. Lookup in $O(1)$ / $O(N)$ before FSM trigger. | Subsequent arrivals of identical `event_id` within the window are discarded with log `WARN_DUPLICATE_IGNORED`. | Automated Test: `test_duplicate_events.py::test_duplicate_suppression_window`. Evidence: `tests/test_duplicate_events.py`. |
| **REQ-006** | Diagnostics | **UART State Transition Logging**: Firmware shall emit structured human-readable and machine-parseable log messages over UART whenever a state transition occurs. | FreeRTOS logging macros `ESP_LOGI(TAG, ...)` outputting state changes: `[STATE_CHANGE] OLD -> NEW (Reason: ...)`. | Every transition generates a timestamped UART log at 115200 baud within 2ms of state change. | Automated Test: `test_firmware_emulator.py::test_uart_state_logging`. Evidence: `simulation/firmware_emulator.py`. |
| **REQ-007** | Safety Policy | **Clear & Reset Policy**: Firmware shall transition from `STATE_ALARM` to `STATE_NORMAL` upon receiving a valid `restricted_zone_clear` event or an authenticated manual reset. | FSM verifies incident ID match before clearing; deasserts Red LED and Buzzer; enforces a minimum safe clearance dwell time (100ms). | Actuators return to inactive state; state transitions to `STATE_NORMAL`. | Automated Test: `test_firmware_emulator.py::test_alarm_clear_policy`. Evidence: `tests/test_firmware_emulator.py`. |
| **REQ-008** | Reliability | **Transport Interruption Recovery**: Firmware shall handle sudden loss of carrier (UART disconnect, Wi-Fi drop) gracefully without locking FreeRTOS tasks. | Non-blocking ring-buffer driver with watchdog timeouts; reconnection handler with exponential backoff. | System continues running; state does not freeze; resumes processing immediately upon link restoration. | Automated Test: `test_transport.py::test_transport_reconnection`. Evidence: `tests/test_transport.py`. |
| **REQ-009** | Live Intelligence | **Runtime Telemetry Publishing**: Firmware shall expose periodic diagnostic telemetry (uptime, free heap, active state, event counters) every 1000ms. | Dedicated FreeRTOS background task `telemetry_task()` querying `esp_get_free_heap_size()` and internal stat counters. | Telemetry emitted reliably without starving the time-critical safety event task. | Automated Test: `test_firmware_emulator.py::test_telemetry_emission`. Evidence: `firmware/main/telemetry.c`. |
| **REQ-010** | Safety Watchdog | **Communication Timeout Fail-Safe**: If an active alarm state does not receive an update or heartbeat within a configurable watchdog interval (e.g. 30s), firmware shall execute a safe auto-clear policy or fallback to alert mode. | FreeRTOS software timer reset on every incoming valid packet; timer expiration callback triggers `fsm_handle_timeout()`. | Timeout logged over UART; system transitions to documented fail-safe state. | Automated Test: `test_firmware_emulator.py::test_communication_timeout`. Evidence: `tests/test_firmware_emulator.py`. |

---

## 2. Finite State Machine (FSM) Definition

```
        ┌──────────────┐
        │  STATE_INIT  │  (All GPIOs LOW, Memory Ring-Buffer Cleared)
        └──────┬───────┘
               │ Boot complete
               ▼
        ┌──────────────┐
   ┌───►│ STATE_NORMAL │◄──────────────────────────────┐
   │    └──────┬───────┘                               │
   │           │ Valid restricted_zone_entry           │
   │           ▼                                       │
   │    ┌──────────────┐                               │
   │    │ STATE_ALARM  │  (Red LED HIGH, Buzzer PWM)   │
   │    └──────┬───────┘                               │
   │           │                                       │
   │           ├─► Valid restricted_zone_clear ────────┤
   │           ├─► Manual Reset Command ───────────────┤
   │           └─► Watchdog Timeout ───────────────────┘
   │
   └──── [STATE_COMM_ERROR] (Link restored / reboot)
```

---

## 3. Hardware Pinout Allocation (ESP32)

| Peripheral | ESP32 GPIO | Direction | Default State | Electrical Description |
| :--- | :---: | :---: | :---: | :--- |
| **Red Warning LED** | GPIO 21 (or 2) | Output | LOW (0V) | NPN transistor driver / direct LED with 330Ω resistor |
| **Piezo Buzzer** | GPIO 18 (or 5) | Output | LOW (0V) | Active buzzer or PWM passive piezo transducer |
| **UART RX** | GPIO 3 (U0RXD) | Input | Pull-up | USB-to-UART CP2102 Bridge / Host PC bridge |
| **UART TX** | GPIO 1 (U0TXD) | Output | HIGH | Debug and telemetry output stream (115200 8N1) |
| **Manual Reset Switch** | GPIO 0 (BOOT) | Input | Pull-up | Active-low emergency physical reset button |
