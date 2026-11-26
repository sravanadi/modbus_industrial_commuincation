use crate::protocol::frame::ProtocolError;

/// Computes the standard Modbus RTU CRC-16 (polynomial 0xA001, initial value 0xFFFF).
pub fn crc16(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= u16::from(byte);
        for _ in 0..8 {
            if (crc & 0x0001) != 0 {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    crc
}

/// Appends the 2-byte little-endian Modbus CRC-16 to `buf`.
pub fn append_crc16(buf: &mut Vec<u8>) {
    let crc = crc16(buf);
    buf.extend_from_slice(&crc.to_le_bytes());
}

/// Verifies the trailing 2-byte little-endian CRC-16 of an RTU frame.
/// Returns the frame slice without the CRC bytes if valid.
pub fn verify_crc16(frame: &[u8]) -> Result<&[u8], ProtocolError> {
    if frame.len() < 4 {
        return Err(ProtocolError::FrameTooShort {
            expected_min: 4,
            actual: frame.len(),
        });
    }
    let (payload, crc_bytes) = frame.split_at(frame.len() - 2);
    let expected = crc16(payload);
    let actual = u16::from_le_bytes([crc_bytes[0], crc_bytes[1]]);
    if expected != actual {
        return Err(ProtocolError::InvalidCrc { expected, actual });
    }
    Ok(payload)
}
