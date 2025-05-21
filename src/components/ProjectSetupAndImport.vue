<script setup>
import { ref, watch, computed } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { readTextFile, mkdir, writeTextFile } from '@tauri-apps/plugin-fs';
// import { resolve, appConfigDir } from '@tauri-apps/api/path'; // Path API if needed for complex resolution

const props = defineProps({
  latestPlaybackSettings: { // Received from App.vue
    type: Object,
    default: () => ({ playbackFps: 10, startIndex: 0, endIndex: null })
  },
  latestTotalFrames: {    // Received from App.vue
    type: Number,
    default: 0
  }
});

const emit = defineEmits([
  'import-ready',
  'import-cancelled',
  'import-error',
  'processing-status',
  'project-metadata-loaded' // Emitted when project metadata is loaded from file
  // No longer emits 'save-project-requested' or 'project-context-updated', handles save internally
]);

const projectName = ref('');
const extractionFpsInput = ref(10); // User input for extraction FPS
const videoPlayerSrc = ref('');
const selectedOriginalVideoPath = ref(''); // Raw path of the selected video
const isLoadingSettings = ref(false);
const isSavingSettings = ref(false);

// Internal state for values to be saved, updated by props or internal changes
const playbackFpsToSave = ref(props.latestPlaybackSettings.playbackFps);
const animationStartIndexToSave = ref(props.latestPlaybackSettings.startIndex);
const animationEndIndexToSave = ref(props.latestPlaybackSettings.endIndex);
const totalFramesToSave = ref(props.latestTotalFrames);

// Helper function to get the absolute path for project files
async function getAbsoluteProjectPath(projectNameVal, fileName = '') {
  try {
    const baseProjectsPath = await invoke('get_src_tauri_projects_path');
    if (!baseProjectsPath) {
      throw new Error("Backend did not return a valid base projects path.");
    }
    // Ensure correct path joining, especially for Windows.
    // For simplicity, assuming '/' works as a separator and will be handled correctly by OS or Rust.
    // A more robust solution might involve path.join from a Tauri API if available for frontend.
    let fullPath = `${baseProjectsPath}/${projectNameVal}`;
    if (fileName) {
      fullPath = `${fullPath}/${fileName}`;
    }
    fullPath = fullPath.replace(/\\/g, '/'); // Normalize to forward slashes
    console.log(`Resolved absolute path (normalized): ${fullPath}`); // Added "normalized" to log
    return fullPath;
  } catch (error) {
    console.error("Error getting absolute project path:", error);
    emit('processing-status', `无法获取项目基础路径: ${error.message || error}`);
    throw error; // Re-throw to be caught by callers
  }
}

// Watch for updates from App.vue (e.g., FrameAnimator changes playback settings)
watch(() => props.latestPlaybackSettings, (newSettings) => {
  playbackFpsToSave.value = newSettings.playbackFps;
  animationStartIndexToSave.value = newSettings.startIndex;
  animationEndIndexToSave.value = newSettings.endIndex;
  console.log("[ProjectSetup] latestPlaybackSettings prop updated:", newSettings);
}, { deep: true });

watch(() => props.latestTotalFrames, (newTotal) => {
  totalFramesToSave.value = newTotal;
  console.log("[ProjectSetup] latestTotalFrames prop updated:", newTotal);
});


async function triggerVideoSelect() {
  try {
    emit('processing-status', '');
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Video', extensions: ['mp4'] }],
    });

    if (selected) {
      const path = Array.isArray(selected) ? selected[0] : selected;
      selectedOriginalVideoPath.value = path;
      videoPlayerSrc.value = convertFileSrc(path);
      console.log("Video selected in ProjectSetup:", path);
      // Don't emit project-context-update here, App.vue will get info via import-ready or metadata-loaded
      checkAndEmitImportReady(); 
    } else {
      emit('processing-status', '视频选择已取消。');
      emit('import-cancelled');
    }
  } catch (error) {
    console.error('Error selecting file:', error);
    const errorMsg = `文件选择失败: ${error}`;
    emit('import-error', errorMsg);
    emit('processing-status', errorMsg);
  }
}

function isProjectNameValid(name) {
  if (!name || !name.trim()) return false;
  return /^[a-zA-Z0-9_-]+$/.test(name.trim());
}

const projectNameIsValid = computed(() => isProjectNameValid(projectName.value));

async function loadProjectMetadata(name) {
  if (!isProjectNameValid(name)) return;
  isLoadingSettings.value = true;
  const trimmedName = name.trim();
  emit('processing-status', `正在加载项目 ${trimmedName} 的元数据...`);

  try {
    const absoluteMetadataPath = await getAbsoluteProjectPath(trimmedName, 'project_meta.json');
    const metadataStr = await readTextFile(absoluteMetadataPath);
    const loadedData = JSON.parse(metadataStr);
    console.log("Loaded project metadata from:", absoluteMetadataPath, loadedData);

    if (loadedData) {
      selectedOriginalVideoPath.value = loadedData.originalVideoPath || '';
      if (selectedOriginalVideoPath.value) {
        videoPlayerSrc.value = convertFileSrc(selectedOriginalVideoPath.value);
      } else {
        videoPlayerSrc.value = '';
      }
      extractionFpsInput.value = typeof loadedData.extractionFps === 'number' ? loadedData.extractionFps : 10;
      
      // Update internal state for saving (these will also be reflected back to App.vue via emit)
      playbackFpsToSave.value = typeof loadedData.playbackFps === 'number' ? loadedData.playbackFps : extractionFpsInput.value;
      animationStartIndexToSave.value = typeof loadedData.animationStartIndex === 'number' ? loadedData.animationStartIndex : 0;
      animationEndIndexToSave.value = typeof loadedData.animationEndIndex === 'number' ? loadedData.animationEndIndex : (loadedData.totalFrames ? loadedData.totalFrames -1 : null) ;
      totalFramesToSave.value = typeof loadedData.totalFrames === 'number' ? loadedData.totalFrames : 0;

      emit('project-metadata-loaded', { ...loadedData }); // Emit a copy
      emit('processing-status', `项目 ${trimmedName} 的元数据已加载。`);
    } else {
      emit('processing-status', `项目 ${trimmedName} 未找到元数据或元数据为空。`);
      emit('project-metadata-loaded', null); 
    }
  } catch (error) {
    if (error.message && (error.message.toLowerCase().includes('not found') || 
                           error.message.toLowerCase().includes('cannot find the path') ||
                           error.message.toLowerCase().includes('no such file or directory'))) {
        emit('processing-status', `项目 ${name} 无历史元数据。`);
    } else if (error.message && error.message.includes("Backend did not return a valid base projects path.")) {
        // Error already emitted by getAbsoluteProjectPath, just log
        console.error("loadProjectMetadata: Error from getAbsoluteProjectPath:", error);
    } else {
        console.error("Error loading project metadata:", error);
        emit('processing-status', `加载项目 ${name} 元数据失败: ${error.message || error}`);
    }
    emit('project-metadata-loaded', null); 
  }
  isLoadingSettings.value = false;
}

async function handleSaveProjectMetadata() {
    if (!projectNameIsValid.value) {
        emit('processing-status', "项目名称无效，无法保存设置。");
        return;
    }
    isSavingSettings.value = true;
    const trimmedName = projectName.value.trim();
    emit('processing-status', `正在保存项目 ${trimmedName} 的元数据...`);

    try {
      const absoluteProjectDir = await getAbsoluteProjectPath(trimmedName);
      const absoluteFilePath = await getAbsoluteProjectPath(trimmedName, 'project_meta.json');

      const metadataToSave = {
          projectName: trimmedName,
          originalVideoPath: selectedOriginalVideoPath.value,
          extractionFps: Number(extractionFpsInput.value),
          playbackFps: Number(playbackFpsToSave.value),
          totalFrames: Number(totalFramesToSave.value),
          framePattern: "frame_%04d.png",
          animationStartIndex: Number(animationStartIndexToSave.value),
          animationEndIndex: Number(animationEndIndexToSave.value === null || animationEndIndexToSave.value === '' ? totalFramesToSave.value -1 : animationEndIndexToSave.value)
      };

      // Re-enable mkdir and use absolute path
      await mkdir(absoluteProjectDir, { recursive: true }); 
      console.log(`[ProjectSetup] Ensured directory exists: ${absoluteProjectDir}`);

      // Use writeTextFile for string contents, and no options object for absolute path
      await writeTextFile(absoluteFilePath, JSON.stringify(metadataToSave, null, 2)); 
      
      emit('processing-status', `项目 ${trimmedName} 的元数据已成功保存到 ${absoluteFilePath}`);
      console.log("Saved project metadata to:", absoluteFilePath, metadataToSave);
    } catch (error) {
        // Error from getAbsoluteProjectPath would have been emitted already
        if (!(error.message && error.message.includes("Backend did not return a valid base projects path."))) {
            console.error("Error saving project metadata:", error);
            emit('processing-status', `保存元数据失败: ${error.message || error}`);
        }
    }
    isSavingSettings.value = false;
}

function checkAndEmitImportReady() {
  if (selectedOriginalVideoPath.value && projectNameIsValid.value && extractionFpsInput.value > 0) {
    emit('processing-status', ''); 
    emit('import-ready', {
      videoPath: selectedOriginalVideoPath.value,
      projectName: projectName.value.trim(),
      fps: Number(extractionFpsInput.value), 
    });
  } else if (selectedOriginalVideoPath.value && !projectNameIsValid.value) {
    emit('processing-status', '请输入有效的项目名称以准备处理。');
  } else if (selectedOriginalVideoPath.value && extractionFpsInput.value <= 0) {
    emit('processing-status', '提取FPS必须大于0。');
  }
}

watch(projectName, (newName, oldName) => {
  if (newName && isProjectNameValid(newName) && newName !== oldName) {
    loadProjectMetadata(newName.trim());
  }
  // Don't emit project-context-updated on every keystroke for projectName,
  // App.vue will get necessary context from 'import-ready' or 'project-metadata-loaded' events.
  if (selectedOriginalVideoPath.value) { 
      checkAndEmitImportReady();
  }
});

watch(extractionFpsInput, () => {
  if (selectedOriginalVideoPath.value) { 
      checkAndEmitImportReady();
  }
});

// No specific watch for selectedOriginalVideoPath needed to call checkAndEmitImportReady,
// as triggerVideoSelect calls it after path is set.

</script>

<template>
  <div class="project-setup-import-component">
    <div class="input-group">
      <label for="project-name-input">项目名称:</label>
      <input 
        id="project-name-input"
        type="text" 
        v-model="projectName" 
        placeholder="(英文/数字/_-)"
        :disabled="isLoadingSettings || isSavingSettings"
      />
    </div>
    <div class="input-group">
      <label for="extraction-fps-input">提取FPS:</label>
      <input 
        id="extraction-fps-input"
        type="number" 
        v-model.number="extractionFpsInput" 
        min="1"
        max="120" 
        :disabled="isLoadingSettings || isSavingSettings"
      />
    </div>
    <div class="import-controls">
      <button @click="triggerVideoSelect" :disabled="isLoadingSettings || isSavingSettings">导入视频</button>
      <button @click="handleSaveProjectMetadata" :disabled="!projectNameIsValid || isLoadingSettings || isSavingSettings" class="save-settings-button">
        {{ isSavingSettings ? '保存中...' : '保存项目设置' }}
      </button>
    </div>

    <div class="video-preview-container" v-if="videoPlayerSrc">
      <video :src="videoPlayerSrc" controls></video>
    </div>
  </div>
</template>

<style scoped>
.project-setup-import-component {
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 20px;
}

.input-group {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.input-group label {
  margin-right: 10px;
  font-size: 0.9em;
  width: 80px; 
}

.input-group input {
  padding: 0.5em 0.8em;
  font-size: 0.9em;
  border: 1px solid #ccc;
  border-radius: 4px;
  flex-grow: 1; 
}

.input-group input[type="number"] {
  max-width: 100px; 
  flex-grow: 0;
}

.import-controls {
  display: flex;
  justify-content: center; 
  gap: 15px; 
  margin-top: 10px;
  margin-bottom: 20px;
}

.import-controls button {
  padding: 0.7em 1.2em; /* Adjusted padding for better fit */
  font-size: 0.95em; /* Slightly smaller font */
}

.save-settings-button {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}
.save-settings-button:hover {
  background-color: #0056b3;
  border-color: #0056b3;
}
.save-settings-button:disabled {
  background-color: #cccccc;
  border-color: #bbbbbb;
  color: #666666;
  cursor: not-allowed;
}

.video-preview-container {
  display: flex;
  justify-content: center;
  margin-top: 15px;
}

.video-preview-container video {
  max-width: 100%;
  width: 480px; 
  max-height: 320px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #000; 
}

@media (prefers-color-scheme: dark) {
  .project-setup-import-component {
    border-color: #555;
  }
  .input-group label {
    color: #f0f0f0;
  }
  .input-group input {
    background-color: #2f2f2f;
    color: #f0f0f0;
    border-color: #555;
  }
  .input-group input:disabled,
  .import-controls button:disabled { /* Apply disabled style to import button too */
    background-color: #444;
    color: #888;
    border-color: #505050;
  }
  .save-settings-button {
    background-color: #378CE7;
    border-color: #378CE7;
    color: #e0e0e0;
  }
  .save-settings-button:hover {
    background-color: #2a79c4;
    border-color: #2a79c4;
  }
  .save-settings-button:disabled {
    background-color: #555;
    border-color: #666;
    color: #aaa;
  }
  .video-preview-container video {
    border-color: #555;
  }
}
</style> 