use crate::protocol::crc16::{append_crc16, verify_crc16};
use crate::protocol::lrc::{lrc, verify_lrc};
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Maximum Modbus PDU length (253 bytes per Modbus spec: 256 - 1 unit - 2 CRC).
pub const MAX_PDU_LEN: usize = 253;

/// Modbus Application Protocol (MBAP) header for Modbus TCP/UDP.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MbapHeader {
    pub transaction_id: u16,
    pub protocol_id: u16,
    pub length: u16,
    pub unit_id: u8,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ProtocolError {
    #[error("frame too short: expected at least {expected_min} bytes, got {actual}")]
    FrameTooShort { expected_min: usize, actual: usize },

    #[error("frame too long: max PDU is {MAX_PDU_LEN} bytes, got {0}")]
    FrameTooLong(usize),

    #[error("invalid CRC-16: expected 0x{expected:04X}, got 0x{actual:04X}")]
    InvalidCrc { expected: u16, actual: u16 },

    #[error("invalid LRC: expected 0x{expected:02X}, got 0x{actual:02X}")]
    InvalidLrc { expected: u8, actual: u8 },

    #[error("invalid Modbus ASCII frame: {0}")]
    InvalidAsciiFrame(&'static str),

    #[error("invalid hex character in ASCII frame: 0x{0:02X}")]
    InvalidHexChar(u8),

    #[error("unexpected MBAP protocol ID: expected 0x0000, got 0x{0:04X}")]
    UnexpectedProtocolId(u16),

    #[error("length mismatch: expected {expected} bytes, got {actual}")]
    LengthMismatch { expected: usize, actual: usize },

    #[error("unsupported function code: 0x{0:02X}")]
    UnsupportedFunctionCode(u8),

    #[error("invalid quantity {actual}: must be in {min}..={max}")]
    InvalidQuantity { min: usize, max: usize, actual: usize },

    #[error("invalid data value")]
    InvalidDataValue,

    #[error("malformed PDU: {0}")]
    MalformedPdu(&'static str),
}

fn check_pdu_bounds(pdu: &[u8]) -> Result<(), ProtocolError> {
    if pdu.is_empty() {
        return Err(ProtocolError::FrameTooShort {
            expected_min: 1,
            actual: 0,
        });
    }
    if pdu.len() > MAX_PDU_LEN {
        return Err(ProtocolError::FrameTooLong(pdu.len()));
    }
    Ok(())
}

/// Encodes a unit ID and PDU into a Modbus RTU ADU (`[unit_id, pdu..., crc_lo, crc_hi]`).
pub fn encode_rtu(unit_id: u8, pdu: &[u8]) -> Result<Vec<u8>, ProtocolError> {
    check_pdu_bounds(pdu)?;
    let mut frame = Vec::with_capacity(1 + pdu.len() + 2);
    frame.push(unit_id);
    frame.extend_from_slice(pdu);
    append_crc16(&mut frame);
    Ok(frame)
}

/// Decodes and CRC-verifies a Modbus RTU ADU into `(unit_id, pdu_slice)`.
pub fn decode_rtu(frame: &[u8]) -> Result<(u8, &[u8]), ProtocolError> {
    let payload = verify_crc16(frame)?;
    let (&unit_id, pdu) = payload.split_first().ok_or(ProtocolError::FrameTooShort {
        expected_min: 4,
        actual: frame.len(),
    })?;
    check_pdu_bounds(pdu)?;
    Ok((unit_id, pdu))
}

/// Encodes a unit ID and PDU into a Modbus ASCII frame (`:HH...LRC\r\n`).
pub fn encode_ascii(unit_id: u8, pdu: &[u8]) -> Result<Vec<u8>, ProtocolError> {
    check_pdu_bounds(pdu)?;
    let mut raw = Vec::with_capacity(1 + pdu.len() + 1);
    raw.push(unit_id);
    raw.extend_from_slice(pdu);
    let checksum = lrc(&raw);
    raw.push(checksum);

    let mut out = Vec::with_capacity(1 + raw.len() * 2 + 2);
    out.push(b':');
    for byte in raw {
        const HEX: &[u8; 16] = b"0123456789ABCDEF";
        out.push(HEX[(byte >> 4) as usize]);
        out.push(HEX[(byte & 0x0F) as usize]);
    }
    out.extend_from_slice(b"\r\n");
    Ok(out)
}

/// Decodes and LRC-verifies a Modbus ASCII frame into `(unit_id, pdu_bytes)`.
pub fn decode_ascii(frame: &[u8]) -> Result<(u8, Vec<u8>), ProtocolError> {
    if frame.len() < 9 {
        return Err(ProtocolError::FrameTooShort {
            expected_min: 9,
            actual: frame.len(),
        });
    }
    if frame[0] != b':' || !frame.ends_with(b"\r\n") {
        return Err(ProtocolError::InvalidAsciiFrame(
            "frame must start with ':' and end with CRLF",
        ));
    }
    let hex_body = &frame[1..frame.len() - 2];
    if !hex_body.len().is_multiple_of(2) {
        return Err(ProtocolError::InvalidAsciiFrame(
            "odd number of hex characters",
        ));
    }

    let mut raw = Vec::with_capacity(hex_body.len() / 2);
    for pair in hex_body.as_chunks::<2>().0 {
        let hi = hex_nibble(pair[0])?;
        let lo = hex_nibble(pair[1])?;
        raw.push((hi << 4) | lo);
    }

    let payload = verify_lrc(&raw)?;
    let (&unit_id, pdu) = payload.split_first().ok_or(ProtocolError::FrameTooShort {
        expected_min: 3,
        actual: raw.len(),
    })?;
    check_pdu_bounds(pdu)?;
    Ok((unit_id, pdu.to_vec()))
}

fn hex_nibble(byte: u8) -> Result<u8, ProtocolError> {
    match byte {
        b'0'..=b'9' => Ok(byte - b'0'),
        b'A'..=b'F' => Ok(byte - b'A' + 10),
        b'a'..=b'f' => Ok(byte - b'a' + 10),
        other => Err(ProtocolError::InvalidHexChar(other)),
    }
}

/// Encodes a Modbus TCP/UDP ADU (`MBAP header (7 bytes) + PDU`).
pub fn encode_tcp(
    transaction_id: u16,
    unit_id: u8,
    pdu: &[u8],
) -> Result<Vec<u8>, ProtocolError> {
    check_pdu_bounds(pdu)?;
    let length = (1 + pdu.len()) as u16; // unit_id + pdu
    let mut frame = Vec::with_capacity(7 + pdu.len());
    frame.extend_from_slice(&transaction_id.to_be_bytes());
    frame.extend_from_slice(&0u16.to_be_bytes()); // protocol_id = 0
    frame.extend_from_slice(&length.to_be_bytes());
    frame.push(unit_id);
    frame.extend_from_slice(pdu);
    Ok(frame)
}

/// Decodes a Modbus TCP/UDP ADU into `(MbapHeader, pdu_slice)`.
pub fn decode_tcp(frame: &[u8]) -> Result<(MbapHeader, &[u8]), ProtocolError> {
    if frame.len() < 8 {
        return Err(ProtocolError::FrameTooShort {
            expected_min: 8,
            actual: frame.len(),
        });
    }
    let transaction_id = u16::from_be_bytes([frame[0], frame[1]]);
    let protocol_id = u16::from_be_bytes([frame[2], frame[3]]);
    if protocol_id != 0 {
        return Err(ProtocolError::UnexpectedProtocolId(protocol_id));
    }
    let length = u16::from_be_bytes([frame[4], frame[5]]);
    let unit_id = frame[6];
    let expected_total = 6 + usize::from(length);
    if frame.len() != expected_total {
        return Err(ProtocolError::LengthMismatch {
            expected: expected_total,
            actual: frame.len(),
        });
    }
    let pdu = &frame[7..];
    check_pdu_bounds(pdu)?;
    Ok((
        MbapHeader {
            transaction_id,
            protocol_id,
            length,
            unit_id,
        },
        pdu,
    ))
}
