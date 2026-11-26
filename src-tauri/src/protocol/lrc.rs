use crate::protocol::frame::ProtocolError;

/// Computes the Modbus ASCII Longitudinal Redundancy Check (LRC).
/// Defined as the two's complement of the 8-bit sum of all address + PDU bytes.
pub fn lrc(data: &[u8]) -> u8 {
    let sum = data.iter().fold(0u8, |acc, &b| acc.wrapping_add(b));
    (!sum).wrapping_add(1)
}

/// Verifies the trailing 1-byte LRC of a decoded Modbus ASCII byte payload.
/// Returns the payload slice without the LRC byte if valid.
pub fn verify_lrc(raw_bytes: &[u8]) -> Result<&[u8], ProtocolError> {
    if raw_bytes.len() < 3 {
        return Err(ProtocolError::FrameTooShort {
            expected_min: 3,
            actual: raw_bytes.len(),
        });
    }
    let (payload, lrc_byte) = raw_bytes.split_at(raw_bytes.len() - 1);
    let expected = lrc(payload);
    let actual = lrc_byte[0];
    if expected != actual {
        return Err(ProtocolError::InvalidLrc { expected, actual });
    }
    Ok(payload)
}
