use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager; // 需要 app_handle 来解析路径
use image::{DynamicImage, GenericImageView, ImageFormat, imageops}; // <-- 添加 image 和 imageops
use serde::Deserialize; // <-- 添加 Deserialize

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You\'ve been greeted from Rust!", name)
}

#[tauri::command]
async fn get_src_tauri_projects_path(app: tauri::AppHandle) -> Result<String, String> {
    match app.path().resource_dir() { // resource_dir() 返回 Result<PathBuf, Error>
        Ok(resource_dir) => { // 匹配 Ok(...)
            // $APP (resource_dir) 在开发时通常是 src-tauri/target/debug/
            // 我们要向上两级 (到 src-tauri/) 然后再进入 projects/
            let projects_path = resource_dir.join("../../projects/");
            match dunce::canonicalize(&projects_path) {
                Ok(canonical_path) => canonical_path.to_str().map(|s| s.to_string()).ok_or_else(|| "Path is not valid UTF-8".to_string()),
                Err(e) => Err(format!("Failed to canonicalize src-tauri projects path ({}): {}", projects_path.display(), e.to_string()))
            }
        }
        Err(e_resolve) => Err(format!("Could not determine resource directory: {}", e_resolve.to_string())), // 匹配 Err(...)
    }
}

// 修改: 处理视频路径和项目名称的命令
#[tauri::command]
async fn process_video(path: String, project_name: String, fps: u32) -> Result<Vec<String>, String> {
    println!(
        "Backend received video path: {} for project: {}, fps: {}",
        path, project_name, fps
    );

    // 确保 target/release 或 target/debug 目录存在 (对于开发模式)
    // 在实际打包应用中，路径可能需要调整为应用数据目录
    let base_dir = determine_base_dir();
    let mut output_dir = base_dir;
    output_dir.push("projects");
    output_dir.push(&project_name);

    if let Err(e) = fs::create_dir_all(&output_dir) {
        let error_msg = format!("无法创建项目目录 '{}': {}", output_dir.display(), e);
        eprintln!("{}", error_msg);
        return Err(error_msg);
    }
    println!("项目目录 '{}' 已创建/确认存在。", output_dir.display());

    // 清理旧的帧文件 (如果存在)
    match fs::read_dir(&output_dir) {
        Ok(entries) => {
            for entry in entries {
                if let Ok(entry) = entry {
                    let file_path = entry.path();
                    if file_path.is_file() {
                        if let Some(extension) = file_path.extension() {
                            if extension == "png" {
                                if let Err(e) = fs::remove_file(&file_path) {
                                    eprintln!("无法删除旧帧文件 {:?}: {}", file_path, e);
                                    // 可以选择在这里返回错误，或者只是记录并继续
                                }
                            }
                        }
                    }
                }
            }
        }
        Err(e) => {
            // 如果读取目录失败，可能目录还不存在，或者没有权限等，暂时不视为严重错误
            eprintln!("读取项目目录进行清理时出错 (可能无大碍): {}", e);
        }
    }

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
        "准备执行 FFmpeg: 输入='{}', 输出模式='{}', FPS={}",
        path, output_pattern_str, fps
    );

    // 执行 FFmpeg 命令
    // ffmpeg -i "INPUT_VIDEO_PATH" -vf fps={USER_FPS} "OUTPUT_FRAMES_DIR/frame_%04d.png"
    let ffmpeg_status = Command::new("ffmpeg")
        .arg("-i")
        .arg(&path) // 输入文件路径
        .arg("-vf")
        .arg(format!("fps={}", fps)) // 使用用户指定的FPS
        .arg(output_pattern_str) // 输出文件模式
        .status(); // 执行命令并等待其完成，获取退出状态

    match ffmpeg_status {
        Ok(status) => {
            if status.success() {
                println!(
                    "FFmpeg 成功处理视频 '{}' 到项目 '{}'。帧已输出到 '{}'",
                    path,
                    project_name,
                    output_dir.display()
                );

                // 读取输出目录中的帧文件
                let mut frame_paths = Vec::new();
                match fs::read_dir(&output_dir) {
                    Ok(entries) => {
                        for entry in entries {
                            match entry {
                                Ok(e) => {
                                    let file_path = e.path();
                                    if file_path.is_file() { // 确保是文件
                                        if let Some(extension) = file_path.extension() {
                                            if extension == "png" { // 确保是png文件
                                                // 对于前端，我们需要一个可以通过 asset: 协议访问的路径
                                                // tauri::api::path::resolve_path 和 convertFileSrc 配合使用
                                                // 但这里我们先返回绝对路径，前端再转换
                                                if let Ok(absolute_path) = fs::canonicalize(&file_path) {
                                                    if let Some(path_str) = absolute_path.to_str() {
                                                        frame_paths.push(path_str.to_string());
                                                    } else {
                                                        eprintln!("无法将路径 {:?} 转换为字符串", absolute_path);
                                                    }
                                                } else {
                                                     eprintln!("无法获取绝对路径用于 {:?} (原始路径: {:?})", file_path, e.path());
                                                }
                                            }
                                        }
                                    }
                                }
                                Err(e_dir) => {
                                    let error_msg = format!(
                                        "读取目录 '{}' 中的条目失败: {}",
                                        output_dir.display(),
                                        e_dir
                                    );
                                    eprintln!("{}", error_msg);
                                    return Err(error_msg);
                                }
                            }
                        }
                        frame_paths.sort(); // 确保帧顺序
                        println!("成功收集到 {} 个帧文件。", frame_paths.len());
                        if frame_paths.is_empty() {
                            println!("警告: FFmpeg成功执行，但在输出目录 '{}' 未找到任何PNG帧文件。", output_dir.display());
                            // 可以选择返回错误或一个空列表，这里返回空列表，让前端处理
                        }
                        Ok(frame_paths)
                    }
                    Err(e) => {
                        let error_msg = format!(
                            "FFmpeg 处理成功，但读取输出目录 '{}' 失败: {}",
                            output_dir.display(),
                            e
                        );
                        eprintln!("{}", error_msg);
                        Err(error_msg)
                    }
                }
            } else {
                // 尝试读取ffmpeg的stderr输出以获取更详细的错误信息
                // let mut cmd = Command::new("ffmpeg")
                //     .arg("-i")
                //     .arg(&path)
                //     .arg("-vf")
                //     .arg(format!("fps={}", fps))
                //     .arg(output_pattern_str_for_error) // 需要重新获取，因为它被移动了
                //     .stderr(Stdio::piped()) // 捕获stderr
                //     .spawn()?;
                // let stderr_output = cmd.wait_with_output()?.stderr;
                // let stderr_string = String::from_utf8_lossy(&stderr_output);

                let error_msg = format!(
                    "FFmpeg 处理视频 '{}' 失败。退出码: {:?}. 查看控制台日志获取更多FFmpeg输出信息。",
                    path,
                    status.code(),
                    // stderr_string  // 包含具体的ffmpeg错误
                );
                eprintln!("{}", error_msg);
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

// 新增：用于接收裁剪参数的结构体
#[derive(Deserialize, Debug)]
struct CropRectParams {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
}

// 新增：应用裁剪到多个文件的Tauri命令
#[tauri::command]
async fn apply_crop_to_files(original_paths: Vec<String>, crop_params: CropRectParams) -> Result<String, String> {
    println!("Backend received crop_params: {:?}", crop_params);
    if crop_params.width == 0 || crop_params.height == 0 {
        return Err("Crop dimensions (width and height) cannot be zero.".to_string());
    }

    let mut successful_crops = 0;
    let total_files = original_paths.len();

    for img_path_str in original_paths {
        println!("Processing file: {}", img_path_str);
        let img_path = PathBuf::from(&img_path_str);

        // 检查路径是否以 \\?\ 开头，如果是，则移除它以便 image::open 能正确处理
        // image crate 可能无法直接处理带有 \\?\ 前缀的路径
        let path_to_open = if img_path_str.starts_with("\\\\?\\") {
            PathBuf::from(&img_path_str[4..])
        } else {
            img_path.clone()
        };
        
        println!("Attempting to open (cleaned path): {}", path_to_open.display());

        match image::open(&path_to_open) {
            Ok(mut img) => {
                let (original_width, original_height) = img.dimensions();
                println!("Original dimensions: {}x{}", original_width, original_height);

                // 边界检查
                if crop_params.x >= original_width || crop_params.y >= original_height {
                    let err_msg = format!(
                        "Crop X ({}) or Y ({}) is out of bounds for image {} ({}x{}).",
                        crop_params.x, crop_params.y, img_path_str, original_width, original_height
                    );
                    eprintln!("{}", err_msg);
                    // 选择是跳过这个文件还是整体失败。这里我们选择记录错误并跳过。
                    // 如果希望整体失败，可以 return Err(err_msg);
                    continue; 
                }

                let final_crop_width = if crop_params.x + crop_params.width > original_width {
                    original_width - crop_params.x
                } else {
                    crop_params.width
                };

                let final_crop_height = if crop_params.y + crop_params.height > original_height {
                    original_height - crop_params.y
                } else {
                    crop_params.height
                };
                
                if final_crop_width == 0 || final_crop_height == 0 {
                     let err_msg = format!(
                        "Calculated final crop width or height is zero for image {}. Skipping.",
                        img_path_str
                    );
                    eprintln!("{}", err_msg);
                    continue;
                }


                println!("Applying crop: x={}, y={}, width={}, height={}", crop_params.x, crop_params.y, final_crop_width, final_crop_height);

                let cropped_img = imageops::crop_imm(&mut img, crop_params.x, crop_params.y, final_crop_width, final_crop_height).to_image();
                
                // 保存回原始路径 (使用原始的 img_path，它可能包含 \\?\ 前缀，fs 操作可以处理它)
                // 注意：这里我们直接覆盖原文件
                match cropped_img.save(&img_path) {
                    Ok(_) => {
                        println!("Successfully cropped and saved {}", img_path.display());
                        successful_crops += 1;
                    }
                    Err(e) => {
                        let err_msg = format!("Failed to save cropped image {}: {}", img_path.display(), e);
                        eprintln!("{}", err_msg);
                        // 根据需要决定是否因为单个文件保存失败而整体失败
                        // return Err(err_msg); 
                    }
                }
            }
            Err(e) => {
                let err_msg = format!("Failed to open image {}: {}. Cleaned path used: {}", img_path_str, e, path_to_open.display());
                eprintln!("{}", err_msg);
                // return Err(err_msg); // 决定是否因单个文件打开失败而整体失败
            }
        }
    }

    if successful_crops == total_files && total_files > 0 {
        Ok(format!("Successfully cropped {} files.", successful_crops))
    } else if successful_crops > 0 {
        Ok(format!("Partially successful: cropped {} out of {} files. Check logs for errors.", successful_crops, total_files))
    } else if total_files == 0 {
        Ok("No files to crop.".to_string())
    }
    else {
        Err("Failed to crop any files. Check logs for errors.".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            process_video,
            get_src_tauri_projects_path,
            apply_crop_to_files // <-- 添加新的命令
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// 辅助函数，用于确定基础目录
// 在开发时，我们可能希望输出到 `src-tauri` 目录下，方便查看
// 在生产打包后，应该使用应用的数据目录
fn determine_base_dir() -> PathBuf {
    if cfg!(debug_assertions) {
        // 开发模式: 使用 src-tauri 目录 (即 crate manifest dir)
        // PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        // 为了简单起见，并与之前行为一致，暂时还用 "." (项目根目录/src-tauri的上级)
        // 然后在里面创建 projects 目录
        PathBuf::from(".")
    } else {
        // 生产模式: 理论上应该用 tauri::api::path::app_data_dir()
        // 但为了在开发和生产中路径一致性（特别是对于 asset: 协议），
        // 并且考虑到 .gitignore 已经忽略了 src-tauri/projects
        // 我们暂时在两种模式下都使用相对于项目根目录的 src-tauri/projects
        // 这意味着打包后，应用也会尝试在安装位置附近创建 src-tauri/projects
        // 这可能不是最佳实践，但为了演示，我们暂时这样处理。
        // 更好的做法是明确区分开发和生产环境的路径。
        // 对于Windows，app_data_dir 通常是 %APPDATA%\\<bundle_identifier>
        // e.g. tauri::api::path::app_data_dir(&tauri::Config::default()).unwrap_or_else(|| PathBuf::from("."))
        PathBuf::from(".") // 保持与之前一致，输出到 ./projects/
    }
}
