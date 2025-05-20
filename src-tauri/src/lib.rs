// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You\'ve been greeted from Rust!", name)
}

// 新增: 处理视频路径的命令
#[tauri::command]
async fn process_video(path: String) -> Result<String, String> {
    println!("Backend received video path: {}", path);
    // 在这里，我们稍后会加入 ffmpeg 的处理逻辑
    // 目前仅返回一个成功信息
    Ok(format!("路径 {} 已成功接收，待处理！", path))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![greet, process_video])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
