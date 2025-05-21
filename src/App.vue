<script setup>
import { ref, computed } from "vue"; // Watch is no longer needed here for project name/fps changes for auto-processing
import { invoke, convertFileSrc } from "@tauri-apps/api/core"; // 静态导入 convertFileSrc

// 导入子组件
import FrameAnimator from './components/FrameAnimator.vue';
import FrameThumbnailsGrid from './components/FrameThumbnailsGrid.vue';
import ProjectSetupAndImport from './components/ProjectSetupAndImport.vue';
import FrameEditor from './components/FrameEditor.vue'; // Import FrameEditor

// App.vue 现在主要管理处理后的结果和整体状态
const extractedFrames = ref([]);
const originalFrameFilePaths = ref([]); // To store original file paths from backend if needed for overwriting
const processingMessage = ref("");

// State to hold current project context and settings for children components
const currentProjectName = ref("");
const currentExtractionFps = ref(10); // Default, will be updated

// This object will hold settings to initialize FrameAnimator and to be passed to ProjectSetup for saving
const animatorSettings = ref({
  playbackFps: 10,    // Default, will be updated
  startIndex: 0,        // Default
  endIndex: null,       // Default (means to the end)
  totalFrames: 0        // Will be updated after frame extraction or metadata load
});

// This is passed to FrameThumbnailsGrid to highlight the selection
const currentSelectedRangeForGrid = ref({ start: 0, end: -1 });

// --- Frame Editor State ---
const frameBeingEdited = ref(null); // { index: number, src: string (asset URL or dataURL) }

// Computed properties to pass as :initial-xxx to FrameAnimator
const initialPlaybackFpsForAnimator = computed(() => animatorSettings.value.playbackFps);
const initialStartIndexForAnimator = computed(() => animatorSettings.value.startIndex);
const initialEndIndexForAnimator = computed(() => {
    // If endIndex is null but we have totalFrames, it means play to the end.
    // FrameAnimator might expect a concrete number or null. Let's pass what we have.
    return animatorSettings.value.endIndex;
});

// Computed properties to pass to ProjectSetupAndImport for saving
const playbackSettingsForSave = computed(() => ({
    playbackFps: animatorSettings.value.playbackFps,
    startIndex: animatorSettings.value.startIndex,
    endIndex: animatorSettings.value.endIndex === null && animatorSettings.value.totalFrames > 0 
                ? animatorSettings.value.totalFrames - 1 
                : animatorSettings.value.endIndex
}));
const totalFramesForSave = computed(() => animatorSettings.value.totalFrames);

// 这个函数现在由 ProjectSetupAndImport 组件的 'import-ready' 事件触发
async function handleVideoImportReady(importData) {
  console.log("[App.vue] Import Ready. Data:", importData);
  processingMessage.value = "正在准备处理视频...";
  extractedFrames.value = [];
  originalFrameFilePaths.value = []; // Clear original paths
  frameBeingEdited.value = null; // Close editor if open
  
  currentProjectName.value = importData.projectName;
  currentExtractionFps.value = importData.fps;

  // Reset animator settings for a new import, based on extraction FPS
  animatorSettings.value = {
    playbackFps: importData.fps, // Default playback to extraction FPS
    startIndex: 0,
    endIndex: null, // Will be updated to actual last frame after processing
    totalFrames: 0
  };
  currentSelectedRangeForGrid.value = { start: 0, end: -1 }; // Reset grid selection

  await processVideoWithBackend(importData.videoPath, importData.projectName, importData.fps);
}

// 新的函数，专门用于与后端交互
async function processVideoWithBackend(videoPath, projectName, fpsValue) {
  processingMessage.value = "正在处理视频，请稍候...";
  try {
    console.log(`Sending to backend - Path: ${videoPath}, Project: ${projectName}, FPS: ${fpsValue}`);
    const frameFilePathsFromBackend = await invoke("process_video", { 
      path: videoPath, 
      projectName: projectName,
      fps: Number(fpsValue)
    });
    console.log("Backend processing result (raw file paths):", frameFilePathsFromBackend);
    
    if (Array.isArray(frameFilePathsFromBackend) && frameFilePathsFromBackend.length > 0) {
      originalFrameFilePaths.value = [...frameFilePathsFromBackend]; // Store original paths
      extractedFrames.value = frameFilePathsFromBackend.map(p => convertFileSrc(p)); 
      processingMessage.value = `成功提取 ${frameFilePathsFromBackend.length} 帧！`;
      
      // Update totalFrames and potentially endIndex if it was null
      animatorSettings.value.totalFrames = frameFilePathsFromBackend.length;
      if (animatorSettings.value.endIndex === null || animatorSettings.value.endIndex >= frameFilePathsFromBackend.length) {
        animatorSettings.value.endIndex = frameFilePathsFromBackend.length - 1;
      }
      // Ensure startIndex is also valid
      if (animatorSettings.value.startIndex >= frameFilePathsFromBackend.length) {
          animatorSettings.value.startIndex = 0;
      }
      currentSelectedRangeForGrid.value = { start: animatorSettings.value.startIndex, end: animatorSettings.value.endIndex };

    } else if (Array.isArray(frameFilePathsFromBackend) && frameFilePathsFromBackend.length === 0) {
      extractedFrames.value = [];
      originalFrameFilePaths.value = [];
      processingMessage.value = "处理成功，但未提取到任何帧。请检查视频内容和FPS设置。";
      animatorSettings.value.totalFrames = 0;
      animatorSettings.value.startIndex = 0;
      animatorSettings.value.endIndex = null;
      currentSelectedRangeForGrid.value = { start: 0, end: -1 };
    } else {
      extractedFrames.value = [];
      originalFrameFilePaths.value = [];
      processingMessage.value = "后端返回了意外的数据格式。";
      animatorSettings.value = { playbackFps: currentExtractionFps.value, startIndex: 0, endIndex: null, totalFrames: 0 };
      currentSelectedRangeForGrid.value = { start: 0, end: -1 };
      console.warn("Unexpected backend response:", frameFilePathsFromBackend);
    }

  } catch (error) {
    console.error("Error calling process_video command:", error);
    extractedFrames.value = []; 
    originalFrameFilePaths.value = [];
    processingMessage.value = `处理视频失败: ${error}`;
    animatorSettings.value = { playbackFps: currentExtractionFps.value, startIndex: 0, endIndex: null, totalFrames: 0 };
    currentSelectedRangeForGrid.value = { start: 0, end: -1 };
    frameBeingEdited.value = null;
  }
}

function handleProjectMetadataLoaded(loadedData) {
  console.log("[App.vue] Project Metadata Loaded. Data:", loadedData);
  frameBeingEdited.value = null; // Close editor if open
  if (loadedData && typeof loadedData.projectName === 'string') {
    currentProjectName.value = loadedData.projectName;
    currentExtractionFps.value = typeof loadedData.extractionFps === 'number' ? loadedData.extractionFps : 10;
    
    const totalFrames = typeof loadedData.totalFrames === 'number' ? loadedData.totalFrames : 0;
    let endIdx = typeof loadedData.animationEndIndex === 'number' ? loadedData.animationEndIndex : null;
    if (endIdx === null && totalFrames > 0) endIdx = totalFrames -1;

    animatorSettings.value = {
      playbackFps: typeof loadedData.playbackFps === 'number' ? loadedData.playbackFps : currentExtractionFps.value,
      startIndex: typeof loadedData.animationStartIndex === 'number' ? loadedData.animationStartIndex : 0,
      endIndex: endIdx,
      totalFrames: totalFrames
    };
    currentSelectedRangeForGrid.value = { start: animatorSettings.value.startIndex, end: animatorSettings.value.endIndex };
    
    // If metadata is loaded, we expect frames to be present from a previous session.
    // We might need to re-construct `extractedFrames` if they are not automatically available 
    // or if originalVideoPath changed and user expects re-processing.
    // For now, assume if metadata is loaded, frames are already in `./projects/...` and will be displayed by FrameAnimator if paths are correct.
    // This part might need more thought if we want to auto-re-extract or just use saved frame paths.
    // The current `process_video` Rust command *always* re-extracts if called.
    // So, if metadata is loaded, `App.vue` doesn't automatically call `process_video`.
    // User would need to click "Import Video" again if they want to re-process based on loaded originalVideoPath.
    // To display previously extracted frames, we would need FrameAnimator to accept frame *patterns* or ProjectSetup to emit frame paths.
    // For now, after metadata load, if user wants to see frames, they should have already been processed or need to run import.
    // If `loadedData.totalFrames > 0` but `extractedFrames.value.length === 0`, it implies a disconnect.
    // Let's assume `extractedFrames` would be populated by `handleVideoImportReady` if user decides to import after loading metadata.
    if (totalFrames > 0 && extractedFrames.value.length === 0 && loadedData.originalVideoPath) {
        processingMessage.value = `项目 ${loadedData.projectName} 设置已加载。包含 ${totalFrames} 帧。如需预览，请重新导入视频: ${loadedData.originalVideoPath}`;
    }

  } else {
    // Metadata load failed or was empty, reset to defaults based on current extraction FPS if any
    processingMessage.value = "元数据加载失败或为空，使用默认设置。";
    animatorSettings.value = {
      playbackFps: currentExtractionFps.value, // Use current extraction FPS or a hard default
      startIndex: 0,
      endIndex: extractedFrames.value.length > 0 ? extractedFrames.value.length - 1 : null,
      totalFrames: extractedFrames.value.length
    };
    currentSelectedRangeForGrid.value = { start: animatorSettings.value.startIndex, end: animatorSettings.value.endIndex };
  }
}

function handleAnimatorPlaybackSettingsChanged(newSettings) {
  console.log("[App.vue] Animator Playback Settings Changed. Data:", newSettings);
  animatorSettings.value.playbackFps = newSettings.playbackFps;
  animatorSettings.value.startIndex = newSettings.startIndex;
  animatorSettings.value.endIndex = newSettings.endIndex;
  // totalFrames is not changed by animator, it's from video processing.
  
  // Update the grid selection too
  currentSelectedRangeForGrid.value = { start: newSettings.startIndex, end: newSettings.endIndex };
}

function handleAnimatorRangeSelected(payload) { // This might be redundant if playback-settings-changed covers it
  console.log("[App.vue] Animator Range Selected. Data:", payload);
  currentSelectedRangeForGrid.value = { ...payload };
  // Also update animatorSettings if only range-selected is emitted without full playback settings
  if (animatorSettings.value.startIndex !== payload.start || animatorSettings.value.endIndex !== payload.end) {
      animatorSettings.value.startIndex = payload.start;
      animatorSettings.value.endIndex = payload.end;
      // If FrameAnimator only emits range-selected and not full playback-settings-changed for this action,
      // we might need to trigger something here or ensure FrameAnimator always sends the full packet.
      // For now, assuming handleAnimatorPlaybackSettingsChanged is the primary source or also gets called.
  }
}

function updateProcessingMessage(message) {
  processingMessage.value = message;
}

function handleImportError(errorMessage) {
  processingMessage.value = errorMessage;
  extractedFrames.value = [];
  originalFrameFilePaths.value = [];
  animatorSettings.value = { playbackFps: 10, startIndex: 0, endIndex: null, totalFrames: 0 };
  currentSelectedRangeForGrid.value = { start: 0, end: -1 };
  frameBeingEdited.value = null;
}

// --- Frame Editor Event Handlers ---
function handleEditFrameRequest(frameIndex) {
  if (frameIndex >= 0 && frameIndex < extractedFrames.value.length) {
    const frameSrc = extractedFrames.value[frameIndex];
    // const originalFile = originalFrameFilePaths.value[frameIndex]; // If needed later for overwriting original file
    frameBeingEdited.value = {
      index: frameIndex,
      src: frameSrc,
      // originalSrc: originalFile // For future use if overwriting files
    };
    console.log("[App.vue] Editing frame:", frameBeingEdited.value);
  } else {
    console.warn("[App.vue] Invalid frame index for editing:", frameIndex);
  }
}

function handleFrameUpdated(payload) { // { index, newSrcDataUrl }
  console.log("[App.vue] Frame updated from editor:", payload);
  if (payload.index >= 0 && payload.index < extractedFrames.value.length) {
    extractedFrames.value[payload.index] = payload.newSrcDataUrl;
    // Here, we could also invoke a Rust command to overwrite the original PNG file
    // with the new base64 data if that's desired.
    // For now, we just update the in-memory representation for preview and animation.
    processingMessage.value = `帧 #${payload.index} 已更新。`;
  }
  frameBeingEdited.value = null; // Close editor
}

function handleCancelEdit() {
  console.log("[App.vue] Frame editing cancelled.");
  frameBeingEdited.value = null; // Close editor
}

</script>

<template>
  <main class="container">
    <ProjectSetupAndImport 
      @import-ready="handleVideoImportReady"
      @project-metadata-loaded="handleProjectMetadataLoaded"
      @processing-status="updateProcessingMessage"
      @import-error="handleImportError"
      :latest-playback-settings="playbackSettingsForSave" 
      :latest-total-frames="totalFramesForSave" 
    />

    <!-- 处理消息显示 -->
    <div class="row processing-status-display" v-if="processingMessage">
      <p>{{ processingMessage }}</p>
    </div>

    <!-- 动画播放器和缩略图网格 -->
    <FrameAnimator 
      :frames="extractedFrames" 
      :extraction-fps="currentExtractionFps" 
      :initial-playback-fps="initialPlaybackFpsForAnimator"
      :initial-start-index="initialStartIndexForAnimator"
      :initial-end-index="initialEndIndexForAnimator"
      @playback-settings-changed="handleAnimatorPlaybackSettingsChanged" 
      @range-selected="handleAnimatorRangeSelected" 
      v-if="(extractedFrames.length > 0 || animatorSettings.totalFrames > 0) && !frameBeingEdited"
    />

    <FrameThumbnailsGrid 
      :frames="extractedFrames" 
      :selected-range="currentSelectedRangeForGrid" 
      @edit-frame-requested="handleEditFrameRequest" 
      v-if="(extractedFrames.length > 0 || animatorSettings.totalFrames > 0) && !frameBeingEdited"
    />

    <FrameEditor 
      :frame-to-edit="frameBeingEdited" 
      @update-frame="handleFrameUpdated"
      @cancel-edit="handleCancelEdit"
      v-if="frameBeingEdited" 
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

/* Dark theme for processing message if needed */
@media (prefers-color-scheme: dark) {
  .processing-status-display {
    color: #f0f0f0; 
  }
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
  min-height: 100vh; /* ensure container takes full height */
  box-sizing: border-box;
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
