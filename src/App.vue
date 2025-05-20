<script setup>
import { ref, watch } from "vue";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

// 导入新组件
import FrameAnimator from './components/FrameAnimator.vue';
import FrameThumbnailsGrid from './components/FrameThumbnailsGrid.vue';

const selectedVideoPath = ref("");
const projectName = ref("");
const videoPlayerSrc = ref("");
const fps = ref(10); // 这个 FPS 仍由 App.vue 管理，并传递给 FrameAnimator
const extractedFrames = ref([]); // 这个由 App.vue 管理，并传递给两个子组件
const processingMessage = ref("");

async function selectVideoFile() {
  try {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Video',
        extensions: ['mp4']
      }]
    });
    if (selected) {
      const path = Array.isArray(selected) ? selected[0] : selected;
      selectedVideoPath.value = path;
      videoPlayerSrc.value = convertFileSrc(path);
      extractedFrames.value = []; 
      processingMessage.value = ""; 
      console.log("Selected video path:", path);
      console.log("Video player src:", videoPlayerSrc.value);

      if (isProjectNameValid(projectName.value)) {
        console.log("Project name is valid, attempting auto-process...");
        await handleProcessVideo(); 
      } else {
        console.log("Project name is not (yet) valid, skipping auto-process.");
        processingMessage.value = "请输入项目名称后，帧提取将自动开始。";
      }
    } else {
      selectedVideoPath.value = "";
      videoPlayerSrc.value = "";
      extractedFrames.value = []; 
      processingMessage.value = "";
      console.log("No file selected.");
    }
  } catch (error) {
    console.error("Error selecting file:", error);
    selectedVideoPath.value = "Error selecting file.";
    videoPlayerSrc.value = ""; 
    extractedFrames.value = [];
    processingMessage.value = `选择文件出错: ${error}`;
  }
}

async function handleProcessVideo() {
  if (!selectedVideoPath.value) {
    processingMessage.value = "请先选择一个视频文件！";
    return;
  }
  if (!isProjectNameValid(projectName.value)) {
    processingMessage.value = "请输入有效的项目名称 (只能包含英文字母、数字、下划线和中划线)！";
    return;
  }
  if (fps.value <= 0) {
    processingMessage.value = "FPS 必须是大于0的数字！";
    return;
  }

  processingMessage.value = "正在处理视频，请稍候...";
  extractedFrames.value = []; 

  try {
    console.log(`Sending to backend - Path: ${selectedVideoPath.value}, Project: ${projectName.value.trim()}, FPS: ${fps.value}`);
    const framePaths = await invoke("process_video", { 
      path: selectedVideoPath.value, 
      projectName: projectName.value.trim(),
      fps: Number(fps.value)
    });
    console.log("Backend processing result (frame paths):", framePaths);
    
    if (Array.isArray(framePaths) && framePaths.length > 0) {
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

function isProjectNameValid(name) {
  if (!name || !name.trim()) return false;
  return /^[a-zA-Z0-9_-]+$/.test(name.trim());
}

watch(projectName, (newName) => {
  if (selectedVideoPath.value && isProjectNameValid(newName)) {
    handleProcessVideo();
  } else if (selectedVideoPath.value && !isProjectNameValid(newName)) {
    processingMessage.value = "请输入有效的项目名称以开始处理。";
    extractedFrames.value = []; 
  }
});

</script>

<template>
  <main class="container">
    <div style="display: flex; justify-content: flex-start; align-items: center; margin-bottom: 20px; padding-left: 20px;">
      <label for="project-name-input" style="margin-right: 8px; font-size: 0.9em;">项目名称:</label>
      <input 
        id="project-name-input"
        type="text" 
        v-model="projectName" 
        placeholder="(英文/数字/_-)"
        style="width: 180px; padding: 0.4em 0.8em; font-size: 0.9em; margin-right: 20px;" 
      />
      <label for="fps-input" style="margin-right: 8px; font-size: 0.9em;">FPS:</label>
      <input 
        id="fps-input"
        type="number" 
        v-model.number="fps" 
        min="1"
        max="60" 
        style="width: 70px; padding: 0.4em 0.8em; font-size: 0.9em;"
      />
    </div>

    <div class="row" style="margin-top: 10px;">
      <button @click="selectVideoFile">导入视频</button>
    </div>

    <div class="row" style="margin-top: 20px;" v-if="videoPlayerSrc">
      <video :src="videoPlayerSrc" controls style="max-width: 360px; max-height: 240px; border: 1px solid #ccc;"></video>
    </div>

    <div class="row" style="margin-top: 15px; min-height: 20px;" v-if="processingMessage">
      <p style="font-size: 0.9em; color: #333; text-align: center;">{{ processingMessage }}</p>
    </div>

    <!-- 使用新组件 -->
    <FrameAnimator 
      :frames="extractedFrames" 
      :fps="fps" 
      v-if="extractedFrames.length > 0"
    />

    <FrameThumbnailsGrid 
      :frames="extractedFrames" 
      v-if="extractedFrames.length > 0"
    />

  </main>
</template>

<style scoped>
/* 
  移除了 .animation-section, .animation-controls, .fps-display, 
  .animation-player, .animation-preview-img, .placeholder-text, 
  .frames-grid-container, .frame-item img 的样式定义，
  因为它们现在分别在 FrameAnimator.vue 和 FrameThumbnailsGrid.vue 中。
*/
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

h1 {
  text-align: center;
}

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
