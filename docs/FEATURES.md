# Modbus Studio — Feature Checklist

Each feature has an ID for verification. `P0` = must-have, `P1` = should-have, `P2` = nice-to-have.

## A. Connections
| ID | Feature | Pri |
| --- | --- | --- |
| A1 | Modbus RTU over serial (RS232/RS485) | P0 |
| A2 | Modbus ASCII over serial | P0 |
| A3 | Modbus TCP/IP (default port 502, custom port) | P0 |
| A4 | Modbus UDP/IP | P1 |
| A5 | RTU over TCP and ASCII over TCP | P1 |
| A6 | Serial settings: port, baud, data bits, parity, stop bits | P0 |
| A7 | RS485 2-wire mode, DTR/RTS control | P1 |
| A8 | Response timeout, delay between polls, retries | P0 |
| A9 | Auto-detect serial ports (`COMx`, `/dev/ttyUSB*`, `/dev/ttyACM*`) | P0 |
| A10 | Linux dialout permission error with a helpful message | P0 |
| A11 | Auto-reconnect, connect/disconnect, status in the status bar | P1 |
| A12 | Multiple simultaneous connections | P1 |

## B. Function Codes
| ID | Feature | Pri |
| --- | --- | --- |
| B1 | FC01 Read Coils, FC02 Read Discrete Inputs | P0 |
| B2 | FC03 Read Holding Registers, FC04 Read Input Registers | P0 |
| B3 | FC05 Write Single Coil, FC06 Write Single Register | P0 |
| B4 | FC15 Write Multiple Coils, FC16 Write Multiple Registers | P0 |
| B5 | FC22 Mask Write Register | P1 |
| B6 | FC23 Read/Write Multiple Registers | P1 |
| B7 | FC07 Read Exception Status, FC08 Diagnostics | P1 |
| B8 | FC17 Report Slave ID, FC43 Read Device Identification | P2 |
| B9 | Exception codes `01`–`0B` shown with names and explanations | P0 |
| B10 | CRC16 (RTU) and LRC (ASCII) validated; bad frames counted | P0 |

## C. Poll Windows
| ID | Feature | Pri |
| --- | --- | --- |
| C1 | Multiple poll windows (MDI or tabs) at once | P0 |
| C2 | Per-window: Slave ID, function, start address, quantity, scan rate | P0 |
| C3 | Address base 0/1 and PLC addressing (`40001` style) | P0 |
| C4 | Single poll vs continuous poll, start/stop | P0 |
| C5 | Rows × columns layout of the register grid | P1 |
| C6 | Name cells (alias per register) | P0 |
| C7 | Value cells with live updates and changed-value flash | P0 |
| C8 | Conditional colors by value range | P1 |
| C9 | Scaling (multiplier and offset), units | P1 |
| C10 | Font selection, light/dark theme | P1 |
| C11 | Address Scan: find which addresses and slave IDs respond | P1 |

## D. Display Formats
| ID | Feature | Pri |
| --- | --- | --- |
| D1 | Signed, Unsigned, Hex, Binary (per cell or column) | P0 |
| D2 | ASCII display | P1 |
| D3 | 32-bit signed/unsigned with any word/byte order | P0 |
| D4 | 64-bit signed/unsigned with any word/byte order | P1 |
| D5 | Float 32 and Double 64 with swap (`AB CD`, `CD AB`, `BA DC`, `DC BA`) | P0 |
| D6 | Bit-level view of a register | P1 |

## E. Writing
| ID | Feature | Pri |
| --- | --- | --- |
| E1 | Edit a value by double-click or typing in the cell | P0 |
| E2 | Write dialog lets the user choose the write function | P0 |
| E3 | Write multiple registers and coils dialog | P0 |
| E4 | Confirm-before-write option and write result shown | P1 |

## F. Monitoring, Statistics and Errors
| ID | Feature | Pri |
| --- | --- | --- |
| F1 | Communication traffic monitor: timestamped TX/RX in hex | P0 |
| F2 | Decoded view of frames, filter, pause, clear, save | P1 |
| F3 | Statistics: TX count, valid responses, CRC errors, timeouts, exceptions | P0 |
| F4 | Response time min/avg/max, reset statistics | P1 |
| F5 | Clear error messages (timeout, CRC error, exception, port busy) | P0 |

## G. Logging and Charting
| ID | Feature | Pri |
| --- | --- | --- |
| G1 | Log to CSV and text with timestamp, interval and auto-start | P0 |
| G2 | Append to an existing log file | P1 |
| G3 | Log rotation and a row limit | P1 |
| G4 | Export grid to CSV/XLSX | P1 |
| G5 | Real-time chart with multiple series, zoom/pan | P0 |
| G6 | Export chart as PNG | P2 |
| G7 | Print and print preview | P2 |

## H. Test Center and Automation
| ID | Feature | Pri |
| --- | --- | --- |
| H1 | Send raw hex frames with auto CRC/LRC | P0 |
| H2 | Repeat, loop and delay for sequences | P1 |
| H3 | Scripting engine (Rhai/Lua/Python) with pass/fail output | P1 |
| H4 | Local API or CLI (replaces Windows OLE automation) | P2 |

## I. Workspace and Settings
| ID | Feature | Pri |
| --- | --- | --- |
| I1 | Save/open workspace (`.mbproj`) with connections, windows, layouts | P0 |
| I2 | Remember last session and window positions | P1 |
| I3 | Keyboard shortcuts, tooltips on protocol terms | P1 |
| I4 | i18n-ready strings | P2 |

## J. Extras (Beyond Modbus Poll)
| ID | Feature | Pri |
| --- | --- | --- |
| J1 | Built-in slave simulator (serial and TCP) with editable register map | P0 |
| J2 | Error injection: delays, bad CRC, exceptions | P1 |
| J3 | Linux and Windows installers (`.deb`, `.AppImage`, `.msi`) | P0 |

## K. Quality Requirements
| ID | Requirement |
| --- | --- |
| K1 | No UI freeze with 1000+ registers polled at 100 ms |
| K2 | No panic or crash on malformed frames |
| K3 | Unit tests for CRC/LRC, all function codes and exceptions, using golden vectors |
| K4 | Builds cleanly with no warnings on Windows and Linux |
| K5 | WCAG AA contrast and keyboard navigation |
