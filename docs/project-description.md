# Project Description: SafeGuard AI — Physical AI Safety Sentinel

## 1. Problem Statement

Industrial manufacturing plants, robotic work cells, and automated warehousing environments present severe hazards to factory personnel. Despite physical demarcation lines and floor tape, workers frequently step into dangerous machine envelopes—such as robotic welding cells, sheet-metal stamping presses, and automated guided vehicle (AGV) crossing lanes.

Traditional safety systems suffer from critical weaknesses:
1. **Mechanical Interlocks & Light Curtains**: High installation and maintenance cost, fixed linear geometry, inability to monitor complex polygonal work zones.
2. **Passive Vision Systems**: Cloud-based or isolated PC software that logs infractions after the fact without triggering immediate, tactile, or audible physical deterrents at the breach point.
3. **Flaky Software Triggers**: Vision pipelines that suffer from false positives caused by shadows, equipment occlusion, or momentary detection flickers, causing alarm fatigue.
4. **Ad-Hoc Unverified Firmware**: Microcontroller firmware written without formal requirement traceability, resulting in unhandled memory overflows, race conditions, or unverified fail-safe states.

## 2. Proposed Solution: SafeGuard AI

SafeGuard AI bridges edge computer vision and deterministic embedded firmware into a unified Physical AI safety loop using **CraftifAI PipeGen** and **CraftifAI FirmGen**.

### The Physical AI Closed Loop
1. **Perceive**: An edge camera captures the workspace in real time.
2. **Analyze**: PipeGen v0.5.1 deploys an edge-optimized TensorRT person-detection pipeline capable of sub-20ms inference.
3. **Decide**: The sentinel evaluates the **foot point** of each detected person against a high-precision polygonal exclusion zone. A temporal persistence filter ensures the intrusion is authentic, eliminating transient false alarms.
4. **Communicate**: The event bridge packages structured, versioned safety messages (`restricted_zone_entry`, `restricted_zone_clear`) across MQTT or UART.
5. **Act**: An ESP32 microcontroller running FirmGen v0.4.1 synthesized firmware parses the event, verifies cryptographic/checksum validity, performs deduplication, and asserts physical warning actuators (High-intensity Red Beacon LED and Pulsed Piezo Buzzer).
6. **Verify**: The firmware outputs real-time UART telemetry and state acknowledgments, closing the loop back to the supervisor dashboard.

## 3. Key Innovations & Differentiators

- **Foot-Point Precision Geometry**: Rather than triggering on bounding box overlaps (which trigger falsely whenever a worker's hand or clipboard enters the frame), SafeGuard AI computes the bottom-center contact point where the worker touches the ground.
- **CraftifAI PipeGen Traceability**: End-to-end 5-stage compilation flow from declarative pipeline requirements down to TensorRT execution plans.
- **CraftifAI FirmGen Requirements Traceability**: Full formal PRD (REQ-001 through REQ-010) frozen into deterministic firmware with verified acceptance criteria and Zero-Memory-Leak ring-buffer deduplication.
- **Hardware-Free High-Fidelity Twin**: An in-memory emulator and synthetic scenario generator that allows full integration testing without physical hardware, coupled with a seamless physical hardware bring-up path.
