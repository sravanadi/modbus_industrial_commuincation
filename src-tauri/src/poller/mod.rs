use crate::protocol::frame::ProtocolError;
use crate::protocol::function_codes::{RequestPdu, ResponsePdu};
use crate::transport::{ActiveTransport, TransportError};
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PollConfig {
    pub window_id: String,
    pub slave_id: u8,
    pub function_code: u8,
    pub start_address: u16,
    pub quantity: u16,
    pub scan_rate_ms: u64,
}

#[derive(Debug, Clone)]
pub enum ConnectTarget {
    Tcp { host: String, port: u16, timeout_ms: u64 },
    RtuOverTcp { host: String, port: u16, timeout_ms: u64 },
    Udp { host: String, port: u16, timeout_ms: u64 },
    Rtu { port_name: String, baud_rate: u32, parity: String, data_bits: u8, stop_bits: u8, timeout_ms: u64 },
    Ascii { port_name: String, baud_rate: u32, parity: String, data_bits: u8, stop_bits: u8, timeout_ms: u64 },
}

impl ConnectTarget {
    pub async fn connect(&self) -> Result<ActiveTransport, TransportError> {
        match self {
            Self::Tcp { host, port, timeout_ms } => ActiveTransport::connect_tcp(host, *port, *timeout_ms).await,
            Self::RtuOverTcp { host, port, timeout_ms } => ActiveTransport::connect_rtu_over_tcp(host, *port, *timeout_ms).await,
            Self::Udp { host, port, timeout_ms } => ActiveTransport::connect_udp(host, *port, *timeout_ms).await,
            Self::Rtu { port_name, baud_rate, parity, data_bits, stop_bits, timeout_ms } => {
                ActiveTransport::connect_rtu(port_name, *baud_rate, parity, *data_bits, *stop_bits, *timeout_ms)
            }
            Self::Ascii { port_name, baud_rate, parity, data_bits, stop_bits, timeout_ms } => {
                ActiveTransport::connect_ascii(port_name, *baud_rate, parity, *data_bits, *stop_bits, *timeout_ms)
            }
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct PollDataEvent {
    pub window_id: String,
    pub values: Vec<u16>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrafficEvent {
    pub id: String,
    pub timestamp: String,
    pub direction: String,
    pub transport: String,
    pub hex: String,
    pub decoded: String,
    pub is_error: bool,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct PollStatsEvent {
    pub tx_count: u64,
    pub rx_valid_count: u64,
    pub crc_errors: u64,
    pub timeouts: u64,
    pub exception_count: u64,
    pub min_ms: f64,
    pub avg_ms: f64,
    pub max_ms: f64,
}

pub struct SharedConnection {
    pub transport: Option<ActiveTransport>,
    pub target: Option<ConnectTarget>,
    pub transport_label: String,
    pub stats: PollStatsEvent,
}

pub type ConnectionState = Arc<Mutex<SharedConnection>>;

pub struct PollerHandle {
    task: Option<JoinHandle<()>>,
}

impl Default for PollerHandle {
    fn default() -> Self {
        Self::new()
    }
}

impl PollerHandle {
    pub fn new() -> Self {
        Self { task: None }
    }

    pub fn stop(&mut self) {
        if let Some(handle) = self.task.take() {
            handle.abort();
        }
    }

    pub fn start(
        &mut self,
        app: AppHandle,
        conn: ConnectionState,
        configs: Vec<PollConfig>,
        auto_reconnect: bool,
    ) {
        self.stop();
        if configs.is_empty() {
            return;
        }
        let scan_ms = configs.iter().map(|c| c.scan_rate_ms).min().unwrap_or(1000).max(50);
        self.task = Some(tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(scan_ms));
            let mut seq: u64 = 0;

            loop {
                interval.tick().await;
                seq = seq.wrapping_add(1);

                for cfg in &configs {
                    let started = Instant::now();
                    let chunk_size: u16 = if cfg.function_code <= 2 { 1000 } else { 125 };
                    let mut offset: u16 = 0;
                    let mut combined_values = Vec::with_capacity(cfg.quantity as usize);
                    let mut chunk_error: Option<String> = None;

                    while offset < cfg.quantity {
                        let qty = (cfg.quantity - offset).min(chunk_size);
                        let chunk_cfg = PollConfig {
                            start_address: cfg.start_address.saturating_add(offset),
                            quantity: qty,
                            ..cfg.clone()
                        };
                        let req = match build_read_request(&chunk_cfg) {
                            Ok(r) => r,
                            Err(e) => {
                                chunk_error = Some(e);
                                break;
                            }
                        };
                        let pdu = match req.encode() {
                            Ok(p) => p,
                            Err(e) => {
                                chunk_error = Some(e.to_string());
                                break;
                            }
                        };

                        let mut guard = conn.lock().await;
                        if guard.transport.is_none() {
                            if auto_reconnect {
                                if let Some(target) = guard.target.clone() {
                                    if let Ok(t) = target.connect().await {
                                        guard.transport = Some(t);
                                    }
                                }
                            }
                            if guard.transport.is_none() {
                                chunk_error = Some("Not connected".to_string());
                                break;
                            }
                        }
                        let transport_label = guard.transport_label.clone();
                        guard.stats.tx_count += 1;
                        let tx_ts = Local::now().format("%H:%M:%S%.3f").to_string();

                        let exchange_res = guard
                            .transport
                            .as_mut()
                            .unwrap()
                            .exchange(cfg.slave_id, &pdu)
                            .await;

                        match exchange_res {
                            Ok(ex) => {
                                let rtt_ms = started.elapsed().as_secs_f64() * 1000.0;
                                let rx_ts = Local::now().format("%H:%M:%S%.3f").to_string();
                                let _ = app.emit(
                                    "modbus://traffic",
                                    TrafficEvent {
                                        id: format!("tx-{seq}-{offset}"),
                                        timestamp: tx_ts,
                                        direction: "TX".to_string(),
                                        transport: transport_label.clone(),
                                        hex: to_hex(&ex.tx_frame),
                                        decoded: format!(
                                            "Unit {} | FC{:02} | Addr {}, Qty {}",
                                            cfg.slave_id,
                                            cfg.function_code,
                                            chunk_cfg.start_address,
                                            qty
                                        ),
                                        is_error: false,
                                    },
                                );

                                let expected_bits = if cfg.function_code <= 2 {
                                    Some(qty as usize)
                                } else {
                                    None
                                };

                                match ResponsePdu::decode(&ex.pdu, expected_bits) {
                                    Ok(ResponsePdu::Exception {
                                        function_code,
                                        exception,
                                    }) => {
                                        guard.stats.exception_count += 1;
                                        let msg = format!("FC{:02} Exception: {exception}", function_code);
                                        let _ = app.emit(
                                            "modbus://traffic",
                                            TrafficEvent {
                                                id: format!("rx-{seq}-{offset}"),
                                                timestamp: rx_ts,
                                                direction: "RX".to_string(),
                                                transport: transport_label,
                                                hex: to_hex(&ex.rx_frame),
                                                decoded: msg.clone(),
                                                is_error: true,
                                            },
                                        );
                                        chunk_error = Some(msg);
                                        break;
                                    }
                                    Ok(resp) => {
                                        guard.stats.rx_valid_count += 1;
                                        update_latency(&mut guard.stats, rtt_ms);
                                        combined_values.extend(extract_values(resp));
                                        let _ = app.emit(
                                            "modbus://traffic",
                                            TrafficEvent {
                                                id: format!("rx-{seq}-{offset}"),
                                                timestamp: rx_ts,
                                                direction: "RX".to_string(),
                                                transport: transport_label,
                                                hex: to_hex(&ex.rx_frame),
                                                decoded: format!(
                                                    "Unit {} | FC{:02} OK ({:.1} ms)",
                                                    ex.unit_id, cfg.function_code, rtt_ms
                                                ),
                                                is_error: false,
                                            },
                                        );
                                    }
                                    Err(err) => {
                                        guard.stats.crc_errors += 1;
                                        chunk_error = Some(err.to_string());
                                        break;
                                    }
                                }
                            }
                            Err(err) => {
                                match err {
                                    TransportError::Timeout(_) => guard.stats.timeouts += 1,
                                    TransportError::Protocol(ProtocolError::InvalidCrc { .. }) => {
                                        guard.stats.crc_errors += 1
                                    }
                                    TransportError::Io(_) if auto_reconnect => {
                                        guard.transport = None;
                                    }
                                    _ => {}
                                }
                                let _ = app.emit(
                                    "modbus://traffic",
                                    TrafficEvent {
                                        id: format!("err-{seq}-{offset}"),
                                        timestamp: tx_ts,
                                        direction: "TX".to_string(),
                                        transport: transport_label,
                                        hex: to_hex(&pdu),
                                        decoded: err.to_string(),
                                        is_error: true,
                                    },
                                );
                                chunk_error = Some(err.to_string());
                                break;
                            }
                        }
                        offset += qty;
                    }

                    let stats_snapshot = conn.lock().await.stats.clone();
                    let _ = app.emit("modbus://stats", stats_snapshot);
                    let _ = app.emit(
                        "modbus://poll-data",
                        PollDataEvent {
                            window_id: cfg.window_id.clone(),
                            values: if chunk_error.is_some() {
                                Vec::new()
                            } else {
                                combined_values
                            },
                            error: chunk_error,
                        },
                    );
                }
            }
        }));
    }
}

fn build_read_request(cfg: &PollConfig) -> Result<RequestPdu, String> {
    match cfg.function_code {
        1 => Ok(RequestPdu::ReadCoils {
            start_address: cfg.start_address,
            quantity: cfg.quantity,
        }),
        2 => Ok(RequestPdu::ReadDiscreteInputs {
            start_address: cfg.start_address,
            quantity: cfg.quantity,
        }),
        3 => Ok(RequestPdu::ReadHoldingRegisters {
            start_address: cfg.start_address,
            quantity: cfg.quantity,
        }),
        4 => Ok(RequestPdu::ReadInputRegisters {
            start_address: cfg.start_address,
            quantity: cfg.quantity,
        }),
        other => Err(format!("Unsupported poll function code: {other}")),
    }
}

fn extract_values(resp: ResponsePdu) -> Vec<u16> {
    match resp {
        ResponsePdu::ReadCoils { coils } => coils.into_iter().map(u16::from).collect(),
        ResponsePdu::ReadDiscreteInputs { inputs } => inputs.into_iter().map(u16::from).collect(),
        ResponsePdu::ReadHoldingRegisters { registers } => registers,
        ResponsePdu::ReadInputRegisters { registers } => registers,
        _ => Vec::new(),
    }
}

fn update_latency(stats: &mut PollStatsEvent, rtt_ms: f64) {
    let rounded = (rtt_ms * 10.0).round() / 10.0;
    stats.min_ms = if stats.min_ms == 0.0 {
        rounded
    } else {
        stats.min_ms.min(rounded)
    };
    stats.max_ms = stats.max_ms.max(rounded);
    let n = stats.rx_valid_count as f64;
    stats.avg_ms = (((stats.avg_ms * (n - 1.0)) + rounded) / n * 10.0).round() / 10.0;
}

pub fn to_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| format!("{b:02X}"))
        .collect::<Vec<_>>()
        .join(" ")
}
