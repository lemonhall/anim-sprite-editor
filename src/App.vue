<script setup>
import { ref, watch } from "vue";
import { invoke, convertFileSrc } from "@tauri-apps/api/core"; // 导入 convertFileSrc
import { open } from "@tauri-apps/plugin-dialog";

const selectedVideoPath = ref("");
const projectName = ref(""); // 新增: 项目名称
const videoPlayerSrc = ref(""); // 新增: 用于视频播放器的 src
const fps = ref(10); // 新增: FPS ref，默认值为 10
const extractedFrames = ref([]); // 新增: 存储提取出来的帧的 asset URL
const processingMessage = ref(""); // 新增: 用于显示处理过程中的消息或错误

// 新增: 动画播放相关 refs
const isPlaying = ref(false);
const animationTimerId = ref(null);
const currentFrameForAnimationSrc = ref(''); // 当前动画播放器显示的帧 src
const currentAnimationIndex = ref(0);     // 当前动画播放帧的索引

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
      videoPlayerSrc.value = convertFileSrc(path); // 转换为可播放的 URL
      extractedFrames.value = []; // 清空旧的帧
      processingMessage.value = ""; // 清空消息
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
      videoPlayerSrc.value = ""; // 清空播放器 src
      extractedFrames.value = []; 
      processingMessage.value = "";
      console.log("No file selected.");
    }
  } catch (error) {
    console.error("Error selecting file:", error);
    selectedVideoPath.value = "Error selecting file.";
    videoPlayerSrc.value = ""; // 出错时清空
    extractedFrames.value = [];
    processingMessage.value = `选择文件出错: ${error}`;
  }
}

// 新增: 处理视频的函数
async function handleProcessVideo() {
  if (!selectedVideoPath.value) {
    processingMessage.value = "请先选择一个视频文件！";
    return;
  }
  if (!isProjectNameValid(projectName.value)) {
    processingMessage.value = "请输入有效的项目名称 (只能包含英文字母、数字、下划线和中划线)！";
    return;
  }
  if (fps.value <= 0) { // 简单的 FPS 值校验
    processingMessage.value = "FPS 必须是大于0的数字！";
    return;
  }

  processingMessage.value = "正在处理视频，请稍候...";
  extractedFrames.value = []; // 开始处理前清空旧帧

  try {
    console.log(`Sending to backend - Path: ${selectedVideoPath.value}, Project: ${projectName.value.trim()}, FPS: ${fps.value}`);
    const framePaths = await invoke("process_video", { 
      path: selectedVideoPath.value, 
      projectName: projectName.value.trim(),
      fps: Number(fps.value) // 确保传递的是数字类型
    });
    console.log("Backend processing result (frame paths):", framePaths);
    
    if (Array.isArray(framePaths) && framePaths.length > 0) {
      extractedFrames.value = framePaths.map(p => convertFileSrc(p));
      processingMessage.value = `成功提取 ${framePaths.length} 帧！`;
    } else if (Array.isArray(framePaths) && framePaths.length === 0) {
      processingMessage.value = "处理成功，但未提取到任何帧。请检查视频内容和FPS设置。";
    } else {
      processingMessage.value = "后端返回了意外的数据格式。";
      console.warn("Unexpected backend response:", framePaths);
    }

  } catch (error) {
    console.error("Error calling process_video command:", error);
    processingMessage.value = `处理视频失败: ${error}`;
  }
}

// 检查项目名称是否有效 (辅助函数)
function isProjectNameValid(name) {
  if (!name || !name.trim()) return false;
  return /^[a-zA-Z0-9_-]+$/.test(name.trim());
}

// 动画控制方法
function startAnimation() {
  if (extractedFrames.value.length === 0 || fps.value <= 0) return;
  
  isPlaying.value = true;
  if (animationTimerId.value) {
    clearInterval(animationTimerId.value);
  }
  animationTimerId.value = setInterval(() => {
    currentAnimationIndex.value = (currentAnimationIndex.value + 1) % extractedFrames.value.length;
    currentFrameForAnimationSrc.value = extractedFrames.value[currentAnimationIndex.value];
  }, 1000 / fps.value);
}

function stopAnimation() {
  if (animationTimerId.value) {
    clearInterval(animationTimerId.value);
    animationTimerId.value = null;
  }
  isPlaying.value = false;
}

function togglePlayAnimation() {
  if (extractedFrames.value.length === 0) return;
  if (isPlaying.value) {
    stopAnimation();
  } else {
    // 开始播放前，确保 currentAnimationIndex 和 currentFrameForAnimationSrc 是初始状态或基于当前 index
    if(currentFrameForAnimationSrc.value === '' && extractedFrames.value.length > 0) {
        currentAnimationIndex.value = 0;
        currentFrameForAnimationSrc.value = extractedFrames.value[0];
    } else if (extractedFrames.value.length > 0) {
        // 如果之前有选中的帧，就从那个帧开始，或者总是从0开始
        // currentFrameForAnimationSrc.value = extractedFrames.value[currentAnimationIndex.value];
        // 为了简化，暂停后再播放总是从当前帧的下一帧开始或重头开始（如果已是最后一帧）
        // startAnimation 会处理 index 的递增和 src 的更新
    }
    startAnimation();
  }
}

watch(extractedFrames, (newFrames) => {
  stopAnimation();
  currentAnimationIndex.value = 0;
  if (newFrames && newFrames.length > 0) {
    currentFrameForAnimationSrc.value = newFrames[0]; // 默认显示第一帧
  } else {
    currentFrameForAnimationSrc.value = ''; // 清空
  }
});

watch(projectName, (newName) => {
  if (selectedVideoPath.value && isProjectNameValid(newName)) {
    handleProcessVideo();
  } else if (selectedVideoPath.value && !isProjectNameValid(newName)) {
    processingMessage.value = "请输入有效的项目名称以开始处理。";
    extractedFrames.value = []; // 如果项目名失效，也清空帧
  }
});

// 当FPS改变时，如果正在播放，则停止并用新的FPS重新启动动画
watch(fps, (newFps) => {
  if (isPlaying.value && newFps > 0 && extractedFrames.value.length > 0) {
    stopAnimation(); // 先停止旧的
    startAnimation(); // 用新的FPS启动
  }
});
</script>

<template>
  <main class="container">
    <!-- <h1>视频转精灵图工具</h1> --> <!-- 移除页面标题 -->

    <!-- 项目名称和 FPS 输入框 -->
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

    <!-- "导入" 按钮居中 -->
    <div class="row" style="margin-top: 10px;"> <!-- 调整了 margin-top -->
      <button @click="selectVideoFile">导入视频</button>
    </div>
    <!-- <p v-if="selectedVideoPath">已导入: {{ selectedVideoPath }}</p> --> <!-- 移除已导入提示 -->

    <!-- 新增: 视频播放器 -->
    <div class="row" style="margin-top: 20px;" v-if="videoPlayerSrc">
      <video :src="videoPlayerSrc" controls style="max-width: 360px; max-height: 240px; border: 1px solid #ccc;"></video>
    </div>

    <div class="row" style="margin-top: 15px; min-height: 20px;" v-if="processingMessage">
      <p style="font-size: 0.9em; color: #333;">{{ processingMessage }}</p>
    </div>

    <!-- 动画播放器和控制 -->
    <div class="animation-section" v-if="extractedFrames.length > 0">
      <div class="animation-controls">
        <button @click="togglePlayAnimation" :disabled="extractedFrames.length === 0">
          {{ isPlaying ? '暂停动画' : '播放动画' }}
        </button>
        <span class="fps-display">动画FPS: {{ fps }}</span>
      </div>
      <div class="animation-player">
        <img 
          v-if="currentFrameForAnimationSrc"
          :src="currentFrameForAnimationSrc" 
          alt="动画预览" 
          class="animation-preview-img"
        />
        <div v-else class="placeholder-text">处理完成后，点击播放预览</div>
      </div>
    </div>

    <div class="frames-grid-container" v-if="extractedFrames.length > 0">
      <div v-for="(frameSrc, index) in extractedFrames" :key="index" class="frame-item">
        <img :src="frameSrc" :alt="`Frame ${index + 1}`" />
      </div>
    </div>

  </main>
</template>

<style scoped>
.animation-section {
  margin-top: 20px;
  padding: 15px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
  display: flex;
  flex-direction: column;
  align-items: center; /* 水平居中控制和播放器 */
}

.animation-controls {
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 15px; /* 按钮和FPS文字之间的间距 */
}

.animation-controls button {
  padding: 0.5em 1em;
}

.fps-display {
  font-size: 0.9em;
  color: #555;
}

.animation-player {
  width: 100%;
  max-width: 300px; /* 限制动画预览图的最大宽度 */
  height: 200px;    /* 固定高度，避免播放时页面跳动 */
  background-color: #eee;
  border: 1px solid #ddd;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden; /* 确保图片不会超出容器 */
}

.animation-preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain; /* 保持图片比例，完整显示 */
}

.placeholder-text {
  font-size: 0.9em;
  color: #777;
}

.frames-grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
  padding: 20px;
  margin-top: 10px;
  border-top: 1px solid #eee; 
}

.frame-item img {
  width: 100%;
  height: auto;
  object-fit: contain; 
  border: 1px solid #ddd;
  border-radius: 4px;
}

</style>
<style>
/* 清理了全局样式，移除了 .logo 和 a 相关定义 */
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
  padding-top: 20px; /* 减少顶部内边距 */
  display: flex;
  flex-direction: column;
  /* justify-content: center; */ /* 让内容自然流动，项目名靠左，其他 .row 元素居中 */
  /* text-align: center; */ /* text-align 会影响 label，在 row 中处理居中 */
}

.row {
  display: flex;
  justify-content: center; /* 保持 .row 内元素居中 */
  width: 100%; /* 确保 .row 占据可用宽度以便正确居中其内容 */
}

h1 {
  text-align: center;
}

input, /* 保留 input 基础样式，虽然目前没有，但后续可能添加 */
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

/* #greet-input 相关样式已在上次移除 */

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
