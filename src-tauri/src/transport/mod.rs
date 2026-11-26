use crate::protocol::frame::{
    decode_ascii, decode_rtu, decode_tcp, encode_ascii, encode_rtu, encode_tcp, ProtocolError,
};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpStream, UdpSocket};
use tokio::time::timeout;
use tokio_serial::{
    ClearBuffer, DataBits, FlowControl, Parity, SerialPort, SerialPortBuilderExt, SerialStream,
    StopBits,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerialPortInfo {
    pub port_name: String,
    pub description: String,
}

#[derive(Debug, Error)]
pub enum TransportError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serial error: {0}")]
    Serial(#[from] tokio_serial::Error),
    #[error("protocol error: {0}")]
    Protocol(#[from] ProtocolError),
    #[error("response timeout after {0} ms")]
    Timeout(u64),
    #[error("not connected")]
    NotConnected,
    #[error("permission denied opening {port} (on Linux, add user to dialout group)")]
    PermissionDenied { port: String },
}

pub struct RawExchange {
    pub tx_frame: Vec<u8>,
    pub rx_frame: Vec<u8>,
    pub unit_id: u8,
    pub pdu: Vec<u8>,
}

pub enum ActiveTransport {
    Tcp {
        stream: TcpStream,
        next_tx_id: u16,
        timeout_ms: u64,
    },
    RtuOverTcp {
        stream: TcpStream,
        timeout_ms: u64,
    },
    Udp {
        socket: UdpSocket,
        next_tx_id: u16,
        timeout_ms: u64,
    },
    Rtu {
        stream: SerialStream,
        timeout_ms: u64,
    },
    Ascii {
        stream: SerialStream,
        timeout_ms: u64,
    },
}

pub fn list_serial_ports() -> Result<Vec<SerialPortInfo>, TransportError> {
    let ports = tokio_serial::available_ports()?;
    Ok(ports
        .into_iter()
        .map(|p| {
            let description = match &p.port_type {
                tokio_serial::SerialPortType::UsbPort(usb) => usb
                    .product
                    .clone()
                    .unwrap_or_else(|| "USB Serial".to_string()),
                tokio_serial::SerialPortType::PciPort => "PCI Serial".to_string(),
                tokio_serial::SerialPortType::BluetoothPort => "Bluetooth Serial".to_string(),
                tokio_serial::SerialPortType::Unknown => "Serial Port".to_string(),
            };
            SerialPortInfo {
                port_name: p.port_name,
                description,
            }
        })
        .collect())
}

impl ActiveTransport {
    pub async fn connect_tcp(host: &str, port: u16, timeout_ms: u64) -> Result<Self, TransportError> {
        let addr = format!("{host}:{port}");
        let stream = timeout(Duration::from_millis(timeout_ms), TcpStream::connect(&addr))
            .await
            .map_err(|_| TransportError::Timeout(timeout_ms))??;
        let _ = stream.set_nodelay(true);
        Ok(Self::Tcp {
            stream,
            next_tx_id: 1,
            timeout_ms,
        })
    }

    pub async fn connect_rtu_over_tcp(
        host: &str,
        port: u16,
        timeout_ms: u64,
    ) -> Result<Self, TransportError> {
        let addr = format!("{host}:{port}");
        let stream = timeout(Duration::from_millis(timeout_ms), TcpStream::connect(&addr))
            .await
            .map_err(|_| TransportError::Timeout(timeout_ms))??;
        let _ = stream.set_nodelay(true);
        Ok(Self::RtuOverTcp { stream, timeout_ms })
    }

    pub async fn connect_udp(host: &str, port: u16, timeout_ms: u64) -> Result<Self, TransportError> {
        let socket = UdpSocket::bind("0.0.0.0:0").await?;
        timeout(Duration::from_millis(timeout_ms), socket.connect(format!("{host}:{port}")))
            .await
            .map_err(|_| TransportError::Timeout(timeout_ms))??;
        Ok(Self::Udp {
            socket,
            next_tx_id: 1,
            timeout_ms,
        })
    }

    pub fn connect_rtu(
        port_name: &str,
        baud_rate: u32,
        parity: &str,
        data_bits: u8,
        stop_bits: u8,
        timeout_ms: u64,
    ) -> Result<Self, TransportError> {
        let parity_val = match parity.to_ascii_uppercase().as_str() {
            "E" | "EVEN" => Parity::Even,
            "O" | "ODD" => Parity::Odd,
            _ => Parity::None,
        };
        let data_val = match data_bits {
            7 => DataBits::Seven,
            _ => DataBits::Eight,
        };
        let stop_val = match stop_bits {
            2 => StopBits::Two,
            _ => StopBits::One,
        };

        let builder = tokio_serial::new(port_name, baud_rate)
            .parity(parity_val)
            .data_bits(data_val)
            .stop_bits(stop_val)
            .flow_control(FlowControl::None)
            .timeout(Duration::from_millis(timeout_ms));

        let mut stream = builder.open_native_async().map_err(|e| {
            if e.kind() == tokio_serial::ErrorKind::Io(std::io::ErrorKind::PermissionDenied) {
                TransportError::PermissionDenied {
                    port: port_name.to_string(),
                }
            } else {
                TransportError::Serial(e)
            }
        })?;

        let _ = stream.write_data_terminal_ready(true);
        let _ = stream.write_request_to_send(true);
        let _ = stream.clear(ClearBuffer::All);

        Ok(Self::Rtu { stream, timeout_ms })
    }

    pub fn connect_ascii(
        port_name: &str,
        baud_rate: u32,
        parity: &str,
        data_bits: u8,
        stop_bits: u8,
        timeout_ms: u64,
    ) -> Result<Self, TransportError> {
        let Self::Rtu { stream, timeout_ms } =
            Self::connect_rtu(port_name, baud_rate, parity, data_bits, stop_bits, timeout_ms)?
        else {
            unreachable!()
        };
        Ok(Self::Ascii { stream, timeout_ms })
    }

    pub async fn exchange(
        &mut self,
        unit_id: u8,
        pdu: &[u8],
    ) -> Result<RawExchange, TransportError> {
        match self {
            Self::Tcp {
                stream,
                next_tx_id,
                timeout_ms,
            } => {
                let tx_id = *next_tx_id;
                *next_tx_id = next_tx_id.wrapping_add(1).max(1);
                let tx_frame = encode_tcp(tx_id, unit_id, pdu)?;

                timeout(Duration::from_millis(*timeout_ms), stream.write_all(&tx_frame))
                    .await
                    .map_err(|_| TransportError::Timeout(*timeout_ms))??;

                let mut mbap_prefix = [0u8; 6];
                timeout(
                    Duration::from_millis(*timeout_ms),
                    stream.read_exact(&mut mbap_prefix),
                )
                .await
                .map_err(|_| TransportError::Timeout(*timeout_ms))??;

                let rem_len = u16::from_be_bytes([mbap_prefix[4], mbap_prefix[5]]) as usize;
                let mut rest = vec![0u8; rem_len];
                timeout(Duration::from_millis(*timeout_ms), stream.read_exact(&mut rest))
                    .await
                    .map_err(|_| TransportError::Timeout(*timeout_ms))??;

                let mut rx_frame = Vec::with_capacity(6 + rem_len);
                rx_frame.extend_from_slice(&mbap_prefix);
                rx_frame.extend_from_slice(&rest);

                let (hdr, rx_pdu) = decode_tcp(&rx_frame)?;
                Ok(RawExchange {
                    tx_frame,
                    rx_frame: rx_frame.clone(),
                    unit_id: hdr.unit_id,
                    pdu: rx_pdu.to_vec(),
                })
            }
            Self::RtuOverTcp { stream, timeout_ms } => {
                let tx_frame = encode_rtu(unit_id, pdu)?;
                timeout(Duration::from_millis(*timeout_ms), stream.write_all(&tx_frame))
                    .await
                    .map_err(|_| TransportError::Timeout(*timeout_ms))??;

                let deadline = tokio::time::Instant::now() + Duration::from_millis(*timeout_ms);
                let mut rx_frame = Vec::with_capacity(256);
                let mut chunk = [0u8; 256];
                loop {
                    let now = tokio::time::Instant::now();
                    if now >= deadline {
                        break;
                    }
                    let wait = if rx_frame.is_empty() {
                        deadline - now
                    } else {
                        (deadline - now).min(Duration::from_millis(35))
                    };
                    match timeout(wait, stream.read(&mut chunk)).await {
                        Ok(Ok(0)) | Err(_) => break,
                        Ok(Ok(n)) => {
                            rx_frame.extend_from_slice(&chunk[..n]);
                            if rx_frame.len() >= 4 && decode_rtu(&rx_frame).is_ok() {
                                break;
                            }
                        }
                        Ok(Err(e)) => return Err(TransportError::Io(e)),
                    }
                }
                if rx_frame.is_empty() {
                    return Err(TransportError::Timeout(*timeout_ms));
                }
                let (rx_uid, rx_pdu) = decode_rtu(&rx_frame)?;
                let pdu = rx_pdu.to_vec();
                Ok(RawExchange {
                    tx_frame,
                    rx_frame,
                    unit_id: rx_uid,
                    pdu,
                })
            }
            Self::Udp {
                socket,
                next_tx_id,
                timeout_ms,
            } => {
                let tx_id = *next_tx_id;
                *next_tx_id = next_tx_id.wrapping_add(1).max(1);
                let tx_frame = encode_tcp(tx_id, unit_id, pdu)?;
                timeout(Duration::from_millis(*timeout_ms), socket.send(&tx_frame))
                    .await
                    .map_err(|_| TransportError::Timeout(*timeout_ms))??;

                let mut buf = [0u8; 512];
                let n = timeout(Duration::from_millis(*timeout_ms), socket.recv(&mut buf))
                    .await
                    .map_err(|_| TransportError::Timeout(*timeout_ms))??;
                let rx_frame = buf[..n].to_vec();
                let (hdr, rx_pdu) = decode_tcp(&rx_frame)?;
                let pdu = rx_pdu.to_vec();
                Ok(RawExchange {
                    tx_frame,
                    rx_frame,
                    unit_id: hdr.unit_id,
                    pdu,
                })
            }
            Self::Rtu { stream, timeout_ms } => {
                let _ = stream.clear(ClearBuffer::Input);
                let tx_frame = encode_rtu(unit_id, pdu)?;
                timeout(Duration::from_millis(*timeout_ms), stream.write_all(&tx_frame))
                    .await
                    .map_err(|_| TransportError::Timeout(*timeout_ms))??;

                let deadline = tokio::time::Instant::now() + Duration::from_millis(*timeout_ms);
                let mut rx_frame = Vec::with_capacity(256);
                let mut chunk = [0u8; 256];

                loop {
                    let now = tokio::time::Instant::now();
                    if now >= deadline {
                        break;
                    }
                    let wait = if rx_frame.is_empty() {
                        deadline - now
                    } else {
                        (deadline - now).min(Duration::from_millis(35))
                    };
                    match timeout(wait, stream.read(&mut chunk)).await {
                        Ok(Ok(0)) | Err(_) => break,
                        Ok(Ok(n)) => {
                            rx_frame.extend_from_slice(&chunk[..n]);
                            if rx_frame.len() >= 4 && decode_rtu(&rx_frame).is_ok() {
                                break;
                            }
                        }
                        Ok(Err(e)) => return Err(TransportError::Io(e)),
                    }
                }

                if rx_frame.is_empty() {
                    return Err(TransportError::Timeout(*timeout_ms));
                }
                let (rx_uid, rx_pdu) = decode_rtu(&rx_frame)?;
                let pdu = rx_pdu.to_vec();
                Ok(RawExchange {
                    tx_frame,
                    rx_frame,
                    unit_id: rx_uid,
                    pdu,
                })
            }
            Self::Ascii { stream, timeout_ms } => {
                let _ = stream.clear(ClearBuffer::Input);
                let tx_frame = encode_ascii(unit_id, pdu)?;
                timeout(Duration::from_millis(*timeout_ms), stream.write_all(&tx_frame))
                    .await
                    .map_err(|_| TransportError::Timeout(*timeout_ms))??;

                let deadline = tokio::time::Instant::now() + Duration::from_millis(*timeout_ms);
                let mut rx_frame = Vec::with_capacity(512);
                let mut chunk = [0u8; 256];

                loop {
                    let now = tokio::time::Instant::now();
                    if now >= deadline {
                        break;
                    }
                    match timeout(deadline - now, stream.read(&mut chunk)).await {
                        Ok(Ok(0)) | Err(_) => break,
                        Ok(Ok(n)) => {
                            rx_frame.extend_from_slice(&chunk[..n]);
                            if rx_frame.ends_with(b"\r\n") {
                                break;
                            }
                        }
                        Ok(Err(e)) => return Err(TransportError::Io(e)),
                    }
                }

                if rx_frame.is_empty() {
                    return Err(TransportError::Timeout(*timeout_ms));
                }
                if let Some(pos) = rx_frame.iter().position(|&b| b == b':') {
                    rx_frame.drain(..pos);
                }
                let (rx_uid, rx_pdu) = decode_ascii(&rx_frame)?;
                Ok(RawExchange {
                    tx_frame,
                    rx_frame,
                    unit_id: rx_uid,
                    pdu: rx_pdu,
                })
            }
        }
    }
}
