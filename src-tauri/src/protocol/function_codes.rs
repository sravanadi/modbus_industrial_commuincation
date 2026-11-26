use crate::protocol::exceptions::ExceptionCode;
use crate::protocol::frame::ProtocolError;
use serde::{Deserialize, Serialize};

/// Supported Modbus public function codes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum FunctionCode {
    ReadCoils = 0x01,
    ReadDiscreteInputs = 0x02,
    ReadHoldingRegisters = 0x03,
    ReadInputRegisters = 0x04,
    WriteSingleCoil = 0x05,
    WriteSingleRegister = 0x06,
    ReadExceptionStatus = 0x07,
    Diagnostics = 0x08,
    WriteMultipleCoils = 0x0F,
    WriteMultipleRegisters = 0x10,
    ReportServerId = 0x11,
    MaskWriteRegister = 0x16,
    ReadWriteMultipleRegisters = 0x17,
    EncapsulatedInterfaceTransport = 0x2B,
}

impl FunctionCode {
    pub fn from_byte(byte: u8) -> Result<Self, ProtocolError> {
        match byte {
            0x01 => Ok(Self::ReadCoils),
            0x02 => Ok(Self::ReadDiscreteInputs),
            0x03 => Ok(Self::ReadHoldingRegisters),
            0x04 => Ok(Self::ReadInputRegisters),
            0x05 => Ok(Self::WriteSingleCoil),
            0x06 => Ok(Self::WriteSingleRegister),
            0x07 => Ok(Self::ReadExceptionStatus),
            0x08 => Ok(Self::Diagnostics),
            0x0F => Ok(Self::WriteMultipleCoils),
            0x10 => Ok(Self::WriteMultipleRegisters),
            0x11 => Ok(Self::ReportServerId),
            0x16 => Ok(Self::MaskWriteRegister),
            0x17 => Ok(Self::ReadWriteMultipleRegisters),
            0x2B => Ok(Self::EncapsulatedInterfaceTransport),
            other => Err(ProtocolError::UnsupportedFunctionCode(other)),
        }
    }

    pub fn as_byte(self) -> u8 {
        self as u8
    }
}

/// Modbus request Protocol Data Unit (PDU: function code + data, no unit ID or checksum).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum RequestPdu {
    ReadCoils {
        start_address: u16,
        quantity: u16,
    },
    ReadDiscreteInputs {
        start_address: u16,
        quantity: u16,
    },
    ReadHoldingRegisters {
        start_address: u16,
        quantity: u16,
    },
    ReadInputRegisters {
        start_address: u16,
        quantity: u16,
    },
    WriteSingleCoil {
        address: u16,
        value: bool,
    },
    WriteSingleRegister {
        address: u16,
        value: u16,
    },
    ReadExceptionStatus,
    Diagnostics {
        sub_function: u16,
        data: Vec<u16>,
    },
    WriteMultipleCoils {
        start_address: u16,
        values: Vec<bool>,
    },
    WriteMultipleRegisters {
        start_address: u16,
        values: Vec<u16>,
    },
    ReportServerId,
    MaskWriteRegister {
        address: u16,
        and_mask: u16,
        or_mask: u16,
    },
    ReadWriteMultipleRegisters {
        read_start: u16,
        read_quantity: u16,
        write_start: u16,
        write_values: Vec<u16>,
    },
    /// FC 43 (0x2B) / MEI Type 0x0E: Read Device Identification
    ReadDeviceIdentification {
        read_device_id_code: u8,
        object_id: u8,
    },
}

/// Decoded Modbus response PDU.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResponsePdu {
    Exception {
        function_code: u8,
        exception: ExceptionCode,
    },
    ReadCoils {
        coils: Vec<bool>,
    },
    ReadDiscreteInputs {
        inputs: Vec<bool>,
    },
    ReadHoldingRegisters {
        registers: Vec<u16>,
    },
    ReadInputRegisters {
        registers: Vec<u16>,
    },
    WriteSingleCoil {
        address: u16,
        value: bool,
    },
    WriteSingleRegister {
        address: u16,
        value: u16,
    },
    ReadExceptionStatus {
        status: u8,
    },
    Diagnostics {
        sub_function: u16,
        data: Vec<u16>,
    },
    WriteMultipleCoils {
        start_address: u16,
        quantity: u16,
    },
    WriteMultipleRegisters {
        start_address: u16,
        quantity: u16,
    },
    ReportServerId {
        data: Vec<u8>,
    },
    MaskWriteRegister {
        address: u16,
        and_mask: u16,
        or_mask: u16,
    },
    ReadWriteMultipleRegisters {
        registers: Vec<u16>,
    },
    ReadDeviceIdentification {
        read_device_id_code: u8,
        conformity_level: u8,
        more_follows: bool,
        next_object_id: u8,
        objects: Vec<(u8, Vec<u8>)>,
    },
}

/// Packs booleans into LSB-first Modbus coil/discrete bytes.
pub fn pack_bits(bits: &[bool]) -> Vec<u8> {
    let byte_count = bits.len().div_ceil(8);
    let mut out = vec![0u8; byte_count];
    for (i, &bit) in bits.iter().enumerate() {
        if bit {
            out[i / 8] |= 1 << (i % 8);
        }
    }
    out
}

/// Unpacks LSB-first Modbus coil/discrete bytes into `count` booleans.
pub fn unpack_bits(bytes: &[u8], count: usize) -> Result<Vec<bool>, ProtocolError> {
    let required_bytes = count.div_ceil(8);
    if bytes.len() < required_bytes {
        return Err(ProtocolError::LengthMismatch {
            expected: required_bytes,
            actual: bytes.len(),
        });
    }
    let mut out = Vec::with_capacity(count);
    for i in 0..count {
        let bit = (bytes[i / 8] >> (i % 8)) & 0x01 != 0;
        out.push(bit);
    }
    Ok(out)
}

fn read_u16_be(bytes: &[u8], offset: usize) -> Result<u16, ProtocolError> {
    let slice = bytes
        .get(offset..offset + 2)
        .ok_or(ProtocolError::MalformedPdu("unexpected end of PDU reading u16"))?;
    Ok(u16::from_be_bytes([slice[0], slice[1]]))
}

impl RequestPdu {
    /// Encodes the request PDU into bytes (function code + payload).
    pub fn encode(&self) -> Result<Vec<u8>, ProtocolError> {
        let mut buf = Vec::with_capacity(16);
        match self {
            Self::ReadCoils { start_address, quantity } => {
                validate_bit_read_qty(*quantity)?;
                buf.push(FunctionCode::ReadCoils.as_byte());
                buf.extend_from_slice(&start_address.to_be_bytes());
                buf.extend_from_slice(&quantity.to_be_bytes());
            }
            Self::ReadDiscreteInputs { start_address, quantity } => {
                validate_bit_read_qty(*quantity)?;
                buf.push(FunctionCode::ReadDiscreteInputs.as_byte());
                buf.extend_from_slice(&start_address.to_be_bytes());
                buf.extend_from_slice(&quantity.to_be_bytes());
            }
            Self::ReadHoldingRegisters { start_address, quantity } => {
                validate_reg_read_qty(*quantity)?;
                buf.push(FunctionCode::ReadHoldingRegisters.as_byte());
                buf.extend_from_slice(&start_address.to_be_bytes());
                buf.extend_from_slice(&quantity.to_be_bytes());
            }
            Self::ReadInputRegisters { start_address, quantity } => {
                validate_reg_read_qty(*quantity)?;
                buf.push(FunctionCode::ReadInputRegisters.as_byte());
                buf.extend_from_slice(&start_address.to_be_bytes());
                buf.extend_from_slice(&quantity.to_be_bytes());
            }
            Self::WriteSingleCoil { address, value } => {
                buf.push(FunctionCode::WriteSingleCoil.as_byte());
                buf.extend_from_slice(&address.to_be_bytes());
                let raw: u16 = if *value { 0xFF00 } else { 0x0000 };
                buf.extend_from_slice(&raw.to_be_bytes());
            }
            Self::WriteSingleRegister { address, value } => {
                buf.push(FunctionCode::WriteSingleRegister.as_byte());
                buf.extend_from_slice(&address.to_be_bytes());
                buf.extend_from_slice(&value.to_be_bytes());
            }
            Self::ReadExceptionStatus => {
                buf.push(FunctionCode::ReadExceptionStatus.as_byte());
            }
            Self::Diagnostics { sub_function, data } => {
                buf.push(FunctionCode::Diagnostics.as_byte());
                buf.extend_from_slice(&sub_function.to_be_bytes());
                for word in data {
                    buf.extend_from_slice(&word.to_be_bytes());
                }
            }
            Self::WriteMultipleCoils { start_address, values } => {
                if values.is_empty() || values.len() > 1968 {
                    return Err(ProtocolError::InvalidQuantity {
                        min: 1,
                        max: 1968,
                        actual: values.len(),
                    });
                }
                let packed = pack_bits(values);
                buf.push(FunctionCode::WriteMultipleCoils.as_byte());
                buf.extend_from_slice(&start_address.to_be_bytes());
                buf.extend_from_slice(&(values.len() as u16).to_be_bytes());
                buf.push(packed.len() as u8);
                buf.extend_from_slice(&packed);
            }
            Self::WriteMultipleRegisters { start_address, values } => {
                if values.is_empty() || values.len() > 123 {
                    return Err(ProtocolError::InvalidQuantity {
                        min: 1,
                        max: 123,
                        actual: values.len(),
                    });
                }
                buf.push(FunctionCode::WriteMultipleRegisters.as_byte());
                buf.extend_from_slice(&start_address.to_be_bytes());
                buf.extend_from_slice(&(values.len() as u16).to_be_bytes());
                buf.push((values.len() * 2) as u8);
                for word in values {
                    buf.extend_from_slice(&word.to_be_bytes());
                }
            }
            Self::ReportServerId => {
                buf.push(FunctionCode::ReportServerId.as_byte());
            }
            Self::MaskWriteRegister {
                address,
                and_mask,
                or_mask,
            } => {
                buf.push(FunctionCode::MaskWriteRegister.as_byte());
                buf.extend_from_slice(&address.to_be_bytes());
                buf.extend_from_slice(&and_mask.to_be_bytes());
                buf.extend_from_slice(&or_mask.to_be_bytes());
            }
            Self::ReadWriteMultipleRegisters {
                read_start,
                read_quantity,
                write_start,
                write_values,
            } => {
                validate_reg_read_qty(*read_quantity)?;
                if write_values.is_empty() || write_values.len() > 121 {
                    return Err(ProtocolError::InvalidQuantity {
                        min: 1,
                        max: 121,
                        actual: write_values.len(),
                    });
                }
                buf.push(FunctionCode::ReadWriteMultipleRegisters.as_byte());
                buf.extend_from_slice(&read_start.to_be_bytes());
                buf.extend_from_slice(&read_quantity.to_be_bytes());
                buf.extend_from_slice(&write_start.to_be_bytes());
                buf.extend_from_slice(&(write_values.len() as u16).to_be_bytes());
                buf.push((write_values.len() * 2) as u8);
                for word in write_values {
                    buf.extend_from_slice(&word.to_be_bytes());
                }
            }
            Self::ReadDeviceIdentification {
                read_device_id_code,
                object_id,
            } => {
                buf.push(FunctionCode::EncapsulatedInterfaceTransport.as_byte());
                buf.push(0x0E); // MEI Type: Read Device Identification
                buf.push(*read_device_id_code);
                buf.push(*object_id);
            }
        }
        Ok(buf)
    }

    /// Decodes a request PDU from bytes (useful for slave simulator and traffic monitor).
    pub fn decode(pdu: &[u8]) -> Result<Self, ProtocolError> {
        let &fc_byte = pdu.first().ok_or(ProtocolError::FrameTooShort {
            expected_min: 1,
            actual: 0,
        })?;
        let fc = FunctionCode::from_byte(fc_byte)?;
        match fc {
            FunctionCode::ReadCoils => {
                check_exact_len(pdu, 5)?;
                let start_address = read_u16_be(pdu, 1)?;
                let quantity = read_u16_be(pdu, 3)?;
                validate_bit_read_qty(quantity)?;
                Ok(Self::ReadCoils { start_address, quantity })
            }
            FunctionCode::ReadDiscreteInputs => {
                check_exact_len(pdu, 5)?;
                let start_address = read_u16_be(pdu, 1)?;
                let quantity = read_u16_be(pdu, 3)?;
                validate_bit_read_qty(quantity)?;
                Ok(Self::ReadDiscreteInputs { start_address, quantity })
            }
            FunctionCode::ReadHoldingRegisters => {
                check_exact_len(pdu, 5)?;
                let start_address = read_u16_be(pdu, 1)?;
                let quantity = read_u16_be(pdu, 3)?;
                validate_reg_read_qty(quantity)?;
                Ok(Self::ReadHoldingRegisters { start_address, quantity })
            }
            FunctionCode::ReadInputRegisters => {
                check_exact_len(pdu, 5)?;
                let start_address = read_u16_be(pdu, 1)?;
                let quantity = read_u16_be(pdu, 3)?;
                validate_reg_read_qty(quantity)?;
                Ok(Self::ReadInputRegisters { start_address, quantity })
            }
            FunctionCode::WriteSingleCoil => {
                check_exact_len(pdu, 5)?;
                let address = read_u16_be(pdu, 1)?;
                let raw = read_u16_be(pdu, 3)?;
                let value = match raw {
                    0xFF00 => true,
                    0x0000 => false,
                    _ => return Err(ProtocolError::InvalidDataValue),
                };
                Ok(Self::WriteSingleCoil { address, value })
            }
            FunctionCode::WriteSingleRegister => {
                check_exact_len(pdu, 5)?;
                let address = read_u16_be(pdu, 1)?;
                let value = read_u16_be(pdu, 3)?;
                Ok(Self::WriteSingleRegister { address, value })
            }
            FunctionCode::ReadExceptionStatus => {
                check_exact_len(pdu, 1)?;
                Ok(Self::ReadExceptionStatus)
            }
            FunctionCode::Diagnostics => {
                if pdu.len() < 5 || !(pdu.len() - 3).is_multiple_of(2) {
                    return Err(ProtocolError::MalformedPdu("invalid diagnostics request length"));
                }
                let sub_function = read_u16_be(pdu, 1)?;
                let mut data = Vec::with_capacity((pdu.len() - 3) / 2);
                for chunk in pdu[3..].as_chunks::<2>().0 {
                    data.push(u16::from_be_bytes([chunk[0], chunk[1]]));
                }
                Ok(Self::Diagnostics { sub_function, data })
            }
            FunctionCode::WriteMultipleCoils => {
                if pdu.len() < 6 {
                    return Err(ProtocolError::FrameTooShort {
                        expected_min: 6,
                        actual: pdu.len(),
                    });
                }
                let start_address = read_u16_be(pdu, 1)?;
                let quantity = read_u16_be(pdu, 3)? as usize;
                let byte_count = pdu[5] as usize;
                if quantity == 0 || quantity > 1968 {
                    return Err(ProtocolError::InvalidQuantity {
                        min: 1,
                        max: 1968,
                        actual: quantity,
                    });
                }
                if byte_count != quantity.div_ceil(8) || pdu.len() != 6 + byte_count {
                    return Err(ProtocolError::LengthMismatch {
                        expected: 6 + byte_count,
                        actual: pdu.len(),
                    });
                }
                let values = unpack_bits(&pdu[6..], quantity)?;
                Ok(Self::WriteMultipleCoils { start_address, values })
            }
            FunctionCode::WriteMultipleRegisters => {
                if pdu.len() < 6 {
                    return Err(ProtocolError::FrameTooShort {
                        expected_min: 6,
                        actual: pdu.len(),
                    });
                }
                let start_address = read_u16_be(pdu, 1)?;
                let quantity = read_u16_be(pdu, 3)? as usize;
                let byte_count = pdu[5] as usize;
                if quantity == 0 || quantity > 123 {
                    return Err(ProtocolError::InvalidQuantity {
                        min: 1,
                        max: 123,
                        actual: quantity,
                    });
                }
                if byte_count != quantity * 2 || pdu.len() != 6 + byte_count {
                    return Err(ProtocolError::LengthMismatch {
                        expected: 6 + byte_count,
                        actual: pdu.len(),
                    });
                }
                let values = pdu[6..]
                    .as_chunks::<2>()
                    .0
                    .iter()
                    .map(|c| u16::from_be_bytes([c[0], c[1]]))
                    .collect();
                Ok(Self::WriteMultipleRegisters { start_address, values })
            }
            FunctionCode::ReportServerId => {
                check_exact_len(pdu, 1)?;
                Ok(Self::ReportServerId)
            }
            FunctionCode::MaskWriteRegister => {
                check_exact_len(pdu, 7)?;
                Ok(Self::MaskWriteRegister {
                    address: read_u16_be(pdu, 1)?,
                    and_mask: read_u16_be(pdu, 3)?,
                    or_mask: read_u16_be(pdu, 5)?,
                })
            }
            FunctionCode::ReadWriteMultipleRegisters => {
                if pdu.len() < 10 {
                    return Err(ProtocolError::FrameTooShort {
                        expected_min: 10,
                        actual: pdu.len(),
                    });
                }
                let read_start = read_u16_be(pdu, 1)?;
                let read_quantity = read_u16_be(pdu, 3)?;
                validate_reg_read_qty(read_quantity)?;
                let write_start = read_u16_be(pdu, 5)?;
                let write_quantity = read_u16_be(pdu, 7)? as usize;
                let byte_count = pdu[9] as usize;
                if write_quantity == 0 || write_quantity > 121 {
                    return Err(ProtocolError::InvalidQuantity {
                        min: 1,
                        max: 121,
                        actual: write_quantity,
                    });
                }
                if byte_count != write_quantity * 2 || pdu.len() != 10 + byte_count {
                    return Err(ProtocolError::LengthMismatch {
                        expected: 10 + byte_count,
                        actual: pdu.len(),
                    });
                }
                let write_values = pdu[10..]
                    .as_chunks::<2>()
                    .0
                    .iter()
                    .map(|c| u16::from_be_bytes([c[0], c[1]]))
                    .collect();
                Ok(Self::ReadWriteMultipleRegisters {
                    read_start,
                    read_quantity,
                    write_start,
                    write_values,
                })
            }
            FunctionCode::EncapsulatedInterfaceTransport => {
                check_exact_len(pdu, 4)?;
                if pdu[1] != 0x0E {
                    return Err(ProtocolError::MalformedPdu("unsupported MEI type (expected 0x0E)"));
                }
                Ok(Self::ReadDeviceIdentification {
                    read_device_id_code: pdu[2],
                    object_id: pdu[3],
                })
            }
        }
    }
}

impl ResponsePdu {
    /// Decodes a response PDU from bytes.
    /// `expected_bit_count` is used for FC01/FC02 to trim trailing padding bits in the last byte.
    pub fn decode(pdu: &[u8], expected_bit_count: Option<usize>) -> Result<Self, ProtocolError> {
        let &fc_byte = pdu.first().ok_or(ProtocolError::FrameTooShort {
            expected_min: 1,
            actual: 0,
        })?;

        if (fc_byte & 0x80) != 0 {
            check_exact_len(pdu, 2)?;
            return Ok(Self::Exception {
                function_code: fc_byte & 0x7F,
                exception: ExceptionCode::from_byte(pdu[1]),
            });
        }

        let fc = FunctionCode::from_byte(fc_byte)?;
        match fc {
            FunctionCode::ReadCoils | FunctionCode::ReadDiscreteInputs => {
                if pdu.len() < 2 {
                    return Err(ProtocolError::FrameTooShort {
                        expected_min: 2,
                        actual: pdu.len(),
                    });
                }
                let byte_count = pdu[1] as usize;
                if pdu.len() != 2 + byte_count {
                    return Err(ProtocolError::LengthMismatch {
                        expected: 2 + byte_count,
                        actual: pdu.len(),
                    });
                }
                let bit_count = expected_bit_count.unwrap_or(byte_count * 8);
                let bits = unpack_bits(&pdu[2..], bit_count)?;
                if fc == FunctionCode::ReadCoils {
                    Ok(Self::ReadCoils { coils: bits })
                } else {
                    Ok(Self::ReadDiscreteInputs { inputs: bits })
                }
            }
            FunctionCode::ReadHoldingRegisters
            | FunctionCode::ReadInputRegisters
            | FunctionCode::ReadWriteMultipleRegisters => {
                if pdu.len() < 2 {
                    return Err(ProtocolError::FrameTooShort {
                        expected_min: 2,
                        actual: pdu.len(),
                    });
                }
                let byte_count = pdu[1] as usize;
                if !byte_count.is_multiple_of(2) || pdu.len() != 2 + byte_count {
                    return Err(ProtocolError::LengthMismatch {
                        expected: 2 + byte_count,
                        actual: pdu.len(),
                    });
                }
                let regs = pdu[2..]
                    .as_chunks::<2>()
                    .0
                    .iter()
                    .map(|c| u16::from_be_bytes([c[0], c[1]]))
                    .collect();
                match fc {
                    FunctionCode::ReadHoldingRegisters => {
                        Ok(Self::ReadHoldingRegisters { registers: regs })
                    }
                    FunctionCode::ReadInputRegisters => {
                        Ok(Self::ReadInputRegisters { registers: regs })
                    }
                    _ => Ok(Self::ReadWriteMultipleRegisters { registers: regs }),
                }
            }
            FunctionCode::WriteSingleCoil => {
                check_exact_len(pdu, 5)?;
                let address = read_u16_be(pdu, 1)?;
                let raw = read_u16_be(pdu, 3)?;
                let value = match raw {
                    0xFF00 => true,
                    0x0000 => false,
                    _ => return Err(ProtocolError::InvalidDataValue),
                };
                Ok(Self::WriteSingleCoil { address, value })
            }
            FunctionCode::WriteSingleRegister => {
                check_exact_len(pdu, 5)?;
                Ok(Self::WriteSingleRegister {
                    address: read_u16_be(pdu, 1)?,
                    value: read_u16_be(pdu, 3)?,
                })
            }
            FunctionCode::ReadExceptionStatus => {
                check_exact_len(pdu, 2)?;
                Ok(Self::ReadExceptionStatus { status: pdu[1] })
            }
            FunctionCode::Diagnostics => {
                if pdu.len() < 5 || !(pdu.len() - 3).is_multiple_of(2) {
                    return Err(ProtocolError::MalformedPdu("invalid diagnostics response length"));
                }
                let sub_function = read_u16_be(pdu, 1)?;
                let data = pdu[3..]
                    .as_chunks::<2>()
                    .0
                    .iter()
                    .map(|c| u16::from_be_bytes([c[0], c[1]]))
                    .collect();
                Ok(Self::Diagnostics { sub_function, data })
            }
            FunctionCode::WriteMultipleCoils => {
                check_exact_len(pdu, 5)?;
                Ok(Self::WriteMultipleCoils {
                    start_address: read_u16_be(pdu, 1)?,
                    quantity: read_u16_be(pdu, 3)?,
                })
            }
            FunctionCode::WriteMultipleRegisters => {
                check_exact_len(pdu, 5)?;
                Ok(Self::WriteMultipleRegisters {
                    start_address: read_u16_be(pdu, 1)?,
                    quantity: read_u16_be(pdu, 3)?,
                })
            }
            FunctionCode::ReportServerId => {
                if pdu.len() < 2 {
                    return Err(ProtocolError::FrameTooShort {
                        expected_min: 2,
                        actual: pdu.len(),
                    });
                }
                let byte_count = pdu[1] as usize;
                if pdu.len() != 2 + byte_count {
                    return Err(ProtocolError::LengthMismatch {
                        expected: 2 + byte_count,
                        actual: pdu.len(),
                    });
                }
                Ok(Self::ReportServerId {
                    data: pdu[2..].to_vec(),
                })
            }
            FunctionCode::MaskWriteRegister => {
                check_exact_len(pdu, 7)?;
                Ok(Self::MaskWriteRegister {
                    address: read_u16_be(pdu, 1)?,
                    and_mask: read_u16_be(pdu, 3)?,
                    or_mask: read_u16_be(pdu, 5)?,
                })
            }
            FunctionCode::EncapsulatedInterfaceTransport => {
                if pdu.len() < 7 || pdu[1] != 0x0E {
                    return Err(ProtocolError::MalformedPdu("invalid Read Device Identification response"));
                }
                let read_device_id_code = pdu[2];
                let conformity_level = pdu[3];
                let more_follows = match pdu[4] {
                    0x00 => false,
                    0xFF => true,
                    _ => return Err(ProtocolError::MalformedPdu("invalid more_follows byte")),
                };
                let next_object_id = pdu[5];
                let num_objects = pdu[6] as usize;
                let mut offset = 7;
                let mut objects = Vec::with_capacity(num_objects);
                for _ in 0..num_objects {
                    if offset + 2 > pdu.len() {
                        return Err(ProtocolError::MalformedPdu("truncated device ID object header"));
                    }
                    let obj_id = pdu[offset];
                    let obj_len = pdu[offset + 1] as usize;
                    offset += 2;
                    if offset + obj_len > pdu.len() {
                        return Err(ProtocolError::MalformedPdu("truncated device ID object value"));
                    }
                    objects.push((obj_id, pdu[offset..offset + obj_len].to_vec()));
                    offset += obj_len;
                }
                if offset != pdu.len() {
                    return Err(ProtocolError::LengthMismatch {
                        expected: offset,
                        actual: pdu.len(),
                    });
                }
                Ok(Self::ReadDeviceIdentification {
                    read_device_id_code,
                    conformity_level,
                    more_follows,
                    next_object_id,
                    objects,
                })
            }
        }
    }
}

fn validate_bit_read_qty(quantity: u16) -> Result<(), ProtocolError> {
    if quantity == 0 || quantity > 2000 {
        return Err(ProtocolError::InvalidQuantity {
            min: 1,
            max: 2000,
            actual: quantity as usize,
        });
    }
    Ok(())
}

fn validate_reg_read_qty(quantity: u16) -> Result<(), ProtocolError> {
    if quantity == 0 || quantity > 125 {
        return Err(ProtocolError::InvalidQuantity {
            min: 1,
            max: 125,
            actual: quantity as usize,
        });
    }
    Ok(())
}

fn check_exact_len(pdu: &[u8], expected: usize) -> Result<(), ProtocolError> {
    if pdu.len() != expected {
        return Err(ProtocolError::LengthMismatch {
            expected,
            actual: pdu.len(),
        });
    }
    Ok(())
}
