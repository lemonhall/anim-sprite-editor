<script setup>
import { ref, watch, onMounted, onBeforeUnmount, defineEmits, computed } from 'vue';

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
const currentFrameDisplayIndex = ref(0);

const inputStartIndex = ref(0);
const inputEndIndex = ref(null);

// Internal state for the actual playback range
const actualPlaybackStartIndex = ref(0);
const actualPlaybackEndIndex = ref(0);

// Computed property for the length of the current animation sequence
const currentSequenceLength = computed(() => {
  if (!props.frames || props.frames.length === 0 || actualPlaybackEndIndex.value < actualPlaybackStartIndex.value) {
    return 0;
  }
  return actualPlaybackEndIndex.value - actualPlaybackStartIndex.value + 1;
});

function resetAnimationToCurrentRangeStart() {
  stopAnimation();
  if (props.frames.length > 0 && 
      actualPlaybackStartIndex.value >= 0 && 
      actualPlaybackStartIndex.value < props.frames.length &&
      actualPlaybackStartIndex.value <= actualPlaybackEndIndex.value) {
    currentFrameDisplayIndex.value = actualPlaybackStartIndex.value;
    currentFrameSrc.value = props.frames[currentFrameDisplayIndex.value];
  } else if (props.frames.length > 0) { // Fallback to first frame if range is weird but frames exist
    currentFrameDisplayIndex.value = 0;
    currentFrameSrc.value = props.frames[0];
  } else {
    currentFrameSrc.value = ''; // No frames, clear image
    currentFrameDisplayIndex.value = 0;
  }
}

function playAnimation() {
  if (currentSequenceLength.value <= 0 || props.fps <= 0) {
    stopAnimation(); // Ensure it's stopped if conditions aren't met
    return;
  }
  
  isPlaying.value = true;
  if (animationTimerId.value) {
    clearInterval(animationTimerId.value);
  }

  // Ensure currentFrameDisplayIndex is within the current playback range before starting
  if (currentFrameDisplayIndex.value < actualPlaybackStartIndex.value || 
      currentFrameDisplayIndex.value > actualPlaybackEndIndex.value) {
    currentFrameDisplayIndex.value = actualPlaybackStartIndex.value;
  }
  // Update src just in case it wasn't set by the above, or if it's the first play
  if (currentFrameDisplayIndex.value >=0 && currentFrameDisplayIndex.value < props.frames.length) {
      currentFrameSrc.value = props.frames[currentFrameDisplayIndex.value];
  }

  animationTimerId.value = setInterval(() => {
    let positionInSequence = currentFrameDisplayIndex.value - actualPlaybackStartIndex.value;
    positionInSequence = (positionInSequence + 1) % currentSequenceLength.value;
    currentFrameDisplayIndex.value = actualPlaybackStartIndex.value + positionInSequence;
    currentFrameSrc.value = props.frames[currentFrameDisplayIndex.value];
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
  if (currentSequenceLength.value === 0) return; // Can't play if no valid sequence

  if (isPlaying.value) {
    stopAnimation();
  } else {
    // If current display is outside new range, or no src, reset to start of current range
    if (currentFrameDisplayIndex.value < actualPlaybackStartIndex.value || 
        currentFrameDisplayIndex.value > actualPlaybackEndIndex.value || 
        !currentFrameSrc.value) {
      if (actualPlaybackStartIndex.value >= 0 && actualPlaybackStartIndex.value < props.frames.length) {
        currentFrameDisplayIndex.value = actualPlaybackStartIndex.value; 
        currentFrameSrc.value = props.frames[currentFrameDisplayIndex.value];
      } else {
        return; // Cannot start if actualPlaybackStartIndex is invalid
      }
    }
    playAnimation();
  }
}

function handleSetRange() {
  const newStartInput = Number(inputStartIndex.value) || 0;
  const newEndInput = inputEndIndex.value; // Can be null, empty, or number

  let finalStart = Math.max(0, newStartInput);
  let finalEnd;

  if (props.frames.length === 0) {
    actualPlaybackStartIndex.value = 0;
    actualPlaybackEndIndex.value = 0;
    resetAnimationToCurrentRangeStart(); 
    emit('range-selected', { start: 0, end: 0 });
    return;
  }

  const maxFrameIdx = props.frames.length - 1;
  finalStart = Math.min(finalStart, maxFrameIdx); // Cannot be more than max index

  if (newEndInput === null || newEndInput === '' || typeof newEndInput !== 'number') {
    finalEnd = maxFrameIdx; // Default to last frame
  } else {
    finalEnd = Number(newEndInput);
  }

  // Ensure end is not less than start, and not more than max frame index
  finalEnd = Math.min(Math.max(finalStart, finalEnd), maxFrameIdx);
  
  actualPlaybackStartIndex.value = finalStart;
  actualPlaybackEndIndex.value = finalEnd;

  resetAnimationToCurrentRangeStart(); 
  emit('range-selected', { start: actualPlaybackStartIndex.value, end: actualPlaybackEndIndex.value });
  console.log(`FrameAnimator emitted range-selected & set playback range: Start: ${actualPlaybackStartIndex.value}, End: ${actualPlaybackEndIndex.value}`);
}


watch(() => props.frames, (newFrames) => {
  stopAnimation();
  inputStartIndex.value = 0;
  inputEndIndex.value = null;

  if (newFrames && newFrames.length > 0) {
    actualPlaybackStartIndex.value = 0;
    actualPlaybackEndIndex.value = newFrames.length - 1;
    currentFrameDisplayIndex.value = 0; 
    currentFrameSrc.value = newFrames[0]; 
  } else {
    actualPlaybackStartIndex.value = 0;
    actualPlaybackEndIndex.value = 0; 
    currentFrameDisplayIndex.value = 0;
    currentFrameSrc.value = ''; 
  }
}, { immediate: true }); 

watch(() => props.fps, (newFps) => {
  if (isPlaying.value && newFps > 0 && currentSequenceLength.value > 0) {
    // No need to reset currentFrameDisplayIndex here, just restart with new speed
    stopAnimation(); 
    playAnimation(); 
  }
});

onBeforeUnmount(() => {
  stopAnimation();
});

// onMounted is effectively handled by immediate watch on props.frames

</script>

<template>
  <div class="animation-section-component">
    <div class="animation-controls">
      <button @click="togglePlayAnimation" :disabled="currentSequenceLength === 0">
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
        :alt="`动画预览帧 ${currentFrameDisplayIndex}`" 
        class="animation-preview-img"
      />
      <div v-else-if="frames.length > 0" class="placeholder-text">设置范围并播放</div>
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