use modbus_studio_lib::protocol::{
    crc16::{crc16, verify_crc16},
    exceptions::ExceptionCode,
    frame::{
        decode_ascii, decode_rtu, decode_tcp, encode_ascii, encode_rtu, encode_tcp, MbapHeader,
        ProtocolError,
    },
    function_codes::{pack_bits, unpack_bits, RequestPdu, ResponsePdu},
    lrc::lrc,
};
use pretty_assertions::assert_eq;

#[test]
fn golden_crc16_rtu_read_holding_registers() {
    // Classic Modbus RTU frame: Slave 1, FC03, Start 0x0000, Qty 0x000A -> CRC 0xCDC5 (wire: C5 CD)
    let pdu = RequestPdu::ReadHoldingRegisters {
        start_address: 0x0000,
        quantity: 0x000A,
    }
    .encode()
    .unwrap();
    let frame = encode_rtu(0x01, &pdu).unwrap();
    assert_eq!(frame, vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xC5, 0xCD]);
    assert_eq!(crc16(&frame[..6]), 0xCDC5);

    let (unit_id, decoded_pdu) = decode_rtu(&frame).unwrap();
    assert_eq!(unit_id, 0x01);
    assert_eq!(decoded_pdu, pdu.as_slice());
}

#[test]
fn crc16_detects_single_bit_corruption() {
    let mut frame = vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xC5, 0xCD];
    frame[3] ^= 0x01;
    let err = verify_crc16(&frame).unwrap_err();
    assert!(matches!(err, ProtocolError::InvalidCrc { .. }));
}

#[test]
fn golden_lrc_ascii_frames() {
    // Slave 1, FC03, Start 0, Qty 1 -> sum = 0x05 -> LRC = 0xFB
    let pdu = RequestPdu::ReadHoldingRegisters {
        start_address: 0,
        quantity: 1,
    }
    .encode()
    .unwrap();
    let ascii = encode_ascii(0x01, &pdu).unwrap();
    assert_eq!(ascii, b":010300000001FB\r\n");

    let (unit_id, decoded_pdu) = decode_ascii(&ascii).unwrap();
    assert_eq!(unit_id, 0x01);
    assert_eq!(decoded_pdu, pdu);

    // Response example: Slave 1, FC03, 2 bytes [0x00, 0x0A] -> sum = 0x10 -> LRC = 0xF0
    assert_eq!(lrc(&[0x01, 0x03, 0x02, 0x00, 0x0A]), 0xF0);
    let (resp_uid, resp_pdu) = decode_ascii(b":010302000AF0\r\n").unwrap();
    assert_eq!(resp_uid, 0x01);
    assert_eq!(
        ResponsePdu::decode(&resp_pdu, None).unwrap(),
        ResponsePdu::ReadHoldingRegisters {
            registers: vec![10]
        }
    );
}

#[test]
fn golden_tcp_mbap_encode_decode() {
    let pdu = RequestPdu::ReadHoldingRegisters {
        start_address: 0,
        quantity: 10,
    }
    .encode()
    .unwrap();
    let frame = encode_tcp(0x0001, 0x01, &pdu).unwrap();
    assert_eq!(
        frame,
        vec![0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x01, 0x03, 0x00, 0x00, 0x00, 0x0A]
    );
    let (hdr, decoded_pdu) = decode_tcp(&frame).unwrap();
    assert_eq!(
        hdr,
        MbapHeader {
            transaction_id: 1,
            protocol_id: 0,
            length: 6,
            unit_id: 1
        }
    );
    assert_eq!(decoded_pdu, pdu.as_slice());
}

#[test]
fn bit_packing_and_unpacking() {
    let bits = vec![
        true, false, true, true, false, false, false, true, // 0b1000_1101 = 0x8D
        true, true, // 0b0000_0011 = 0x03
    ];
    let packed = pack_bits(&bits);
    assert_eq!(packed, vec![0x8D, 0x03]);
    assert_eq!(unpack_bits(&packed, bits.len()).unwrap(), bits);
}

#[test]
fn all_request_pdus_roundtrip() {
    let requests = vec![
        RequestPdu::ReadCoils {
            start_address: 10,
            quantity: 12,
        },
        RequestPdu::ReadDiscreteInputs {
            start_address: 100,
            quantity: 8,
        },
        RequestPdu::ReadHoldingRegisters {
            start_address: 4000,
            quantity: 16,
        },
        RequestPdu::ReadInputRegisters {
            start_address: 0,
            quantity: 4,
        },
        RequestPdu::WriteSingleCoil {
            address: 5,
            value: true,
        },
        RequestPdu::WriteSingleRegister {
            address: 42,
            value: 0x1234,
        },
        RequestPdu::ReadExceptionStatus,
        RequestPdu::Diagnostics {
            sub_function: 0x0000,
            data: vec![0xA537],
        },
        RequestPdu::WriteMultipleCoils {
            start_address: 19,
            values: vec![true, false, true, true, false, false, true, true, true, false],
        },
        RequestPdu::WriteMultipleRegisters {
            start_address: 1,
            values: vec![0x000A, 0x0102],
        },
        RequestPdu::ReportServerId,
        RequestPdu::MaskWriteRegister {
            address: 4,
            and_mask: 0x00F2,
            or_mask: 0x0025,
        },
        RequestPdu::ReadWriteMultipleRegisters {
            read_start: 3,
            read_quantity: 6,
            write_start: 14,
            write_values: vec![0x00FF, 0x00FF, 0x00FF],
        },
        RequestPdu::ReadDeviceIdentification {
            read_device_id_code: 0x01,
            object_id: 0x00,
        },
    ];

    for req in requests {
        let encoded = req.encode().unwrap();
        let decoded = RequestPdu::decode(&encoded).unwrap();
        assert_eq!(decoded, req);
    }
}

#[test]
fn response_pdu_decode_and_exceptions() {
    // FC01 Read Coils response (10 coils: 0xCD, 0x01)
    let fc01 = ResponsePdu::decode(&[0x01, 0x02, 0xCD, 0x01], Some(10)).unwrap();
    assert_eq!(
        fc01,
        ResponsePdu::ReadCoils {
            coils: vec![true, false, true, true, false, false, true, true, true, false]
        }
    );

    // FC05 Write Single Coil
    let fc05 = ResponsePdu::decode(&[0x05, 0x00, 0xAC, 0xFF, 0x00], None).unwrap();
    assert_eq!(
        fc05,
        ResponsePdu::WriteSingleCoil {
            address: 0x00AC,
            value: true
        }
    );

    // FC22 Mask Write Register
    let fc22 = ResponsePdu::decode(&[0x16, 0x00, 0x04, 0x00, 0xF2, 0x00, 0x25], None).unwrap();
    assert_eq!(
        fc22,
        ResponsePdu::MaskWriteRegister {
            address: 4,
            and_mask: 0x00F2,
            or_mask: 0x0025
        }
    );

    // FC43 Read Device Identification
    let fc43 = ResponsePdu::decode(
        &[
            0x2B, 0x0E, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x03, b'A', b'C', b'M',
        ],
        None,
    )
    .unwrap();
    assert_eq!(
        fc43,
        ResponsePdu::ReadDeviceIdentification {
            read_device_id_code: 1,
            conformity_level: 1,
            more_follows: false,
            next_object_id: 0,
            objects: vec![(0, b"ACM".to_vec())],
        }
    );

    // Exception 0x02 Illegal Data Address on FC03
    let exc = ResponsePdu::decode(&[0x83, 0x02], None).unwrap();
    assert_eq!(
        exc,
        ResponsePdu::Exception {
            function_code: 0x03,
            exception: ExceptionCode::IllegalDataAddress,
        }
    );
}

#[test]
fn malformed_frames_never_panic() {
    assert!(decode_rtu(&[]).is_err());
    assert!(decode_rtu(&[0x01, 0x03]).is_err());
    assert!(decode_ascii(b"").is_err());
    assert!(decode_ascii(b":0103\r\n").is_err());
    assert!(decode_ascii(b":ZZ0300000001FB\r\n").is_err());
    assert!(decode_tcp(&[0x00, 0x01, 0x00, 0x01, 0x00, 0x02, 0x01, 0x03]).is_err());
    assert!(ResponsePdu::decode(&[], None).is_err());
    assert!(ResponsePdu::decode(&[0x03, 0x04, 0x00], None).is_err());
    assert!(RequestPdu::decode(&[0x03, 0x00, 0x00, 0x00, 0x00]).is_err());
}
