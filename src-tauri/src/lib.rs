#[tauri::command]
fn get_printers() -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if let Ok(output) = Command::new("powershell")
            .args(["-Command", "Get-Printer | Select-Object -ExpandProperty Name"])
            .output()
        {
            return String::from_utf8_lossy(&output.stdout)
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
        }
    }
    vec![]
}

#[tauri::command]
async fn print_receipt(_content: String, _printer_name: Option<String>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let printer_cmd = _printer_name
            .map(|n| format!("$pd.PrinterSettings.PrinterName = '{}'; ", n))
            .unwrap_or_default();
        let _ = _content;
        let _ = printer_cmd;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Kamera tarayıcı yalnız mobilde (Android/iOS) kayıtlı.
            #[cfg(mobile)]
            app.handle().plugin(tauri_plugin_barcode_scanner::init())?;
            // Otomatik güncelleme + yeniden başlatma yalnız masaüstünde (Windows EXE/MSI).
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_printers, print_receipt])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
