# anim-sprite-editor

## 项目描述

`anim-sprite-editor` 是一个桌面应用程序，旨在帮助用户将短视频（特别是 AI 生成的 4-10 秒视频）高效地转换为适用于游戏引擎（如 Godot）的精灵图或序列帧。本工具提供视频导入、可配置抽帧、帧预览、以及后续可能的图像编辑和多种导出选项，以简化从视频素材到可用游戏动画资产的转换流程。

**当前状态**: 项目处于早期开发阶段。核心的视频导入 (MP4)、基于FPS的抽帧、视频预览、抽帧结果预览及动画播放功能已初步实现。

## 主要功能 (已实现)

- **视频导入**: 
    - 支持通过文件对话框选择 MP4 视频文件。
    - 内置视频播放器预览导入的视频。
- **项目管理**:
    - 用户可以为每次处理指定项目名称。
    - 提取的帧会保存到 `./projects/{项目名称}/` 目录下。
- **抽帧处理**:
    - 用户可以自定义抽帧的 FPS (Frames Per Second)。
    - 后端调用 FFmpeg 根据指定的 FPS 从视频中提取 PNG 序列帧。
- **帧预览与动画播放**:
    - 以网格形式展示所有提取出来的帧图片。
    - 提供"播放动画"功能，可以按设定的 FPS 预览生成的帧动画效果。

## 计划中的功能

- 批量图像处理 (如背景移除)。
- 导出为 PNG 序列帧 (目前仅保存到本地项目文件夹)。
- 导出为 Sprite Sheet (雪碧图/精灵表单)。
- 更完善的 UI/UX 和错误处理。
- 项目保存与加载。

## 技术栈

- **核心框架**: [Tauri (v2.0+)](https://tauri.app/) - 用于构建跨平台桌面应用。
- **前端**:
    - [Vue 3](https://vuejs.org/) - JavaScript 框架。
    - [Vite](https://vitejs.dev/) - 前端构建工具。
    - HTML, CSS, JavaScript (Vue SFC)
    - Tauri Plugins:
        - `@tauri-apps/plugin-dialog` - 用于文件选择对话框。
        - `@tauri-apps/api/core` - 用于核心 API 调用，如 `invoke` 和 `convertFileSrc`。
- **后端**: [Rust](https://www.rust-lang.org/) - Tauri 的核心逻辑和与系统交互的部分。
- **核心依赖**: [FFmpeg](https://ffmpeg.org/) - 用于视频处理，如抽帧 (需确保在系统 PATH 中)。

## 当前使用流程

1.  启动应用。
2.  在界面顶部输入"项目名称" (例如：`zombie_walk`)。
3.  在界面顶部设置期望的"FPS" (例如：`12`)。
4.  点击"导入视频"按钮，从文件对话框中选择一个 MP4 视频文件。
5.  选中的视频将在界面中部的播放器区域显示，并可播放预览。
6.  如果项目名称有效，视频导入后将自动触发后端进行抽帧处理。
7.  处理过程中会显示"正在处理..."等状态消息。
8.  处理完成后：
    -   会显示成功提取的帧数量。
    -   在状态消息下方会出现一个动画播放器区域，显示第一帧，并提供"播放动画"按钮 (以及动画所使用的FPS)。点击按钮可以预览动画效果。
    -   在最下方，会以网格形式展示所有提取出来的帧图片。
9.  用户可以修改 FPS 值，如果动画正在播放，播放速度会自动更新。

## 先决条件

在开始之前，请确保您的系统已安装以下依赖：

- [Node.js](https://nodejs.org/) (建议使用 LTS 版本)
- [Rust](https://www.rust-lang.org/tools/install)
- 根据 Tauri 文档，完成特定于您操作系统的环境配置 ([Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites) - 注意：链接可能指向 v1，请参考最新的 v2 文档进行配置)
- **FFmpeg**: 必须安装并在系统的 PATH 环境变量中，以便 Rust 后端可以调用它。

## 安装与启动

1.  **克隆仓库** (如果您是从 git 仓库获取):
    ```bash
    git clone <repository-url> # 替换为实际的仓库 URL
    cd anim-sprite-editor
    ```

2.  **安装依赖**:
    ```bash
    npm install
    ```

3.  **启动开发环境**:
    ```bash
    npm run tauri dev
    ```
    此命令将启动 Vite 前端开发服务器和 Tauri 后端，并自动打开应用程序窗口。

## 项目文件结构简述

- `src/`: Vue.js 前端代码。
    - `App.vue`: 主要的应用组件。
    - `main.js`: Vue 应用入口。
- `src-tauri/`: Rust 后端代码。
    - `src/lib.rs`:主要的 Rust 逻辑，包含 Tauri 命令。
    - `Cargo.toml`: Rust 项目依赖管理。
    - `tauri.conf.json`: Tauri 应用配置。
    - `icons/`: 应用图标。
    - `projects/`: (此目录在 `.gitignore` 中，用于存放运行时生成的帧文件，不会提交到git)
- `.gitignore`: 指定 Git忽略的文件和目录。
- `package.json`: Node.js 项目配置和依赖。
- `README.md`: 本文档。

## 推荐的 IDE 设置

- [VS Code](https://code.visualstudio.com/)
  - [Vue Language Features (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (注意：若同时安装了旧版 Vetur，建议禁用 Vetur)
  - [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
  - [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

---

_此 README 文档将随着项目进展持续更新。_
