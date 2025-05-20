<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';

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

const isPlaying = ref(false);
const animationTimerId = ref(null);
const currentFrameSrc = ref('');
const currentFrameIndex = ref(0);

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
    // Ensure the first frame is shown if currentFrameSrc is empty before starting
    if (!currentFrameSrc.value && props.frames.length > 0) {
      currentFrameIndex.value = 0; // Start from the beginning
      currentFrameSrc.value = props.frames[currentFrameIndex.value];
    }
    playAnimation();
  }
}

watch(() => props.frames, (newFrames) => {
  stopAnimation();
  currentFrameIndex.value = 0;
  if (newFrames && newFrames.length > 0) {
    currentFrameSrc.value = newFrames[0]; // Default to showing the first frame
  } else {
    currentFrameSrc.value = ''; // Clear if no frames
  }
}, { immediate: true }); // immediate: true to set initial frame

watch(() => props.fps, (newFps) => {
  if (isPlaying.value && newFps > 0 && props.frames.length > 0) {
    stopAnimation(); 
    playAnimation(); // Restart with new FPS
  }
});

// Cleanup timer when component is unmounted
onBeforeUnmount(() => {
  stopAnimation();
});

// Set initial frame on mount if not already set by immediate watcher
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
  /* Assuming global button styles are available or define specific ones */
}

.fps-display {
  font-size: 0.9em;
  color: #555;
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
</style> 