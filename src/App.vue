<script setup>
import { ref, computed } from "vue";
// Removed invoke and convertFileSrc here as they are now in the composable

// Import composables
import useProjectManagement from './composables/useProjectManagement';
import useAnimatorSettings from './composables/useAnimatorSettings';
import useFrameEditing from './composables/useFrameEditing';

// 导入子组件
import FrameAnimator from './components/FrameAnimator.vue';
import FrameThumbnailsGrid from './components/FrameThumbnailsGrid.vue';
import ProjectSetupAndImport from './components/ProjectSetupAndImport.vue';
import FrameEditor from './components/FrameEditor.vue';

// Initialize composables
const {
  extractedFrames, // Now from useProjectManagement
  originalFrameFilePaths, // Now from useProjectManagement
  processingMessage, // Now from useProjectManagement
  currentProjectName, // Now from useProjectManagement
  currentExtractionFps, // Now from useProjectManagement
  importAndProcessVideo // Method from useProjectManagement
} = useProjectManagement();

// Initialize Animator Settings Composable
const {
  currentSelectedRangeForGrid,
  initialPlaybackFpsForAnimator,
  initialStartIndexForAnimator,
  initialEndIndexForAnimator,
  animatorSettingsForSave,
  totalFrames,
  updatePlaybackSettings,
  updateRangeSelection,
  initializeAnimatorOnNewVideo,
  loadAnimatorFromMetadata,
} = useAnimatorSettings();

// Initialize Frame Editing Composable
const {
  frameBeingEdited,
  requestEditFrame,
  confirmFrameUpdate,
  cancelFrameEdit,
} = useFrameEditing(extractedFrames, processingMessage);

// Function to update App.vue's processingMessage ref
const updateAppProcessingMessage = (newMessage) => {
  if (typeof newMessage === 'string') {
    processingMessage.value = newMessage;
  } else {
    console.warn("[App.vue] Attempted to update processingMessage with non-string value:", newMessage);
  }
};

async function handleVideoImportReady(importData) {
  console.log("[App.vue] Import Ready. Data:", importData);
  if (frameBeingEdited.value) {
    cancelFrameEdit();
  }

  const processingResult = await importAndProcessVideo(importData);

  if (processingResult.success) {
    initializeAnimatorOnNewVideo(processingResult.frameCount, currentExtractionFps.value);
  } else {
    extractedFrames.value = [];
    originalFrameFilePaths.value = [];
    initializeAnimatorOnNewVideo(0, currentExtractionFps.value);
  }
}

function handleProjectMetadataLoaded(loadedData) {
  console.log("[App.vue] Project Metadata Loaded. Data:", loadedData);
  if (frameBeingEdited.value) {
    cancelFrameEdit();
  }
  if (loadedData && typeof loadedData.projectName === 'string') {
    currentProjectName.value = loadedData.projectName;
    currentExtractionFps.value = typeof loadedData.extractionFps === 'number' ? loadedData.extractionFps : 10;
    
    loadAnimatorFromMetadata(loadedData, currentExtractionFps.value);

    if (loadedData.totalFrames > 0 && extractedFrames.value.length === 0 && loadedData.originalVideoPath) {
        processingMessage.value = `项目 ${loadedData.projectName} 设置已加载。包含 ${loadedData.totalFrames} 帧。如需预览，请重新导入视频。`;
    }

  } else {
    processingMessage.value = "元数据加载失败或为空，使用默认设置。";
    initializeAnimatorOnNewVideo(extractedFrames.value.length, currentExtractionFps.value); 
  }
}

function handleAnimatorPlaybackSettingsChanged(newSettings) {
  console.log("[App.vue] Animator Playback Settings Changed. Data:", newSettings);
  updatePlaybackSettings(newSettings);
}

function handleAnimatorRangeSelected(payload) { 
  console.log("[App.vue] Animator Range Selected. Data:", payload);
  updateRangeSelection(payload);
}

function updateProcessingMessage(message) {
  // This function is called by ProjectSetupAndImport's emit('processing-status')
  // We should ensure this also updates the main processingMessage ref correctly.
  if (typeof message === 'string') {
    processingMessage.value = message; 
  } else {
    console.warn("[App.vue] Attempted to update processingMessage via updateProcessingMessage with non-string value:", message);
  }
}

function handleImportError(errorMessage) {
  if (typeof errorMessage === 'string') {
    processingMessage.value = errorMessage; 
  } else {
    processingMessage.value = "导入时发生未知错误。";
    console.warn("[App.vue] handleImportError received non-string error message:", errorMessage);
  }
  extractedFrames.value = [];
  originalFrameFilePaths.value = [];
  initializeAnimatorOnNewVideo(0, currentExtractionFps.value); 
  if (frameBeingEdited.value) {
    cancelFrameEdit(); 
  }
}

function handleEditFrameRequest(frameIndex) {
  requestEditFrame(frameIndex);
}

function handleFrameUpdated(payload) { 
  console.log("[App.vue] Frame update event received from editor:", payload);
  const updateWasConfirmed = confirmFrameUpdate(payload);
  
  if (updateWasConfirmed) {
    if (payload.index >= 0 && payload.index < extractedFrames.value.length) {
      extractedFrames.value[payload.index] = payload.newSrcDataUrl;
      processingMessage.value = `帧 #${payload.index} 已成功更新。`;
    } else {
      console.warn("[App.vue] confirmFrameUpdate returned true, but index is still invalid. Payload:", payload);
      processingMessage.value = `尝试更新帧 #${payload.index} 失败，索引无效。`;
    }
  } else {
    console.warn("[App.vue] Frame update was not confirmed by composable or data was invalid.");
  }
}

function handleCancelEdit() {
  cancelFrameEdit();
}

</script>

<template>
  <main class="container">
    <ProjectSetupAndImport 
      @import-ready="handleVideoImportReady"
      @project-metadata-loaded="handleProjectMetadataLoaded"
      @processing-status="updateProcessingMessage" 
      @import-error="handleImportError"
      :latest-animator-settings="animatorSettingsForSave" 
      :initial-project-name="currentProjectName" 
      :initial-extraction-fps="currentExtractionFps"
    />

    <div class="row processing-status-display" v-if="processingMessage">
      <p>{{ processingMessage }}</p>
    </div>

    <FrameAnimator 
      :frames="extractedFrames" 
      :extraction-fps="currentExtractionFps" 
      :initial-playback-fps="initialPlaybackFpsForAnimator"
      :initial-start-index="initialStartIndexForAnimator"
      :initial-end-index="initialEndIndexForAnimator"
      @playback-settings-changed="handleAnimatorPlaybackSettingsChanged" 
      @range-selected="handleAnimatorRangeSelected" 
      v-if="(extractedFrames.length > 0 || totalFrames > 0) && !frameBeingEdited"
    />

    <FrameThumbnailsGrid 
      :frames="extractedFrames" 
      :selected-range="currentSelectedRangeForGrid" 
      @edit-frame-requested="handleEditFrameRequest" 
      v-if="(extractedFrames.length > 0 || totalFrames > 0) && !frameBeingEdited"
    />

    <FrameEditor 
      :frame-to-edit="frameBeingEdited" 
      @update-frame="handleFrameUpdated"
      @cancel-edit="handleCancelEdit"
      v-if="frameBeingEdited" 
      :project-extracted-frames="extractedFrames"
      :project-original-frame-paths="originalFrameFilePaths"
      :processing-message-string="processingMessage.value" 
      :update-app-processing-message="updateAppProcessingMessage"
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
