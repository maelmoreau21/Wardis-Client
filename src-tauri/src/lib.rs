// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;
use std::fs::{create_dir_all, File, read_to_string};
use std::io::Write;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn save_layout(app_handle: tauri::AppHandle, layout_json: String) -> Result<(), String> {
    let config_dir = app_handle.path().app_config_dir().map_err(|e| e.to_string())?;
    create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    let layout_path = config_dir.join("layout.json");
    let mut file = File::create(layout_path).map_err(|e| e.to_string())?;
    file.write_all(layout_json.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_layout(app_handle: tauri::AppHandle) -> Result<String, String> {
    let config_dir = app_handle.path().app_config_dir().map_err(|e| e.to_string())?;
    let layout_path = config_dir.join("layout.json");
    if !layout_path.exists() {
        return Ok("{}".to_string());
    }
    let content = read_to_string(layout_path).map_err(|e| e.to_string())?;
    Ok(content)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, save_layout, load_layout])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
