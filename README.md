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

## 项目文件结构与核心组件职责

### 整体结构

- **`public/`**: 存放静态资源，例如在 `index.html` 中直接引用的内容。
- **`src/`**: Vue.js 前端应用的核心代码。
    - **`assets/`**: 存放前端代码中引用的静态资源，如图片、字体等 (如果需要)。
    - **`components/`**: 存放 Vue 单文件组件 (SFCs)。
        - `App.vue`: 应用的主组件，负责整体布局、路由（如果将来引入）、以及核心状态管理或传递。
        - `ProjectSetupAndImport.vue`: 负责项目名称输入、FPS 设置、视频导入和初步的抽帧触发。
        - `FrameDisplay.vue`: 负责展示提取出来的帧序列，并提供动画播放功能。
        - `FrameEditor.vue`: (详细职责见下文) 核心的帧编辑组件，包含画布、工具选择和编辑操作。
    - **`composables/`**: 存放 Vue 3 的可组合函数 (Composition API)，用于封装和复用有状态逻辑。
        - `useGlobalImageOperations.js`: (详细职责见下文) 封装全局图像操作逻辑，如对所有帧应用裁剪。
        - `useFrameCropper.js`: (详细职责见下文) 封装帧的裁剪逻辑。
        - `useMagicWand.js`: (详细职责见下文) 封装魔术棒工具（背景移除）逻辑。
    - `main.js`: Vue 应用的入口文件，初始化 Vue 实例并挂载到 DOM。
    - `utils/` (建议): 将来可以创建此目录存放通用的辅助函数，例如 FFmpeg 路径检查、文件系统交互等。
- **`src-tauri/`**: Rust 后端代码，处理与操作系统交互、文件系统操作、以及执行如 FFmpeg 等外部命令。
    - `src/main.rs` (或 `lib.rs`): 主要的 Rust 逻辑，包含 Tauri 命令定义 (`#[tauri::command]`)。
    - `Cargo.toml`: Rust 项目的依赖配置文件。
    - `tauri.conf.json`: Tauri 应用的配置文件，包括窗口设置、权限、插件等。
    - `icons/`: 应用的图标文件。
    - `projects/`: (此目录在 `.gitignore` 中) 运行时由应用创建，用于存放用户项目（如提取的帧图片）。
- **`.github/workflows/`** (如果使用 GitHub Actions): CI/CD 配置文件。
- **`.gitignore`**: 指定 Git 在提交时应忽略的文件和目录。
- **`index.html`**: Web 应用的入口 HTML 文件。
- **`package.json`**: Node.js 项目元数据和依赖管理文件 (npm/yarn/pnpm)。
- **`README.md`**: (本文档) 项目介绍、设置指南、开发文档等。
- **`vite.config.js`**: Vite 构建工具的配置文件。

### 核心组件与可组合函数职责

1.  **`src/components/FrameEditor.vue`**:
    *   **职责**: 提供单帧图像的编辑界面和交互逻辑。
    *   **主要功能**:
        *   加载并显示待编辑的帧图像到 HTML5 Canvas 上。
        *   管理当前激活的编辑工具（如裁剪工具、魔术棒工具）。
        *   根据激活的工具，将画布上的鼠标事件（点击、移动、释放）分发给相应的可组合函数处理。
        *   调用可组合函数提供的激活/停用方法来切换工具状态和更新UI（如光标）。
        *   提供工具相关的控制UI（如魔术棒的容差滑块）。
        *   处理编辑结果的保存（更新当前帧）或取消。
        *   调用全局操作（如"应用裁剪到所有帧"）。
        *   在魔术棒等工具修改画布后，负责将画布内容更新为新的基础图像 (`originalImageForCropping`)，以便后续操作基于此修改。

2.  **`src/composables/useFrameCropper.js`**:
    *   **职责**: 封装帧图像的裁剪逻辑。
    *   **主要功能**:
        *   管理裁剪框的状态（位置 `x`, `y`, 大小 `size`, 是否正在选择 `isSelecting`, 是否有有效选区 `hasSelection`）。
        *   提供处理画布鼠标事件的方法 (`handleMouseDown`, `handleMouseMove`, `handleMouseUpOrLeave`) 来创建和调整裁剪框。
        *   计算鼠标在画布上的精确位置。
        *   提供 `drawCropSelection` 方法，在给定的 CanvasRenderingContext2D 上绘制裁剪框的视觉反馈（虚线框）。
        *   提供 `resetCrop` 方法来清除当前的裁剪选区。
        *   提供 `activate` 和 `deactivate` 方法来控制该工具是否响应事件及设置画布光标。
        *   通过回调函数通知父组件 (`FrameEditor.vue`) 需要重绘画布以更新裁剪框显示。
        *   监听原始图像变化，并在图像变化时重置裁剪状态。

3.  **`src/composables/useMagicWand.js`**:
    *   **职责**: 封装魔术棒工具的逻辑，用于基于颜色容差选择并清除区域（例如移除背景）。
    *   **主要功能**:
        *   管理工具激活状态 (`isToolActive`) 和颜色容差 (`tolerance`)。
        *   提供 `activate` 和 `deactivate` 方法控制工具状态和画布光标。
        *   核心 `execute(startX, startY)` 方法：
            *   获取画布指定点的颜色作为目标颜色。
            *   使用 `getImageData` 获取画布像素数据。
            *   通过广度优先搜索 (BFS) 或类似算法遍历相邻像素。
            *   对颜色与目标颜色相似（在指定容差内）的像素，将其透明度 (alpha通道) 设置为 0。
            *   使用 `putImageData` 将修改后的像素数据写回画布。
            *   通过回调函数通知 `FrameEditor.vue` 画布内容已更改，需要更新其基础图像。
        *   提供 `setTolerance` 方法来调整颜色匹配的容差。
        *   包含颜色比较的辅助函数 (例如基于曼哈顿距离)。

4.  **`src/composables/useGlobalImageOperations.js`**:
    *   **职责**: 封装应用于项目中所有（或多个）帧的批量图像处理操作。
    *   **主要功能**:
        *   当前主要实现 `applyGlobalCrop`：
            *   接收裁剪参数 (`x`, `y`, `width`, `height`)。
            *   接收项目所有原始帧的文件路径列表和提取帧的 (可能是 `asset://`) URL 列表。
            *   调用 Tauri 后端命令 (例如 `apply_crop_to_files`)，传递裁剪参数和文件路径给 Rust 端。
            *   Rust 端负责使用这些参数对每个原始图像文件执行裁剪操作（可能通过 FFmpeg 或图像处理库），并覆盖原文件或保存到新位置。
        *   管理操作过程中的加载状态 (`isProcessingGlobal`)。
        *   通过 `updateAppProcessingMessage` 回调更新应用级别的状态消息。

### 数据流与状态管理 (简化)

- **用户交互**: 主要发生在 `ProjectSetupAndImport.vue` (项目设置和导入) 和 `FrameEditor.vue` (帧编辑)。
- **核心数据**:
    - 原始视频文件路径: 由用户通过文件对话框选择。
    - 项目名称、FPS: 用户输入。
    - 提取的帧列表 (`extractedFrames`): 由 `App.vue` 管理，在抽帧或全局操作后更新。这些通常是 `asset://` 协议的 URL，由 Tauri 的 `convertFileSrc` 生成，用于在前端显示本地文件。
    - 原始帧文件路径列表 (`projectOriginalFramePaths`): 由 `App.vue` 管理，传递给需要直接操作文件的可组合函数 (如 `useGlobalImageOperations`)。
    - 当前编辑的帧 (`frameToEdit`): 由 `App.vue` 传递给 `FrameEditor.vue`。
- **状态更新与通信**:
    - **Props**: 父组件向子组件传递数据和回调函数。
    - **Emits**: 子组件向父组件发送事件以通知状态变化或请求操作。
    - **Composables**: 封装特定功能的逻辑和状态，供组件注入和使用。可组合函数内部通常使用 `ref` 和 `reactive` 创建响应式状态，并通过返回函数来暴露操作。
    - **Tauri Commands (`invoke`)**: 前端 Vue 组件/可组合函数调用 Rust 后端函数，执行文件操作、系统调用等。

## 推荐的 IDE 设置

- [VS Code](https://code.visualstudio.com/)
  - [Vue Language Features (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (注意：若同时安装了旧版 Vetur，建议禁用 Vetur)
  - [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
  - [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Development Log & Troubleshooting

This section outlines some of the key development challenges encountered and their resolutions.

### Issue: Global Crop Applied but UI Not Updating (or Partially Updating)

**Symptoms:**

*   After applying a global crop operation, backend successfully modified image files on disk.
*   Initially, the UI (frame thumbnails and animator) would not update to show the cropped images, or only the first frame would update, or all frames would show a 500 error after attempting a refresh.
*   Console logs might show that the backend command `apply_crop_to_files` reports success.

**Root Causes Identified & Solutions:**

1.  **Incorrect Prop Handling in Composables:**
    *   **Problem:** When passing a `ref` (e.g., `originalFrameFilePaths` which is a `ref` to an array of strings) as a prop from `App.vue` to `FrameEditor.vue`, and then from `FrameEditor.vue` into the `useGlobalImageOperations.js` composable, the composable was receiving the unwrapped array directly, not the ref object itself. Attempts to access `originalFilePathsArray.value` inside the composable would then result in `undefined` because `originalFilePathsArray` was already the array.
    *   **Solution:** Modified `useGlobalImageOperations.js` to directly use the passed array (e.g., `originalFilePathsArray.length`, `originalFilePathsArray.map(...)`) instead of trying to access its `.value` property.

2.  **Type Mismatch for Backend Command Parameters:**
    *   **Problem:** The Rust backend command `apply_crop_to_files` expected its `CropRectParams { x, y, width, height }` to have `u32` (unsigned 32-bit integer) values. The frontend, however, was deriving these values from canvas interactions, which resulted in floating-point numbers.
    *   **Solution:** In `useGlobalImageOperations.js`, before invoking the `apply_crop_to_files` command, each field of the `cropParams` object (`x`, `y`, `width`, `height`) was explicitly converted to an integer using `Math.round()`.

3.  **Incorrect Event Emission and Handling for UI Updates (Most Critical):**
    *   **Problem:** The primary issue preventing UI updates after a successful global crop was that the component responsible for initiating the crop (`FrameEditor.vue`) was not correctly signaling the main `App.vue` component to refresh its list of displayed frames (`extractedFrames`). `App.vue` was incorrectly listening for an update event from a different component (`ProjectSetupAndImport.vue`).
    *   **Solution:**
        *   Ensured `FrameEditor.vue`, upon successful completion of the `applyGlobalCrop` operation (invoked from `useGlobalImageOperations.js`), emits a specific event: `emit('frames-source-files-updated')`.
        *   Modified `App.vue`'s template to listen for this `frames-source-files-updated` event specifically on the `<FrameEditor>` component instance: `<FrameEditor @frames-source-files-updated="handleSourceFilesUpdatedFromEditor" ... />`.
        *   Implemented the `handleSourceFilesUpdatedFromEditor` method in `App.vue`.

4.  **Forcing Cache Busting and Vue Reactivity for Image Updates:**
    *   **Problem:** Even if the event was correctly handled, browsers (and potentially Tauri's asset protocol) might cache the images. Simply assigning the same URLs to `extractedFrames` might not trigger a visual update if the URLs haven't changed.
    *   **Solution (within `handleSourceFilesUpdatedFromEditor` in `App.vue`):
        1.  **Timestamping URLs:** When regenerating the `extractedFrames` list, each `asset://` URL (obtained via `convertFileSrc(filePath)`) has a unique timestamp appended as a query parameter (e.g., `asset://path/to/image.png?v=1678886400000`). This forces the browser/webview to treat it as a new resource.
        2.  **Vue Reactivity:** To ensure Vue detects the change and re-renders the list:
            *   The `extractedFrames.value` array is first set to an empty array (`[]`).
            *   `await nextTick()` is used to wait for the DOM to reflect this cleared state.
            *   Then, `extractedFrames.value` is assigned the new array of timestamped URLs.
            This pattern helps in robustly triggering list updates in Vue 3.

By addressing these points, particularly the event flow and cache-busting techniques, the global crop operation now correctly updates all displayed frames in the UI.

---

_此 README 文档将随着项目进展持续更新。_
