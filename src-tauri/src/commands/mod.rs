use crate::poller::{
    to_hex, ConnectTarget, ConnectionState, PollConfig, PollStatsEvent, PollerHandle, TrafficEvent,
};
use crate::protocol::function_codes::{RequestPdu, ResponsePdu};
use crate::slave_sim::SlaveSimHandle;
use crate::transport::{list_serial_ports, ActiveTransport, SerialPortInfo};
use chrono::Local;
use serde::Serialize;
use std::fs::OpenOptions;
use std::io::Write;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use tokio::process::Command;
use tokio::sync::Mutex;

#[derive(Debug, Serialize)]
pub struct PythonRunResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub duration_ms: u64,
}

pub struct AppState {
    pub connection: ConnectionState,
    pub poller: Mutex<PollerHandle>,
    pub slave_sim: Mutex<SlaveSimHandle>,
}

#[tauri::command]
pub fn get_serial_ports() -> Result<Vec<SerialPortInfo>, String> {
    list_serial_ports().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn connect_tcp(
    host: String,
    port: u16,
    timeout_ms: u64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let transport = ActiveTransport::connect_tcp(&host, port, timeout_ms)
        .await
        .map_err(|e| e.to_string())?;
    let mut guard = state.connection.lock().await;
    guard.transport = Some(transport);
    guard.target = Some(ConnectTarget::Tcp { host, port, timeout_ms });
    guard.transport_label = "TCP".to_string();
    Ok(())
}

#[tauri::command]
pub async fn connect_rtu_over_tcp(
    host: String,
    port: u16,
    timeout_ms: u64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let transport = ActiveTransport::connect_rtu_over_tcp(&host, port, timeout_ms)
        .await
        .map_err(|e| e.to_string())?;
    let mut guard = state.connection.lock().await;
    guard.transport = Some(transport);
    guard.target = Some(ConnectTarget::RtuOverTcp { host, port, timeout_ms });
    guard.transport_label = "RTU/TCP".to_string();
    Ok(())
}

#[tauri::command]
pub async fn connect_udp(
    host: String,
    port: u16,
    timeout_ms: u64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let transport = ActiveTransport::connect_udp(&host, port, timeout_ms)
        .await
        .map_err(|e| e.to_string())?;
    let mut guard = state.connection.lock().await;
    guard.transport = Some(transport);
    guard.target = Some(ConnectTarget::Udp { host, port, timeout_ms });
    guard.transport_label = "UDP".to_string();
    Ok(())
}

#[tauri::command]
pub async fn connect_rtu(
    port_name: String,
    baud_rate: u32,
    parity: String,
    data_bits: u8,
    stop_bits: u8,
    timeout_ms: u64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let transport = ActiveTransport::connect_rtu(
        &port_name,
        baud_rate,
        &parity,
        data_bits,
        stop_bits,
        timeout_ms,
    )
    .map_err(|e| e.to_string())?;
    let mut guard = state.connection.lock().await;
    guard.transport = Some(transport);
    guard.target = Some(ConnectTarget::Rtu {
        port_name,
        baud_rate,
        parity,
        data_bits,
        stop_bits,
        timeout_ms,
    });
    guard.transport_label = "RTU".to_string();
    Ok(())
}

#[tauri::command]
pub async fn connect_ascii(
    port_name: String,
    baud_rate: u32,
    parity: String,
    data_bits: u8,
    stop_bits: u8,
    timeout_ms: u64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let transport = ActiveTransport::connect_ascii(
        &port_name,
        baud_rate,
        &parity,
        data_bits,
        stop_bits,
        timeout_ms,
    )
    .map_err(|e| e.to_string())?;
    let mut guard = state.connection.lock().await;
    guard.transport = Some(transport);
    guard.target = Some(ConnectTarget::Ascii {
        port_name,
        baud_rate,
        parity,
        data_bits,
        stop_bits,
        timeout_ms,
    });
    guard.transport_label = "ASCII".to_string();
    Ok(())
}

#[tauri::command]
pub async fn disconnect(state: State<'_, AppState>) -> Result<(), String> {
    state.poller.lock().await.stop();
    let mut guard = state.connection.lock().await;
    guard.transport = None;
    guard.target = None;
    Ok(())
}

#[tauri::command]
pub async fn start_poll(
    configs: Vec<PollConfig>,
    auto_reconnect: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let has_conn = state.connection.lock().await.transport.is_some();
    if !has_conn {
        return Err("Not connected to any Modbus device".to_string());
    }
    state
        .poller
        .lock()
        .await
        .start(app, state.connection.clone(), configs, auto_reconnect);
    Ok(())
}

#[tauri::command]
pub async fn stop_poll(state: State<'_, AppState>) -> Result<(), String> {
    state.poller.lock().await.stop();
    Ok(())
}

#[tauri::command]
pub async fn reset_stats(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.connection.lock().await;
    guard.stats = PollStatsEvent::default();
    let _ = app.emit("modbus://stats", guard.stats.clone());
    Ok(())
}

#[tauri::command]
pub async fn write_single_register(
    slave_id: u8,
    address: u16,
    value: u16,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let pdu = RequestPdu::WriteSingleRegister { address, value }
        .encode()
        .map_err(|e| e.to_string())?;

    let mut guard = state.connection.lock().await;
    if guard.transport.is_none() {
        return Err("Not connected".to_string());
    }
    let transport_label = guard.transport_label.clone();
    guard.stats.tx_count += 1;
    let ts = Local::now().format("%H:%M:%S%.3f").to_string();
    let ex = guard
        .transport
        .as_mut()
        .unwrap()
        .exchange(slave_id, &pdu)
        .await
        .map_err(|e| e.to_string())?;

    let _ = app.emit(
        "modbus://traffic",
        TrafficEvent {
            id: format!("wtx-{}", guard.stats.tx_count),
            timestamp: ts.clone(),
            direction: "TX".to_string(),
            transport: transport_label.clone(),
            hex: to_hex(&ex.tx_frame),
            decoded: format!("Unit {slave_id} | FC06 Write Reg {address} = {value}"),
            is_error: false,
        },
    );

    match ResponsePdu::decode(&ex.pdu, None).map_err(|e| e.to_string())? {
        ResponsePdu::Exception { exception, .. } => {
            guard.stats.exception_count += 1;
            let _ = app.emit("modbus://stats", guard.stats.clone());
            Err(format!("Modbus exception: {exception}"))
        }
        _ => {
            guard.stats.rx_valid_count += 1;
            let _ = app.emit(
                "modbus://traffic",
                TrafficEvent {
                    id: format!("wrx-{}", guard.stats.tx_count),
                    timestamp: ts,
                    direction: "RX".to_string(),
                    transport: transport_label,
                    hex: to_hex(&ex.rx_frame),
                    decoded: format!("Unit {slave_id} | FC06 OK"),
                    is_error: false,
                },
            );
            let _ = app.emit("modbus://stats", guard.stats.clone());
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn write_single_coil(
    slave_id: u8,
    address: u16,
    value: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let pdu = RequestPdu::WriteSingleCoil { address, value }
        .encode()
        .map_err(|e| e.to_string())?;

    let mut guard = state.connection.lock().await;
    if guard.transport.is_none() {
        return Err("Not connected".to_string());
    }
    let transport_label = guard.transport_label.clone();
    guard.stats.tx_count += 1;
    let ts = Local::now().format("%H:%M:%S%.3f").to_string();
    let ex = guard
        .transport
        .as_mut()
        .unwrap()
        .exchange(slave_id, &pdu)
        .await
        .map_err(|e| e.to_string())?;

    let _ = app.emit(
        "modbus://traffic",
        TrafficEvent {
            id: format!("wtx-{}", guard.stats.tx_count),
            timestamp: ts.clone(),
            direction: "TX".to_string(),
            transport: transport_label.clone(),
            hex: to_hex(&ex.tx_frame),
            decoded: format!("Unit {slave_id} | FC05 Write Coil {address} = {value}"),
            is_error: false,
        },
    );

    match ResponsePdu::decode(&ex.pdu, None).map_err(|e| e.to_string())? {
        ResponsePdu::Exception { exception, .. } => {
            guard.stats.exception_count += 1;
            let _ = app.emit("modbus://stats", guard.stats.clone());
            Err(format!("Modbus exception: {exception}"))
        }
        _ => {
            guard.stats.rx_valid_count += 1;
            let _ = app.emit("modbus://stats", guard.stats.clone());
            Ok(())
        }
    }
}

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn silent_python_cmd() -> Command {
    let mut cmd = if cfg!(target_os = "windows") {
        Command::new("python")
    } else {
        Command::new("python3")
    };
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[tauri::command]
pub async fn run_python_script(code: String) -> Result<PythonRunResult, String> {
    let started = Instant::now();
    let mut cmd = silent_python_cmd();

    let output = cmd
        .arg("-c")
        .arg(&code)
        .output()
        .await
        .map_err(|e| format!("Failed to launch Python: {e}"))?;

    Ok(PythonRunResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
        duration_ms: started.elapsed().as_millis() as u64,
    })
}

#[tauri::command]
pub async fn start_slave_sim(port: u16, state: State<'_, AppState>) -> Result<(), String> {
    state.slave_sim.lock().await.start(port).await
}

#[tauri::command]
pub async fn stop_slave_sim(state: State<'_, AppState>) -> Result<(), String> {
    state.slave_sim.lock().await.stop();
    Ok(())
}

async fn execute_write(
    slave_id: u8,
    pdu: Vec<u8>,
    summary: String,
    app: &AppHandle,
    state: &State<'_, AppState>,
) -> Result<(), String> {
    let mut guard = state.connection.lock().await;
    if guard.transport.is_none() {
        return Err("Not connected".to_string());
    }
    let transport_label = guard.transport_label.clone();
    guard.stats.tx_count += 1;
    let ts = Local::now().format("%H:%M:%S%.3f").to_string();
    let ex = guard
        .transport
        .as_mut()
        .unwrap()
        .exchange(slave_id, &pdu)
        .await
        .map_err(|e| e.to_string())?;

    let _ = app.emit(
        "modbus://traffic",
        TrafficEvent {
            id: format!("wtx-{}", guard.stats.tx_count),
            timestamp: ts.clone(),
            direction: "TX".to_string(),
            transport: transport_label.clone(),
            hex: to_hex(&ex.tx_frame),
            decoded: summary,
            is_error: false,
        },
    );

    match ResponsePdu::decode(&ex.pdu, None).map_err(|e| e.to_string())? {
        ResponsePdu::Exception { exception, .. } => {
            guard.stats.exception_count += 1;
            let _ = app.emit("modbus://stats", guard.stats.clone());
            Err(format!("Modbus exception: {exception}"))
        }
        _ => {
            guard.stats.rx_valid_count += 1;
            let _ = app.emit(
                "modbus://traffic",
                TrafficEvent {
                    id: format!("wrx-{}", guard.stats.tx_count),
                    timestamp: ts,
                    direction: "RX".to_string(),
                    transport: transport_label,
                    hex: to_hex(&ex.rx_frame),
                    decoded: format!("Unit {slave_id} | Write OK"),
                    is_error: false,
                },
            );
            let _ = app.emit("modbus://stats", guard.stats.clone());
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn write_multiple_registers(
    slave_id: u8,
    start_address: u16,
    values: Vec<u16>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let count = values.len();
    let pdu = RequestPdu::WriteMultipleRegisters {
        start_address,
        values,
    }
    .encode()
    .map_err(|e| e.to_string())?;
    execute_write(
        slave_id,
        pdu,
        format!("Unit {slave_id} | FC16 Write {count} Regs @ {start_address}"),
        &app,
        &state,
    )
    .await
}

#[tauri::command]
pub async fn write_multiple_coils(
    slave_id: u8,
    start_address: u16,
    values: Vec<bool>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let count = values.len();
    let pdu = RequestPdu::WriteMultipleCoils {
        start_address,
        values,
    }
    .encode()
    .map_err(|e| e.to_string())?;
    execute_write(
        slave_id,
        pdu,
        format!("Unit {slave_id} | FC15 Write {count} Coils @ {start_address}"),
        &app,
        &state,
    )
    .await
}

#[tauri::command]
pub fn append_csv_log(path: String, line: String, header: Option<String>) -> Result<(), String> {
    let exists = std::path::Path::new(&path).exists();
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Failed to open CSV '{path}': {e}"))?;
    if !exists {
        if let Some(h) = header {
            writeln!(file, "{h}").map_err(|e| e.to_string())?;
        }
    }
    writeln!(file, "{line}").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_project(path: String, json: String) -> Result<(), String> {
    std::fs::write(&path, json).map_err(|e| format!("Failed to save '{path}': {e}"))
}

#[tauri::command]
pub fn load_project(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read '{path}': {e}"))
}

#[derive(Debug, Serialize)]
pub struct RawHexResult {
    pub tx_hex: String,
    pub rx_hex: String,
    pub decoded: String,
}

#[tauri::command]
pub async fn send_raw_hex(
    unit_id: u8,
    pdu_hex: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<RawHexResult, String> {
    let pdu: Vec<u8> = pdu_hex
        .split_whitespace()
        .map(|s| u8::from_str_radix(s, 16).map_err(|e| format!("Invalid hex '{s}': {e}")))
        .collect::<Result<Vec<_>, _>>()?;
    if pdu.is_empty() {
        return Err("Enter at least 1 hex byte (function code)".to_string());
    }

    let mut guard = state.connection.lock().await;
    if guard.transport.is_none() {
        return Err("Not connected".to_string());
    }
    let label = guard.transport_label.clone();
    guard.stats.tx_count += 1;
    let ts = Local::now().format("%H:%M:%S%.3f").to_string();
    let ex = guard
        .transport
        .as_mut()
        .unwrap()
        .exchange(unit_id, &pdu)
        .await
        .map_err(|e| e.to_string())?;

    guard.stats.rx_valid_count += 1;
    let tx_hex = to_hex(&ex.tx_frame);
    let rx_hex = to_hex(&ex.rx_frame);
    let decoded = match ResponsePdu::decode(&ex.pdu, None) {
        Ok(resp) => format!("{resp:?}"),
        Err(e) => format!("Decode err: {e}"),
    };

    let _ = app.emit(
        "modbus://traffic",
        TrafficEvent {
            id: format!("rawtx-{}", guard.stats.tx_count),
            timestamp: ts.clone(),
            direction: "TX".to_string(),
            transport: label.clone(),
            hex: tx_hex.clone(),
            decoded: format!("Unit {unit_id} | Raw PDU"),
            is_error: false,
        },
    );
    let _ = app.emit(
        "modbus://traffic",
        TrafficEvent {
            id: format!("rawrx-{}", guard.stats.tx_count),
            timestamp: ts,
            direction: "RX".to_string(),
            transport: label,
            hex: rx_hex.clone(),
            decoded: decoded.clone(),
            is_error: false,
        },
    );
    let _ = app.emit("modbus://stats", guard.stats.clone());

    Ok(RawHexResult {
        tx_hex,
        rx_hex,
        decoded,
    })
}

#[tauri::command]
pub async fn scan_slave_ids(
    start_id: u8,
    end_id: u8,
    fc: u8,
    address: u16,
    state: State<'_, AppState>,
) -> Result<Vec<u8>, String> {
    let req = match fc {
        1 => RequestPdu::ReadCoils { start_address: address, quantity: 1 },
        2 => RequestPdu::ReadDiscreteInputs { start_address: address, quantity: 1 },
        4 => RequestPdu::ReadInputRegisters { start_address: address, quantity: 1 },
        _ => RequestPdu::ReadHoldingRegisters { start_address: address, quantity: 1 },
    };
    let pdu = req.encode().map_err(|e| e.to_string())?;
    let mut found = Vec::new();

    for uid in start_id..=end_id {
        let mut guard = state.connection.lock().await;
        let Some(transport) = guard.transport.as_mut() else {
            return Err("Not connected".to_string());
        };
        if transport.exchange(uid, &pdu).await.is_ok() {
            found.push(uid);
        }
    }
    Ok(found)
}

#[tauri::command]
pub async fn set_sim_register(
    address: u16,
    value: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let sim = state.slave_sim.lock().await;
    let mut mem = sim.memory.lock().await;
    let idx = address as usize;
    if idx >= mem.holding_regs.len() {
        return Err(format!("Address {address} out of simulator range (0..1023)"));
    }
    mem.holding_regs[idx] = value;
    Ok(())
}

#[tauri::command]
pub async fn set_sim_coil(
    address: u16,
    value: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let sim = state.slave_sim.lock().await;
    let mut mem = sim.memory.lock().await;
    let idx = address as usize;
    if idx >= mem.coils.len() {
        return Err(format!("Address {address} out of simulator range (0..1023)"));
    }
    mem.coils[idx] = value;
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct DiscoverHit {
    pub baud: u32,
    pub parity: String,
    pub slave_id: u8,
    pub fc: u8,
    pub note: String,
}

#[tauri::command]
pub async fn mask_write_register(
    slave_id: u8,
    address: u16,
    and_mask: u16,
    or_mask: u16,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let pdu = RequestPdu::MaskWriteRegister {
        address,
        and_mask,
        or_mask,
    }
    .encode()
    .map_err(|e| e.to_string())?;
    execute_write(
        slave_id,
        pdu,
        format!("Unit {slave_id} | FC22 MaskWrite Addr {address} AND=0x{and_mask:04X} OR=0x{or_mask:04X}"),
        &app,
        &state,
    )
    .await
}

#[tauri::command]
pub async fn auto_discover_serial(
    port_name: String,
    start_id: u8,
    end_id: u8,
) -> Result<Vec<DiscoverHit>, String> {
    let mut hits = Vec::new();
    let pdu = RequestPdu::ReadHoldingRegisters {
        start_address: 0,
        quantity: 1,
    }
    .encode()
    .map_err(|e| e.to_string())?;

    for baud in [9600u32, 19200, 38400, 115200] {
        for parity in ["N", "E"] {
            let Ok(mut tr) = ActiveTransport::connect_rtu(&port_name, baud, parity, 8, 1, 140) else {
                continue;
            };
            for uid in start_id..=end_id {
                if let Ok(ex) = tr.exchange(uid, &pdu).await {
                    let note = match ResponsePdu::decode(&ex.pdu, None) {
                        Ok(ResponsePdu::Exception { exception, .. }) => format!("Exception: {exception}"),
                        Ok(_) => "Valid Data".to_string(),
                        Err(e) => e.to_string(),
                    };
                    hits.push(DiscoverHit {
                        baud,
                        parity: parity.to_string(),
                        slave_id: uid,
                        fc: 3,
                        note,
                    });
                }
            }
        }
    }
    Ok(hits)
}

#[tauri::command]
pub async fn set_sim_faults(
    delay_ms: u64,
    force_exception: Option<u8>,
    drop_response: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let sim = state.slave_sim.lock().await;
    let mut mem = sim.memory.lock().await;
    mem.faults.delay_ms = delay_ms;
    mem.faults.force_exception = force_exception;
    mem.faults.drop_response = drop_response;
    Ok(())
}

#[tauri::command]
pub async fn asc_ai_chat(
    endpoint: String,
    api_key: String,
    body_json: String,
) -> Result<String, String> {
    let mut url = endpoint.trim().trim_end_matches('/').to_string();
    if url.ends_with("/v1") {
        url.push_str("/chat/completions");
    }

    let py = r#"
import sys, urllib.request, urllib.error
url, key, payload = sys.argv[1], sys.argv[2], sys.stdin.read().encode("utf-8")
headers = {"Content-Type": "application/json", "User-Agent": "ModbusStudio/1.0"}
if key:
    headers["Authorization"] = f"Bearer {key}"
is_local = "127.0.0.1" in url or "localhost" in url
opener = urllib.request.build_opener(urllib.request.ProxyHandler({})) if is_local else urllib.request.build_opener()
req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
try:
    with opener.open(req, timeout=60) as resp:
        sys.stdout.write(resp.read().decode("utf-8", errors="replace"))
except urllib.error.HTTPError as e:
    sys.stderr.write(f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')}")
    sys.exit(1)
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
"#;

    let mut cmd = silent_python_cmd();
    cmd.arg("-c")
        .arg(py)
        .arg(&url)
        .arg(api_key.trim())
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn Python: {e}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        stdin
            .write_all(body_json.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
    }
    let output = child.wait_with_output().await.map_err(|e| e.to_string())?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(if err.is_empty() {
            format!("AI request failed (exit {:?})", output.status.code())
        } else {
            err
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub async fn asc_ai_health(
    endpoint: String,
    api_key: String,
    model: String,
) -> Result<String, String> {
    let base = endpoint.trim().trim_end_matches('/').to_string();
    let models_url = if base.ends_with("/v1") {
        format!("{base}/models")
    } else if let Some(idx) = base.find("/v1/") {
        format!("{}/v1/models", &base[..idx])
    } else {
        String::new()
    };

    if !models_url.is_empty() {
        let py = r#"
import sys, urllib.request, urllib.error
url, key = sys.argv[1], sys.argv[2]
headers = {"User-Agent": "ModbusStudio/1.0"}
if key:
    headers["Authorization"] = f"Bearer {key}"
is_local = "127.0.0.1" in url or "localhost" in url
opener = urllib.request.build_opener(urllib.request.ProxyHandler({})) if is_local else urllib.request.build_opener()
req = urllib.request.Request(url, headers=headers, method="GET")
try:
    with opener.open(req, timeout=10) as resp:
        sys.stdout.write(f"HTTP {resp.status}")
except urllib.error.HTTPError as e:
    sys.stderr.write(f"HTTP {e.code}")
    sys.exit(1)
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
"#;
        let mut cmd = silent_python_cmd();
        if let Ok(out) = cmd.arg("-c").arg(py).arg(&models_url).arg(api_key.trim()).output().await {
            if out.status.success() {
                return Ok("Models endpoint reachable".to_string());
            }
            let err = String::from_utf8_lossy(&out.stderr).to_string();
            if err.starts_with("HTTP 401") || err.starts_with("HTTP 403") {
                return Err(format!("Auth error ({err}) — check API Key"));
            }
        }
    }

    let body = serde_json::json!({
        "model": if model.trim().is_empty() { "auto" } else { model.trim() },
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 5
    })
    .to_string();
    asc_ai_chat(endpoint, api_key, body).await
}
