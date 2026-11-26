use serde::{Deserialize, Serialize};
use std::fmt;

/// Standard Modbus exception codes returned when bit 7 (0x80) of the function code is set.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ExceptionCode {
    IllegalFunction,
    IllegalDataAddress,
    IllegalDataValue,
    ServerDeviceFailure,
    Acknowledge,
    ServerDeviceBusy,
    MemoryParityError,
    GatewayPathUnavailable,
    GatewayTargetDeviceFailedToRespond,
    Unknown(u8),
}

impl ExceptionCode {
    pub fn from_byte(byte: u8) -> Self {
        match byte {
            0x01 => Self::IllegalFunction,
            0x02 => Self::IllegalDataAddress,
            0x03 => Self::IllegalDataValue,
            0x04 => Self::ServerDeviceFailure,
            0x05 => Self::Acknowledge,
            0x06 => Self::ServerDeviceBusy,
            0x08 => Self::MemoryParityError,
            0x0A => Self::GatewayPathUnavailable,
            0x0B => Self::GatewayTargetDeviceFailedToRespond,
            other => Self::Unknown(other),
        }
    }

    pub fn as_byte(self) -> u8 {
        match self {
            Self::IllegalFunction => 0x01,
            Self::IllegalDataAddress => 0x02,
            Self::IllegalDataValue => 0x03,
            Self::ServerDeviceFailure => 0x04,
            Self::Acknowledge => 0x05,
            Self::ServerDeviceBusy => 0x06,
            Self::MemoryParityError => 0x08,
            Self::GatewayPathUnavailable => 0x0A,
            Self::GatewayTargetDeviceFailedToRespond => 0x0B,
            Self::Unknown(b) => b,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Self::IllegalFunction => "Illegal Function",
            Self::IllegalDataAddress => "Illegal Data Address",
            Self::IllegalDataValue => "Illegal Data Value",
            Self::ServerDeviceFailure => "Server Device Failure",
            Self::Acknowledge => "Acknowledge",
            Self::ServerDeviceBusy => "Server Device Busy",
            Self::MemoryParityError => "Memory Parity Error",
            Self::GatewayPathUnavailable => "Gateway Path Unavailable",
            Self::GatewayTargetDeviceFailedToRespond => "Gateway Target Device Failed to Respond",
            Self::Unknown(_) => "Unknown Exception",
        }
    }

    pub fn description(self) -> &'static str {
        match self {
            Self::IllegalFunction => "Function code is not supported by the server/slave.",
            Self::IllegalDataAddress => "Data address is not valid or out of range on the server.",
            Self::IllegalDataValue => "Value in the query data field is not allowable.",
            Self::ServerDeviceFailure => "Unrecoverable error occurred while the server attempted the action.",
            Self::Acknowledge => "Server accepted the request and is processing it (long duration).",
            Self::ServerDeviceBusy => "Server is engaged in processing a long-duration command.",
            Self::MemoryParityError => "Extended file area failed a consistency check.",
            Self::GatewayPathUnavailable => "Gateway could not allocate an internal communication path.",
            Self::GatewayTargetDeviceFailedToRespond => "No response was obtained from the target device.",
            Self::Unknown(_) => "Vendor-specific or undefined Modbus exception code.",
        }
    }
}

impl fmt::Display for ExceptionCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "0x{:02X} ({})", self.as_byte(), self.name())
    }
}
