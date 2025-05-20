<script setup>
import { ref } from "vue"; // Watch is no longer needed here for project name/fps changes for auto-processing
import { invoke } from "@tauri-apps/api/core"; // convertFileSrc is now in the child component

// 导入子组件
import FrameAnimator from './components/FrameAnimator.vue';
import FrameThumbnailsGrid from './components/FrameThumbnailsGrid.vue';
import ProjectSetupAndImport from './components/ProjectSetupAndImport.vue';

// App.vue 现在主要管理处理后的结果和整体状态
const extractedFrames = ref([]);
const processingMessage = ref("");
const currentFpsForAnimator = ref(10); // To store the FPS that was used for the current extractedFrames

// 移除了 selectedVideoPath, projectName, fps, videoPlayerSrc refs as they are managed by ProjectSetupAndImport

// 这个函数现在由 ProjectSetupAndImport 组件的 'import-ready' 事件触发
async function handleVideoImportReady(importData) {
  console.log("App.vue received import-ready with data:", importData);
  processingMessage.value = "正在准备处理视频...";
  extractedFrames.value = []; // Clear previous frames
  
  // Store the FPS that will be used for processing, to pass to FrameAnimator
  currentFpsForAnimator.value = importData.fps;

  // 调用后端处理
  await processVideoWithBackend(importData.videoPath, importData.projectName, importData.fps);
}

// 新的函数，专门用于与后端交互
async function processVideoWithBackend(videoPath, projectName, fpsValue) {
  processingMessage.value = "正在处理视频，请稍候...";
  try {
    console.log(`Sending to backend - Path: ${videoPath}, Project: ${projectName}, FPS: ${fpsValue}`);
    const framePaths = await invoke("process_video", { 
      path: videoPath, 
      projectName: projectName,
      fps: Number(fpsValue)
    });
    console.log("Backend processing result (frame paths):", framePaths);
    
    if (Array.isArray(framePaths) && framePaths.length > 0) {
      // Note: convertFileSrc is now called inside FrameAnimator and FrameThumbnailsGrid if they receive raw paths
      // However, our backend already returns absolute paths, and convertFileSrc is needed by frontend.
      // For simplicity, let's assume convertFileSrc is still best done here before passing to children requiring asset URLs.
      // Re-evaluating: FrameAnimator and FrameThumbnailsGrid receive URLs ready for <img src>
      // So App.vue should convert them.
      // The backend provides absolute paths. convertFileSrc is needed.
      // Let's do it here as before.
      const { convertFileSrc } = await import('@tauri-apps/api/core'); // Dynamic import if not globally available
      extractedFrames.value = framePaths.map(p => convertFileSrc(p)); 
      processingMessage.value = `成功提取 ${framePaths.length} 帧！`;
    } else if (Array.isArray(framePaths) && framePaths.length === 0) {
      extractedFrames.value = [];
      processingMessage.value = "处理成功，但未提取到任何帧。请检查视频内容和FPS设置。";
    } else {
      extractedFrames.value = [];
      processingMessage.value = "后端返回了意外的数据格式。";
      console.warn("Unexpected backend response:", framePaths);
    }

  } catch (error) {
    console.error("Error calling process_video command:", error);
    extractedFrames.value = []; 
    processingMessage.value = `处理视频失败: ${error}`;
  }
}

function updateProcessingMessage(message) {
  processingMessage.value = message;
}

function handleImportError(errorMessage) {
  processingMessage.value = errorMessage;
  extractedFrames.value = []; // Clear frames on import error
}

// 移除了旧的 isProjectNameValid, selectVideoFile, handleProcessVideo (renamed/refactored)
// 移除了监听 projectName 的 watch, App.vue now reacts to events from ProjectSetupAndImport

</script>

<template>
  <main class="container">
    <ProjectSetupAndImport 
      @import-ready="handleVideoImportReady"
      @processing-status="updateProcessingMessage"
      @import-error="handleImportError"
    />

    <!-- 处理消息显示 -->
    <div class="row processing-status-display" v-if="processingMessage">
      <p>{{ processingMessage }}</p>
    </div>

    <!-- 动画播放器和缩略图网格 -->
    <FrameAnimator 
      :frames="extractedFrames" 
      :fps="currentFpsForAnimator" 
      v-if="extractedFrames.length > 0"
    />

    <FrameThumbnailsGrid 
      :frames="extractedFrames" 
      v-if="extractedFrames.length > 0"
    />

  </main>
</template>

<style scoped>
/* App.vue scoped styles are now minimal */
.processing-status-display {
  margin-top: 0; /* Adjust as ProjectSetupAndImport has margin-bottom */
  margin-bottom: 15px;
  min-height: 20px; 
  text-align: center;
  font-size: 0.9em;
  color: #333; /* Or make it more prominent for errors */
}

.processing-status-display p {
    margin: 0; /* Remove default p margin */
}
</style>

<style>
/* Global styles remain unchanged */
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;

  color: #0f0f0f;
  background-color: #f6f6f6;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

.container {
  margin: 0;
  padding-top: 20px; 
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  justify-content: center; 
  width: 100%; 
}

/* Other global styles like h1, input, button are still here but primarily used by child components now */
/* It might be good to move them to a global CSS file if they are truly global */

input,
button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  color: #0f0f0f;
  background-color: #ffffff;
  transition: border-color 0.25s;
  box-shadow: 0 2px 2px rgba(0, 0, 0, 0.2);
}

button {
  cursor: pointer;
}

button:hover {
  border-color: #396cd8;
}
button:active {
  border-color: #396cd8;
  background-color: #e8e8e8;
}

input,
button {
  outline: none;
}

@media (prefers-color-scheme: dark) {
  :root {
    color: #f6f6f6;
    background-color: #2f2f2f;
  }

  input,
  button {
    color: #ffffff;
    background-color: #0f0f0f98;
  }
  button:active {
    background-color: #0f0f0f69;
  }
}
</style>
