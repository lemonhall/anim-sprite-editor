<script setup>
import { ref, watch } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';

const emit = defineEmits(['import-ready', 'import-cancelled', 'import-error', 'processing-status']);

const projectName = ref('');
const fps = ref(10);
const videoPlayerSrc = ref(''); // For the preview player in this component
const selectedFilePath = ref(''); // Store the raw path for emitting

async function triggerVideoSelect() {
  try {
    processingStatusUpdate(''); // Clear previous status
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Video',
          extensions: ['mp4'],
        },
      ],
    });

    if (selected) {
      const path = Array.isArray(selected) ? selected[0] : selected;
      selectedFilePath.value = path;
      videoPlayerSrc.value = convertFileSrc(path);
      console.log("Video selected in component:", path);
      checkAndEmitImportReady();

    } else {
      console.log('File selection cancelled.');
      selectedFilePath.value = '';
      videoPlayerSrc.value = '';
      emit('import-cancelled');
      processingStatusUpdate('视频选择已取消。');
    }
  } catch (error) {
    console.error('Error selecting file:', error);
    selectedFilePath.value = '';
    videoPlayerSrc.value = '';
    emit('import-error', `文件选择失败: ${error}`);
    processingStatusUpdate(`文件选择失败: ${error}`);
  }
}

function isProjectNameValid(name) {
  if (!name || !name.trim()) return false;
  return /^[a-zA-Z0-9_-]+$/.test(name.trim());
}

function checkAndEmitImportReady() {
  if (selectedFilePath.value && isProjectNameValid(projectName.value) && fps.value > 0) {
    processingStatusUpdate(''); 
    emit('import-ready', {
      videoPath: selectedFilePath.value,
      projectName: projectName.value.trim(),
      fps: Number(fps.value),
    });
  } else if (selectedFilePath.value && !isProjectNameValid(projectName.value)) {
    processingStatusUpdate('请输入有效的项目名称以准备处理。');
  } else if (selectedFilePath.value && fps.value <=0) {
    processingStatusUpdate('FPS必须大于0。');
  }
}

function processingStatusUpdate(message) {
    emit('processing-status', message);
}

watch(projectName, (newName) => {
  if (selectedFilePath.value) { 
    checkAndEmitImportReady();
  } else if (!isProjectNameValid(newName)) {
    processingStatusUpdate(''); 
  }
});

watch(fps, () => {
  if (selectedFilePath.value) { 
    checkAndEmitImportReady();
  }
});

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
      />
    </div>
    <div class="input-group">
      <label for="fps-input">FPS:</label>
      <input 
        id="fps-input"
        type="number" 
        v-model.number="fps" 
        min="1"
        max="60" 
      />
    </div>
    <div class="import-controls">
      <button @click="triggerVideoSelect">导入视频</button>
    </div>

    <div class="video-preview-container" v-if="videoPlayerSrc">
      <video :src="videoPlayerSrc" controls></video>
    </div>
  </div>
</template>

<style scoped>
.project-setup-import-component {
  padding: 20px;
  border: 1px solid #e0e0e0; /* 保留边框以区分区域 */
  border-radius: 8px;
  margin-bottom: 20px;
  /* background-color: #fcfcfc; */ /* 移除特定的背景颜色 */
}

.input-group {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.input-group label {
  margin-right: 10px;
  font-size: 0.9em;
  width: 80px; /* Fixed width for alignment */
  /* 标签颜色会从父组件继承，或者由全局样式 (如 :root 的 color) 控制 */
}

.input-group input {
  padding: 0.5em 0.8em;
  font-size: 0.9em;
  border: 1px solid #ccc;
  border-radius: 4px;
  flex-grow: 1; 
  /* 输入框的背景色和文字颜色通常由全局 input 样式控制 */
}

.input-group input[type="number"] {
  max-width: 100px; 
  flex-grow: 0;
}

.import-controls {
  display: flex;
  justify-content: center; 
  margin-top: 10px;
  margin-bottom: 20px;
}

.import-controls button {
  padding: 0.7em 1.5em;
  font-size: 1em;
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
</style> 