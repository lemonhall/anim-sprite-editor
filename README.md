# anim-sprite-editor

## 项目描述

`anim-sprite-editor` 是一个桌面应用程序，旨在帮助用户将短视频（特别是 AI 生成的 4-10 秒视频）高效地转换为适用于游戏引擎（如 Godot）的精灵图或序列帧。本工具提供视频导入、可配置抽帧、帧预览、简单的图像编辑（如背景移除）以及多种导出选项，以简化从视频素材到可用游戏动画资产的转换流程。

## 主要功能

- **视频导入**: 支持导入常见的视频格式。
- **抽帧选项**: 用户可以自定义抽帧率等参数。
- **视频与帧预览**:
    - 播放原始导入的视频。
    - 播放抽帧后生成的帧序列。
- **图像处理**:
    - 提供工具批量移除帧图像的背景色。
    - (未来可能支持更多批量编辑功能)
- **导出格式**:
    - PNG 序列帧。
    - (未来可能支持其他 sprite sheet 格式)

## 技术栈

- **核心框架**: [Tauri (v2.0+)](https://tauri.app/) - 用于构建跨平台桌面应用。
- **前端**:
    - [Vue 3](https://vuejs.org/) - JavaScript 框架。
    - [Vite](https://vitejs.dev/) - 前端构建工具。
    - HTML, CSS, TypeScript
- **后端**: [Rust](https://www.rust-lang.org/) - Tauri 的核心逻辑和与系统交互的部分。
- **核心依赖**: [FFmpeg](https://ffmpeg.org/) - 用于视频处理，如抽帧。

## 先决条件

在开始之前，请确保您的系统已安装以下依赖：

- [Node.js](https://nodejs.org/) (建议使用 LTS 版本)
- [Rust](https://www.rust-lang.org/tools/install)
- 根据 Tauri 文档，完成特定于您操作系统的环境配置 ([Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites) - 注意：链接可能指向 v1，请参考最新的 v2 文档进行配置)
- FFmpeg (需要确保 FFmpeg 可执行文件在系统的 PATH 中，或者后续我们会将其打包进应用)

## 安装与启动

1.  **克隆仓库** (如果您是从 git 仓库获取):
    ```bash
    git clone <repository-url>
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

## 推荐的 IDE 设置

- [VS Code](https://code.visualstudio.com/)
  - [Volar (Vue Tooling)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
  - [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
  - [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## (未来规划)

- [ ] 更完善的 Sprite Sheet 导出选项。
- [ ] 更多高级图像编辑功能。
- [ ] 撤销/重做功能。
- [ ] 项目保存与加载。

---

_此 README 文档由 AI 辅助生成并会持续更新。_
