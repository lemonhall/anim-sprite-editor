<script setup>
import { ref, watch, onMounted, onBeforeUnmount, defineEmits, computed } from 'vue';

const props = defineProps({
  frames: {
    type: Array,
    required: true,
    default: () => []
  },
  extractionFps: { // Renamed from fps to be clear this is from video processing
    type: Number,
    required: true,
    default: 10
  },
  // New props for initial settings from loaded project metadata
  initialPlaybackFps: { 
    type: Number,
    default: null // Will use extractionFps if null
  },
  initialStartIndex: { 
    type: Number, 
    default: 0 
  },
  initialEndIndex: { 
    type: Number, 
    default: null // null means to the end
  }
});

const emit = defineEmits(['range-selected', 'playback-settings-changed', 'export-frames-requested']); // Added export-frames-requested

const isPlaying = ref(false);
const animationTimerId = ref(null);
const currentFrameSrc = ref('');
const currentFrameDisplayIndex = ref(0); 

// Input state
const inputStartIndex = ref(0);
const inputEndIndex = ref(null);
const playbackFpsInput = ref(10); // For the new playback FPS input field

// Internal state for the actual playback range & FPS
const actualPlaybackStartIndex = ref(0);
const actualPlaybackEndIndex = ref(0);
// actualPlaybackFps is not needed as a separate ref, playbackFpsInput will be the source of truth for UI and logic

const currentSequenceLength = computed(() => {
  if (!props.frames || props.frames.length === 0 || actualPlaybackEndIndex.value < actualPlaybackStartIndex.value) {
    return 0;
  }
  return actualPlaybackEndIndex.value - actualPlaybackStartIndex.value + 1;
});

function updateInternalStateFromInitialProps() {
  playbackFpsInput.value = props.initialPlaybackFps !== null ? props.initialPlaybackFps : props.extractionFps;
  inputStartIndex.value = props.initialStartIndex;
  inputEndIndex.value = props.initialEndIndex;
  
  // Also directly set the actual playback parameters from these initial values
  // This logic is similar to parts of handleSetRange, but for initialization
  let newStart = Number(props.initialStartIndex) || 0;
  let newEnd = props.initialEndIndex;

  if (props.frames.length === 0) {
    actualPlaybackStartIndex.value = 0;
    actualPlaybackEndIndex.value = 0;
  } else {
    const maxFrameIdx = props.frames.length - 1;
    newStart = Math.max(0, Math.min(newStart, maxFrameIdx));

    if (newEnd === null || typeof newEnd !== 'number') {
      newEnd = maxFrameIdx;
    } else {
      newEnd = Number(newEnd);
    }
    newEnd = Math.min(Math.max(newStart, newEnd), maxFrameIdx);
    
    actualPlaybackStartIndex.value = newStart;
    actualPlaybackEndIndex.value = newEnd;
  }
  resetAnimationToCurrentRangeStart();
}

function resetAnimationToCurrentRangeStart() {
  stopAnimation();
  if (props.frames.length > 0 && 
      actualPlaybackStartIndex.value >= 0 && 
      actualPlaybackStartIndex.value < props.frames.length &&
      actualPlaybackStartIndex.value <= actualPlaybackEndIndex.value) {
    currentFrameDisplayIndex.value = actualPlaybackStartIndex.value;
    currentFrameSrc.value = props.frames[currentFrameDisplayIndex.value];
  } else if (props.frames.length > 0) { 
    currentFrameDisplayIndex.value = 0;
    currentFrameSrc.value = props.frames[0];
  } else {
    currentFrameSrc.value = ''; 
    currentFrameDisplayIndex.value = 0;
  }
}

function playAnimation() {
  if (currentSequenceLength.value <= 0 || playbackFpsInput.value <= 0) {
    stopAnimation(); 
    return;
  }
  
  isPlaying.value = true;
  if (animationTimerId.value) clearInterval(animationTimerId.value);

  if (currentFrameDisplayIndex.value < actualPlaybackStartIndex.value || 
      currentFrameDisplayIndex.value > actualPlaybackEndIndex.value) {
    currentFrameDisplayIndex.value = actualPlaybackStartIndex.value;
  }
  if (currentFrameDisplayIndex.value >=0 && currentFrameDisplayIndex.value < props.frames.length) {
      currentFrameSrc.value = props.frames[currentFrameDisplayIndex.value];
  }

  animationTimerId.value = setInterval(() => {
    let positionInSequence = currentFrameDisplayIndex.value - actualPlaybackStartIndex.value;
    positionInSequence = (positionInSequence + 1) % currentSequenceLength.value;
    currentFrameDisplayIndex.value = actualPlaybackStartIndex.value + positionInSequence;
    currentFrameSrc.value = props.frames[currentFrameDisplayIndex.value];
  }, 1000 / playbackFpsInput.value);
}

function stopAnimation() {
  if (animationTimerId.value) {
    clearInterval(animationTimerId.value);
    animationTimerId.value = null;
  }
  isPlaying.value = false;
}

function togglePlayAnimation() {
  if (currentSequenceLength.value === 0 && props.frames.length > 0) {
      // If sequence is 0 but frames exist, it might be due to invalid start/end after load.
      // Try to re-evaluate from inputs.
      console.warn("Toggle play: sequence length 0, attempting to set range first.");
      handleSetRange(); // This will update actuals and reset display if needed
      // If still 0 after setRange (e.g. no frames), then return
      if(currentSequenceLength.value === 0) return;
  } else if (currentSequenceLength.value === 0 && props.frames.length === 0) {
    return; // No frames at all, cannot play
  }

  if (isPlaying.value) {
    stopAnimation();
  } else {
    if (currentFrameDisplayIndex.value < actualPlaybackStartIndex.value || 
        currentFrameDisplayIndex.value > actualPlaybackEndIndex.value || 
        !currentFrameSrc.value) {
      if (actualPlaybackStartIndex.value >= 0 && actualPlaybackStartIndex.value < props.frames.length) {
        currentFrameDisplayIndex.value = actualPlaybackStartIndex.value; 
        currentFrameSrc.value = props.frames[currentFrameDisplayIndex.value];
      } else {
        return; 
      }
    }
    playAnimation();
  }
}

function handleSetRange() {
  const newStartInputVal = Number(inputStartIndex.value) || 0;
  const newEndInputVal = inputEndIndex.value;

  let finalStart = Math.max(0, newStartInputVal);
  let finalEnd;

  if (props.frames.length === 0) {
    actualPlaybackStartIndex.value = 0;
    actualPlaybackEndIndex.value = 0;
  } else {
    const maxFrameIdx = props.frames.length - 1;
    finalStart = Math.min(finalStart, maxFrameIdx);
    if (newEndInputVal === null || newEndInputVal === '' || typeof newEndInputVal !== 'number') {
      finalEnd = maxFrameIdx;
    } else {
      finalEnd = Number(newEndInputVal);
    }
    finalEnd = Math.min(Math.max(finalStart, finalEnd), maxFrameIdx);
    
    actualPlaybackStartIndex.value = finalStart;
    actualPlaybackEndIndex.value = finalEnd;
  }
  
  resetAnimationToCurrentRangeStart(); 
  // Emit both events, range-selected for grid, playback-settings-changed for App.vue to save
  emit('range-selected', { start: actualPlaybackStartIndex.value, end: actualPlaybackEndIndex.value });
  emitPlaybackSettingsChanged();
  console.log(`SetRange: Playback range: ${actualPlaybackStartIndex.value}-${actualPlaybackEndIndex.value}`);
}

function handlePlaybackFpsChange() {
    if (playbackFpsInput.value < 1) playbackFpsInput.value = 1;
    if (playbackFpsInput.value > 120) playbackFpsInput.value = 120;
    if (isPlaying.value) {
        stopAnimation();
        playAnimation();
    }
    emitPlaybackSettingsChanged();
}

function emitPlaybackSettingsChanged(){
    emit('playback-settings-changed', {
        playbackFps: Number(playbackFpsInput.value),
        startIndex: actualPlaybackStartIndex.value, // Use the actual applied start index
        endIndex: actualPlaybackEndIndex.value     // Use the actual applied end index
    });
    console.log("Emitted playback-settings-changed");
}

// This function should exist if the button is in the template
function handleExportSelection() {
  if (currentSequenceLength.value > 0 && props.frames.length > 0) {
    emit('export-frames-requested', { 
      startIndex: actualPlaybackStartIndex.value, 
      endIndex: actualPlaybackEndIndex.value 
    });
    console.log(`Export requested for frames from index ${actualPlaybackStartIndex.value} to ${actualPlaybackEndIndex.value}`);
  } else {
    console.warn("Export selection called but no valid sequence or frames available.");
  }
}

// Watch for new frames (e.g. new video processed)
watch(() => props.frames, (newFrames) => {
  stopAnimation();
  // When frames change, re-initialize everything based on new frame data and initial props
  if (newFrames && newFrames.length > 0) {
    updateInternalStateFromInitialProps(); // This will set inputs and actuals
  } else {
    // No frames, reset all relevant state
    inputStartIndex.value = 0;
    inputEndIndex.value = null;
    playbackFpsInput.value = props.extractionFps; // Default to extraction FPS
    actualPlaybackStartIndex.value = 0;
    actualPlaybackEndIndex.value = 0; 
    currentFrameDisplayIndex.value = 0;
    currentFrameSrc.value = ''; 
  }
}, { immediate: true, deep: true }); 

// Watch for changes in initial props if they are updated reactively from App.vue after first load
watch([() => props.initialPlaybackFps, () => props.initialStartIndex, () => props.initialEndIndex, () => props.extractionFps],
  () => {
    console.log("[FrameAnimator] Initial props changed, re-initializing state.");
    updateInternalStateFromInitialProps();
  }, 
  { deep: true } // deep might be overkill if these are just numbers/null
);


onBeforeUnmount(() => {
  stopAnimation();
});

</script>

<template>
  <div class="animation-section-component">
    <div class="animation-controls top-controls">
      <button @click="togglePlayAnimation" :disabled="currentSequenceLength === 0">
        {{ isPlaying ? '暂停动画' : '播放动画' }}
      </button>
      <div class="input-group-control fps-control">
        <label for="playback-fps-input">播放FPS:</label>
        <input 
          type="number" 
          id="playback-fps-input" 
          v-model.number="playbackFpsInput" 
          min="1" 
          max="120"
          @change="handlePlaybackFpsChange" 
          :disabled="frames.length === 0"
        />
      </div>
    </div>
    
    <div class="range-settings-controls">
      <div class="input-group-control">
        <label for="anim-start-index">开始帧:</label>
        <input type="number" id="anim-start-index" v-model.number="inputStartIndex" min="0" :max="frames.length > 0 ? frames.length - 1 : 0" :disabled="frames.length === 0">
      </div>
      <div class="input-group-control">
        <label for="anim-end-index">结束帧:</label>
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
    
    <!-- Ensure this section is present -->
    <div class="export-controls" style="margin-top: 15px;">
      <button 
        @click="handleExportSelection" 
        :disabled="currentSequenceLength === 0 || frames.length === 0"
        class="export-button"
      >
        导出选定帧到 outputs
      </button>
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

.top-controls {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 10px; /* Reduced margin slightly */
}

.top-controls button {
  padding: 0.5em 1em;
}

.fps-control label {
  font-size: 0.85em;
}
.fps-control input {
  width: 60px; /* Slightly smaller for FPS */
  padding: 0.3em 0.5em;
  font-size: 0.85em;
  border: 1px solid #ccc;
  border-radius: 4px;
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
  width: 100%; /* Ensure it takes full width for centering */
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

.export-button { /* Style for the new export button */
  padding: 0.5em 1em;
  border: 1px solid #007bff;
  background-color: #007bff;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.export-button:hover {
  background-color: #0056b3;
}

.export-button:disabled {
  background-color: #cccccc;
  border-color: #bbbbbb;
  color: #666666;
  cursor: not-allowed;
}

@media (prefers-color-scheme: dark) {
  .animation-section-component {
    background-color: #3a3a3a;
    border-color: #555;
  }
  .fps-control label, /* Combined with other labels for dark mode */
  .input-group-control label {
    color: #f0f0f0; 
  }
  .fps-control input, /* Combined with other inputs for dark mode */
  .input-group-control input[type="number"] {
    background-color: #2f2f2f;
    color: #f0f0f0;
    border-color: #555;
  }
  .fps-control input:disabled,
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
  .export-button {
    border-color: #378CE7; /* Using a theme-consistent blue */
    background-color: #378CE7;
    color: #e0e0e0;
  }
  .export-button:hover {
    background-color: #2a79c4;
  }
  .export-button:disabled {
    background-color: #555;
    border-color: #666;
    color: #aaa;
  }
}
</style> 