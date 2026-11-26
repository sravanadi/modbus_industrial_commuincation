use crate::protocol::exceptions::ExceptionCode;
use crate::protocol::frame::{decode_tcp, encode_tcp};
use crate::protocol::function_codes::{pack_bits, FunctionCode, RequestPdu};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

const MAP_SIZE: usize = 1024;

#[derive(Default, Clone)]
pub struct FaultConfig {
    pub delay_ms: u64,
    pub force_exception: Option<u8>,
    pub drop_response: bool,
}

#[derive(Default)]
pub struct SlaveMemory {
    pub coils: Vec<bool>,
    pub discrete_inputs: Vec<bool>,
    pub holding_regs: Vec<u16>,
    pub input_regs: Vec<u16>,
    pub faults: FaultConfig,
}

impl SlaveMemory {
    pub fn new() -> Self {
        Self {
            coils: vec![false; MAP_SIZE],
            discrete_inputs: vec![false; MAP_SIZE],
            holding_regs: vec![0u16; MAP_SIZE],
            input_regs: vec![0u16; MAP_SIZE],
            faults: FaultConfig::default(),
        }
    }
}

pub struct SlaveSimHandle {
    task: Option<JoinHandle<()>>,
    pub memory: Arc<Mutex<SlaveMemory>>,
}

impl Default for SlaveSimHandle {
    fn default() -> Self {
        Self::new()
    }
}

impl SlaveSimHandle {
    pub fn new() -> Self {
        Self {
            task: None,
            memory: Arc::new(Mutex::new(SlaveMemory::new())),
        }
    }

    pub fn stop(&mut self) {
        if let Some(t) = self.task.take() {
            t.abort();
        }
    }

    pub async fn start(&mut self, port: u16) -> Result<(), String> {
        self.stop();
        let listener = TcpListener::bind(("127.0.0.1", port))
            .await
            .map_err(|e| format!("Failed to bind 127.0.0.1:{port}: {e}"))?;
        let mem = self.memory.clone();

        self.task = Some(tokio::spawn(async move {
            while let Ok((stream, _)) = listener.accept().await {
                let client_mem = mem.clone();
                tokio::spawn(async move {
                    handle_client(stream, client_mem).await;
                });
            }
        }));
        Ok(())
    }
}

async fn handle_client(mut stream: TcpStream, mem: Arc<Mutex<SlaveMemory>>) {
    let mut header = [0u8; 6];
    while stream.read_exact(&mut header).await.is_ok() {
        let rem_len = u16::from_be_bytes([header[4], header[5]]) as usize;
        if rem_len == 0 || rem_len > 260 {
            break;
        }
        let mut rest = vec![0u8; rem_len];
        if stream.read_exact(&mut rest).await.is_err() {
            break;
        }
        let mut frame = Vec::with_capacity(6 + rem_len);
        frame.extend_from_slice(&header);
        frame.extend_from_slice(&rest);

        let Ok((mbap, pdu)) = decode_tcp(&frame) else {
            break;
        };

        let (delay_ms, force_exc, drop_resp) = {
            let m = mem.lock().await;
            (m.faults.delay_ms, m.faults.force_exception, m.faults.drop_response)
        };
        if delay_ms > 0 {
            tokio::time::sleep(Duration::from_millis(delay_ms)).await;
        }
        if drop_resp {
            continue;
        }

        let resp_pdu = if let Some(exc) = force_exc {
            exception_pdu(pdu.first().copied().unwrap_or(0), ExceptionCode::from_byte(exc))
        } else {
            process_pdu(pdu, &mem).await
        };

        if let Ok(reply) = encode_tcp(mbap.transaction_id, mbap.unit_id, &resp_pdu) {
            if stream.write_all(&reply).await.is_err() {
                break;
            }
        }
    }
}

fn exception_pdu(fc: u8, code: ExceptionCode) -> Vec<u8> {
    vec![fc | 0x80, code.as_byte()]
}

async fn process_pdu(pdu: &[u8], mem: &Arc<Mutex<SlaveMemory>>) -> Vec<u8> {
    let fc_byte = pdu.first().copied().unwrap_or(0);
    let Ok(req) = RequestPdu::decode(pdu) else {
        return exception_pdu(fc_byte, ExceptionCode::IllegalFunction);
    };

    let mut m = mem.lock().await;
    match req {
        RequestPdu::ReadCoils { start_address, quantity } => {
            let s = start_address as usize;
            let q = quantity as usize;
            if s + q > m.coils.len() {
                return exception_pdu(FunctionCode::ReadCoils.as_byte(), ExceptionCode::IllegalDataAddress);
            }
            let packed = pack_bits(&m.coils[s..s + q]);
            let mut out = vec![FunctionCode::ReadCoils.as_byte(), packed.len() as u8];
            out.extend_from_slice(&packed);
            out
        }
        RequestPdu::ReadDiscreteInputs { start_address, quantity } => {
            let s = start_address as usize;
            let q = quantity as usize;
            if s + q > m.discrete_inputs.len() {
                return exception_pdu(FunctionCode::ReadDiscreteInputs.as_byte(), ExceptionCode::IllegalDataAddress);
            }
            let packed = pack_bits(&m.discrete_inputs[s..s + q]);
            let mut out = vec![FunctionCode::ReadDiscreteInputs.as_byte(), packed.len() as u8];
            out.extend_from_slice(&packed);
            out
        }
        RequestPdu::ReadHoldingRegisters { start_address, quantity } => {
            let s = start_address as usize;
            let q = quantity as usize;
            if s + q > m.holding_regs.len() {
                return exception_pdu(FunctionCode::ReadHoldingRegisters.as_byte(), ExceptionCode::IllegalDataAddress);
            }
            let mut out = vec![FunctionCode::ReadHoldingRegisters.as_byte(), (q * 2) as u8];
            for &reg in &m.holding_regs[s..s + q] {
                out.extend_from_slice(&reg.to_be_bytes());
            }
            out
        }
        RequestPdu::ReadInputRegisters { start_address, quantity } => {
            let s = start_address as usize;
            let q = quantity as usize;
            if s + q > m.input_regs.len() {
                return exception_pdu(FunctionCode::ReadInputRegisters.as_byte(), ExceptionCode::IllegalDataAddress);
            }
            let mut out = vec![FunctionCode::ReadInputRegisters.as_byte(), (q * 2) as u8];
            for &reg in &m.input_regs[s..s + q] {
                out.extend_from_slice(&reg.to_be_bytes());
            }
            out
        }
        RequestPdu::WriteSingleCoil { address, value } => {
            let a = address as usize;
            if a >= m.coils.len() {
                return exception_pdu(FunctionCode::WriteSingleCoil.as_byte(), ExceptionCode::IllegalDataAddress);
            }
            m.coils[a] = value;
            pdu.to_vec()
        }
        RequestPdu::WriteSingleRegister { address, value } => {
            let a = address as usize;
            if a >= m.holding_regs.len() {
                return exception_pdu(FunctionCode::WriteSingleRegister.as_byte(), ExceptionCode::IllegalDataAddress);
            }
            m.holding_regs[a] = value;
            pdu.to_vec()
        }
        RequestPdu::WriteMultipleCoils { start_address, values } => {
            let s = start_address as usize;
            if s + values.len() > m.coils.len() {
                return exception_pdu(FunctionCode::WriteMultipleCoils.as_byte(), ExceptionCode::IllegalDataAddress);
            }
            m.coils[s..s + values.len()].copy_from_slice(&values);
            let mut out = vec![FunctionCode::WriteMultipleCoils.as_byte()];
            out.extend_from_slice(&start_address.to_be_bytes());
            out.extend_from_slice(&(values.len() as u16).to_be_bytes());
            out
        }
        RequestPdu::WriteMultipleRegisters { start_address, values } => {
            let s = start_address as usize;
            if s + values.len() > m.holding_regs.len() {
                return exception_pdu(FunctionCode::WriteMultipleRegisters.as_byte(), ExceptionCode::IllegalDataAddress);
            }
            m.holding_regs[s..s + values.len()].copy_from_slice(&values);
            let mut out = vec![FunctionCode::WriteMultipleRegisters.as_byte()];
            out.extend_from_slice(&start_address.to_be_bytes());
            out.extend_from_slice(&(values.len() as u16).to_be_bytes());
            out
        }
        _ => exception_pdu(fc_byte, ExceptionCode::IllegalFunction),
    }
}
