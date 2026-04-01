// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::api::process::{Command, CommandChild, CommandEvent};
use tauri::{Manager, RunEvent, State};
use std::sync::{Arc, Mutex};

struct SidecarState {
    port: Arc<Mutex<Option<u16>>>,
    child: Arc<Mutex<Option<CommandChild>>>,
    pid: Arc<Mutex<Option<u32>>>,
}

#[tauri::command]
fn get_sidecar_port(state: State<SidecarState>) -> Option<u16> {
    *state.port.lock().unwrap()
}

fn main() {
    // DEV MODE: If SIDECAR_PORT is set, skip spawning the caxa binary entirely.
    // tauri-dev.sh starts `node dist/server.js` directly — no .exe, no Defender scan.
    let pre_started_port: Option<u16> = std::env::var("SIDECAR_PORT")
        .ok()
        .and_then(|s| s.trim().parse().ok());

    if let Some(port) = pre_started_port {
        println!("[tauri] using pre-started sidecar on port {} (dev mode)", port);
    }

    let app = tauri::Builder::default()
        .manage(SidecarState {
            port: Arc::new(Mutex::new(pre_started_port)),
            child: Arc::new(Mutex::new(None)),
            pid: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![get_sidecar_port])
        .setup(move |app| {
            // If sidecar was pre-started externally, just emit the port — no spawn needed
            if let Some(port) = pre_started_port {
                let _ = app.emit_all("sidecar-port", port);
                return Ok(());
            }

            // Production path: spawn the bundled caxa binary
            let (mut rx, child) = Command::new_sidecar("sidecar")
                .expect("failed to create sidecar command")
                .spawn()
                .expect("failed to spawn sidecar");

            let sidecar_state = app.state::<SidecarState>();
            // Store child handle + PID for cleanup on app close (PTY-06)
            *sidecar_state.pid.lock().unwrap() = Some(child.pid());
            *sidecar_state.child.lock().unwrap() = Some(child);

            let port_mutex = Arc::clone(&sidecar_state.port);
            let app_handle = app.handle();

            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            if let Some(port_str) = line.strip_prefix("PORT:") {
                                if let Ok(port) = port_str.trim().parse::<u16>() {
                                    *port_mutex.lock().unwrap() = Some(port);
                                    let _ = app_handle.emit_all("sidecar-port", port);
                                    println!("[tauri] sidecar port: {}", port);
                                }
                            }
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[sidecar stderr] {}", line);
                        }
                        CommandEvent::Error(err) => {
                            eprintln!("[sidecar error] {}", err);
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building tauri application");

    let sidecar_state = app.state::<SidecarState>();
    let child_arc = Arc::clone(&sidecar_state.child);
    let pid_arc = Arc::clone(&sidecar_state.pid);

    app.run(move |_app_handle, event| {
        if let RunEvent::Exit = event {
            println!("[tauri] app exiting — cleaning up");
            // Delete discovery file BEFORE force-killing sidecar (CAPI-04)
            // taskkill /T /F is TerminateProcess — Node.js exit handlers never fire
            if let Some(appdata) = std::env::var_os("APPDATA") {
                let discovery_file = std::path::PathBuf::from(appdata)
                    .join("chat-overlay-widget")
                    .join("api.port");
                match std::fs::remove_file(&discovery_file) {
                    Ok(()) => println!("[tauri] deleted discovery file: {}", discovery_file.display()),
                    Err(e) => println!("[tauri] discovery file cleanup: {} ({})", discovery_file.display(), e),
                }
            }
            // Use taskkill /T to kill the entire process tree (sidecar.exe + grandchild node.exe)
            // CommandChild::kill() only kills the direct child, leaving the caxa-spawned node.exe orphaned
            if let Some(pid) = pid_arc.lock().unwrap().take() {
                let _ = std::process::Command::new("taskkill")
                    .args(["/T", "/F", "/PID", &pid.to_string()])
                    .output();
                println!("[tauri] taskkill /T /F /PID {} sent", pid);
            }
            // Also call child.kill() as a fallback
            if let Some(child) = child_arc.lock().unwrap().take() {
                let _ = child.kill();
            }
        }
    });
}
