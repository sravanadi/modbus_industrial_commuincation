# Modbus Studio — Product Requirements & Architecture (PRD)

## 1. Overview
**Modbus Studio** is a cross-platform (Windows 10/11 and Linux: Ubuntu/Debian/Fedora) Modbus master test tool equivalent in features to Modbus Poll, plus a built-in slave simulator.

> **Trademark & Licensing Note:** Do not use "Modbus Poll" branding, screenshots, or icons. Prefer MIT/Apache-2.0 licensed dependencies.

## 2. Tech Stack (Fixed)
| Layer | Choice |
| --- | --- |
| Core engine | Rust (`tokio`, `tokio-serial`, `serde`, `rusqlite`) |
| App shell | Tauri 2 |
| UI | React + TypeScript + Vite + Tailwind CSS |
| Data grid | TanStack Table + TanStack Virtual |
| State | Zustand |
| Charts | uPlot |
| Storage | SQLite (`rusqlite`) + JSON (`.mbproj`) |
| Tests | `cargo test` + built-in Modbus slave simulator |
| Packaging & CI | `.msi`/`.exe` (Windows), `.deb`/`.AppImage` (Linux), GitHub Actions |

## 3. Core Features
1. **Transports:** Modbus RTU (serial/RS485/RS232), ASCII, TCP/IP, UDP, RTU-over-TCP. Configurable baud, parity, data/stop bits, timeouts, delay between polls, retries, DTR/RTS control. Auto-list serial ports (`/dev/ttyUSB*`, `/dev/ttyACM*`, `COMx`) and surface helpful Linux `dialout` permission errors.
2. **Function Codes:**
   - Read: `01` (Read Coils), `02` (Read Discrete Inputs), `03` (Read Holding Registers), `04` (Read Input Registers)
   - Write: `05` (Write Single Coil), `06` (Write Single Register), `15` (Write Multiple Coils), `16` (Write Multiple Registers), `22` (Mask Write Register), `23` (Read/Write Multiple Registers)
   - Diagnostics / Info: `07` (Read Exception Status), `08` (Diagnostics), `17` (Report Server ID), `43` (Encapsulated Interface Transport / Read Device Identification)
   - Full Modbus exception code display (`0x01`–`0x0B`).
3. **Poll Windows (MDI / Tabbed):** Multiple concurrent windows, each with Slave ID, function code, start address, quantity, scan rate, address base (0/1), and PLC addressing (`40001` etc.) toggle.
4. **Display Formats:** Signed, Unsigned, Hex, Binary, Long (32-bit), Long Inverse, Float (32-bit), Float Inverse, Double (64-bit) with byte/word swap (`AB CD`, `CD AB`, `BA DC`, `DC BA`). User-defined alias, units, scale/offset per register.
5. **Editing & Write Dialogs:** Double-click cell to write single/multiple; dedicated dialogs for FC05/06/15/16/22/23.
6. **Statistics:** TX count, valid responses, CRC errors, timeouts, exception counts, response time (min/avg/max), with Reset.
7. **Traffic Monitor:** Timestamped TX/RX hex frames with decoded view, filter, pause, and save.
8. **Logging & Export:** Log poll data to CSV (and optional SQLite) with interval and rotation; export grid to CSV/XLSX.
9. **Real-Time Graph:** Multi-series register plotting with uPlot, zoom/pan, PNG export.
10. **Test Center:** Raw hex frame sender (auto CRC/LRC), repeat sequences, Rhai scripting for automated test sequences with pass/fail output.
11. **Slave Simulator:** Serial/TCP slave simulator with editable register map and error injection (delays, CRC errors, exceptions).
12. **Project Files:** Save/load full workspace (connections, windows, layouts) as `.mbproj` JSON.
13. **Settings:** Light/dark theme, i18n-ready, font size, keyboard shortcuts, auto-reconnect.

## 4. Architecture Rules
- Protocol layer is pure Rust, unit-tested (CRC16, LRC, frame encode/decode, every function code, exceptions) with golden test vectors.
- Poller runs on async `tokio` tasks; UI receives batched events (max ~30 fps) so large grids never lag.
- `Transport` trait abstraction so new transports plug in without modifying the poller.
- No blocking calls on the UI thread. Never panic on malformed frames.

## 5. Phased Delivery Plan
- **Phase 1:** Project scaffold + pure-Rust protocol layer + golden-vector unit tests.
- **Phase 2:** RTU/TCP transports + single poll window with read FC01–04.
- **Phase 3:** Write functions + display formats + statistics.
- **Phase 4:** Traffic monitor + logging + export.
- **Phase 5:** Graph + Test Center + Rhai scripting.
- **Phase 6:** Slave simulator + `.mbproj` project files + settings.
- **Phase 7:** Packaging, CI, docs, polish.
