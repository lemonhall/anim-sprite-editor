use std::fs;
use std::path::PathBuf;
use std::process::Command;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You\'ve been greeted from Rust!", name)
}

// 修改: 处理视频路径和项目名称的命令
#[tauri::command]
async fn process_video(path: String, project_name: String) -> Result<String, String> {
    println!("Backend received video path: {} for project: {}", path, project_name);

    let mut output_dir = PathBuf::from(".");
    output_dir.push("projects");
    output_dir.push(&project_name);

    if let Err(e) = fs::create_dir_all(&output_dir) {
        let error_msg = format!("无法创建项目目录 '{}': {}", output_dir.display(), e);
        eprintln!("{}", error_msg);
        return Err(error_msg);
    }
    println!("项目目录 '{}' 已创建/确认存在。", output_dir.display());

    // 构建 FFmpeg 输出文件模式
    // 例如: ./projects/PROJECT_NAME/frame_%04d.png
    let output_pattern = output_dir.join("frame_%04d.png");
    let output_pattern_str = match output_pattern.to_str() {
        Some(s) => s,
        None => {
            let error_msg = "无法将输出路径转换为字符串".to_string();
            eprintln!("{}", error_msg);
            return Err(error_msg);
        }
    };

    println!(
        "准备执行 FFmpeg: 输入='{}', 输出模式='{}'",
        path,
        output_pattern_str
    );

    // 执行 FFmpeg 命令
    // ffmpeg -i "INPUT_VIDEO_PATH" -vf fps=10 "OUTPUT_FRAMES_DIR/frame_%04d.png"
    let ffmpeg_status = Command::new("ffmpeg")
        .arg("-i")
        .arg(&path) // 输入文件路径
        .arg("-vf")
        .arg("fps=10") // 每秒10帧
        .arg(output_pattern_str) // 输出文件模式
        .status(); // 执行命令并等待其完成，获取退出状态

    match ffmpeg_status {
        Ok(status) => {
            if status.success() {
                let success_msg = format!(
                    "FFmpeg 成功处理视频 '{}' 到项目 '{}'。帧已输出到 '{}'",
                    path,
                    project_name,
                    output_dir.display()
                );
                println!("{}", success_msg);
                Ok(success_msg)
            } else {
                let error_msg = format!(
                    "FFmpeg 处理视频 '{}' 失败。退出码: {:?}. 查看控制台日志获取更多FFmpeg输出信息。",
                    path,
                    status.code()
                );
                eprintln!("{}", error_msg);
                // 实际应用中，可能需要捕获 ffmpeg 的 stderr 输出以提供更详细错误
                Err(error_msg)
            }
        }
        Err(e) => {
            let error_msg = format!(
                "执行 FFmpeg 失败: {}. 请确保 FFmpeg 已安装并在系统的 PATH 环境变量中。",
                e
            );
            eprintln!("{}", error_msg);
            Err(error_msg)
        }
    }
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
