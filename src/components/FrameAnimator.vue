<script setup>
import { ref, watch, onMounted, onBeforeUnmount, defineEmits } from 'vue';

const props = defineProps({
  frames: {
    type: Array,
    required: true,
    default: () => []
  },
  fps: {
    type: Number,
    required: true,
    default: 10
  }
});

const emit = defineEmits(['range-selected']);

const isPlaying = ref(false);
const animationTimerId = ref(null);
const currentFrameSrc = ref('');
const currentFrameIndex = ref(0);

const inputStartIndex = ref(0);
const inputEndIndex = ref(null);

function playAnimation() {
  if (props.frames.length === 0 || props.fps <= 0) return;
  
  isPlaying.value = true;
  if (animationTimerId.value) {
    clearInterval(animationTimerId.value);
  }
  animationTimerId.value = setInterval(() => {
    currentFrameIndex.value = (currentFrameIndex.value + 1) % props.frames.length;
    currentFrameSrc.value = props.frames[currentFrameIndex.value];
  }, 1000 / props.fps);
}

function stopAnimation() {
  if (animationTimerId.value) {
    clearInterval(animationTimerId.value);
    animationTimerId.value = null;
  }
  isPlaying.value = false;
}

function togglePlayAnimation() {
  if (props.frames.length === 0) return;
  if (isPlaying.value) {
    stopAnimation();
  } else {
    if (!currentFrameSrc.value && props.frames.length > 0) {
      currentFrameIndex.value = 0;
      currentFrameSrc.value = props.frames[currentFrameIndex.value];
    }
    playAnimation();
  }
}

function handleSetRange() {
  const start = Math.max(0, Number(inputStartIndex.value) || 0);
  let end = inputEndIndex.value === null || inputEndIndex.value === '' ? null : Number(inputEndIndex.value);

  if (end !== null && end < start) {
    end = start; 
  }
  if (props.frames.length > 0) {
      const maxIndex = props.frames.length - 1;
      if (end !== null && end > maxIndex) {
          end = maxIndex;
      }
      if (start > maxIndex) {
      }
  } else if (end !== null) {
      end = null;
  }

  emit('range-selected', { 
    start: start, 
    end: end === null ? props.frames.length - 1 : end
  });
  console.log(`FrameAnimator emitted range-selected: Start: ${start}, End: ${end === null ? props.frames.length -1 : end}`);
}

watch(() => props.frames, (newFrames) => {
  stopAnimation();
  currentFrameIndex.value = 0;
  if (newFrames && newFrames.length > 0) {
    currentFrameSrc.value = newFrames[0];
    inputStartIndex.value = 0;
    inputEndIndex.value = null;
  } else {
    currentFrameSrc.value = '';
  }
}, { immediate: true });

watch(() => props.fps, (newFps) => {
  if (isPlaying.value && newFps > 0 && props.frames.length > 0) {
    stopAnimation(); 
    playAnimation();
  }
});

onBeforeUnmount(() => {
  stopAnimation();
});

onMounted(() => {
  if (!currentFrameSrc.value && props.frames && props.frames.length > 0) {
    currentFrameSrc.value = props.frames[0];
  }
});

</script>

<template>
  <div class="animation-section-component">
    <div class="animation-controls">
      <button @click="togglePlayAnimation" :disabled="frames.length === 0">
        {{ isPlaying ? '暂停动画' : '播放动画' }}
      </button>
      <span class="fps-display">动画FPS: {{ fps }}</span>
    </div>
    
    <div class="range-settings-controls">
      <div class="input-group-control">
        <label for="anim-start-index">开始帧 (0-indexed):</label>
        <input type="number" id="anim-start-index" v-model.number="inputStartIndex" min="0" :max="frames.length > 0 ? frames.length - 1 : 0" :disabled="frames.length === 0">
      </div>
      <div class="input-group-control">
        <label for="anim-end-index">结束帧 (0-indexed, 留空则至末尾):</label>
        <input type="number" id="anim-end-index" v-model.number="inputEndIndex" min="0" :max="frames.length > 0 ? frames.length - 1 : 0" placeholder="末尾" :disabled="frames.length === 0">
      </div>
      <button @click="handleSetRange" class="set-range-button" :disabled="frames.length === 0">设置范围</button>
    </div>

    <div class="animation-player">
      <img 
        v-if="currentFrameSrc"
        :src="currentFrameSrc" 
        alt="动画预览" 
        class="animation-preview-img"
      />
      <div v-else-if="frames.length > 0" class="placeholder-text">点击播放预览</div>
      <div v-else class="placeholder-text">暂无帧可播放</div>
    </div>
  </div>
</template>

<style scoped>
.animation-section-component {
  margin-top: 20px;
  padding: 15px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.animation-controls {
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 15px;
}

.animation-controls button {
  padding: 0.5em 1em;
}

.fps-display {
  font-size: 0.9em;
  color: #555;
}

.range-settings-controls {
  display: flex;
  justify-content: center;
  align-items: center; 
  gap: 15px; 
  padding: 10px 0;
  margin-bottom: 15px;
  border-radius: 6px;
  flex-wrap: wrap; 
}

.input-group-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-group-control label {
  font-size: 0.85em;
  white-space: nowrap; 
}

.input-group-control input[type="number"] {
  width: 65px; 
  padding: 0.3em 0.5em;
  font-size: 0.85em;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.set-range-button {
  padding: 0.4em 0.8em;
  font-size: 0.85em;
  border: 1px solid #28a745;
  background-color: #28a745;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.set-range-button:hover {
  background-color: #218838;
}
.set-range-button:disabled {
  background-color: #cccccc;
  border-color: #bbbbbb;
  cursor: not-allowed;
}

.animation-player {
  width: 100%;
  max-width: 300px; 
  height: 200px;   
  background-color: #eee;
  border: 1px solid #ddd;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden; 
}

.animation-preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.placeholder-text {
  font-size: 0.9em;
  color: #777;
}

@media (prefers-color-scheme: dark) {
  .animation-section-component {
    background-color: #3a3a3a;
    border-color: #555;
  }
  .fps-display {
    color: #bbb;
  }
  .input-group-control label {
    color: #f0f0f0; 
  }
  .input-group-control input[type="number"] {
    background-color: #2f2f2f;
    color: #f0f0f0;
    border-color: #555;
  }
   .input-group-control input[type="number"]:disabled {
    background-color: #444;
    color: #888;
  }
  .set-range-button {
    border-color: #378CE7;
    background-color: #378CE7;
    color: #e0e0e0;
  }
  .set-range-button:hover {
    background-color: #2a79c4;
  }
  .set-range-button:disabled {
    background-color: #555;
    border-color: #666;
    color: #aaa;
  }
  .animation-player {
    background-color: #2c2c2c;
    border-color: #444;
  }
  .placeholder-text {
    color: #aaa;
  }
}
</style> 