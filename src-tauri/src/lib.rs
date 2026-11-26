pub mod commands;
pub mod poller;
pub mod protocol;
pub mod slave_sim;
pub mod transport;

use commands::AppState;
use poller::{PollStatsEvent, PollerHandle, SharedConnection};
use slave_sim::SlaveSimHandle;
use std::sync::Arc;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        connection: Arc::new(Mutex::new(SharedConnection {
            transport: None,
            target: None,
            transport_label: String::new(),
            stats: PollStatsEvent::default(),
        })),
        poller: Mutex::new(PollerHandle::new()),
        slave_sim: Mutex::new(SlaveSimHandle::new()),
    };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::get_serial_ports,
            commands::connect_tcp,
            commands::connect_rtu_over_tcp,
            commands::connect_udp,
            commands::connect_rtu,
            commands::connect_ascii,
            commands::disconnect,
            commands::start_poll,
            commands::stop_poll,
            commands::reset_stats,
            commands::write_single_register,
            commands::write_single_coil,
            commands::write_multiple_registers,
            commands::write_multiple_coils,
            commands::mask_write_register,
            commands::auto_discover_serial,
            commands::append_csv_log,
            commands::save_project,
            commands::load_project,
            commands::send_raw_hex,
            commands::scan_slave_ids,
            commands::set_sim_register,
            commands::set_sim_coil,
            commands::set_sim_faults,
            commands::asc_ai_chat,
            commands::asc_ai_health,
            commands::run_python_script,
            commands::start_slave_sim,
            commands::stop_slave_sim,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
