mod commands;

use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("no main window");
            let emitter = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = emitter.emit("menu://close", ());
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_saves,
            commands::load_save,
            commands::write_save,
            commands::create_save,
            commands::save_dir,
            commands::exit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}