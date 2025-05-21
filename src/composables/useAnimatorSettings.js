import { ref, computed } from 'vue';

export default function useAnimatorSettings() {
  const playbackFps = ref(10);
  const startIndex = ref(0);
  const endIndex = ref(null); // null means end of frames, matching animatorSettings.value.endIndex logic
  const totalFrames = ref(0);

  // This will be used by FrameThumbnailsGrid for highlighting
  // It mirrors currentSelectedRangeForGrid logic from App.vue
  const currentSelectedRangeForGrid = computed(() => ({
    start: startIndex.value,
    end: endIndex.value === null 
         ? (totalFrames.value > 0 ? totalFrames.value - 1 : -1) // If null, use last frame or -1 if no frames
         : endIndex.value
  }));

  // --- Computed properties for FrameAnimator props ---
  const initialPlaybackFpsForAnimator = computed(() => playbackFps.value);
  const initialStartIndexForAnimator = computed(() => startIndex.value);
  const initialEndIndexForAnimator = computed(() => {
    // FrameAnimator expects an actual end index
    if (endIndex.value === null) {
      return totalFrames.value > 0 ? totalFrames.value - 1 : 0; 
    }
    return endIndex.value;
  });

  // --- Computed properties for saving project settings ---
  // This replaces playbackSettingsForSave and totalFramesForSave from App.vue
  const animatorSettingsForSave = computed(() => ({
    playbackFps: playbackFps.value,
    animationStartIndex: startIndex.value,
    // Ensure endIndex saved is consistent: actual number or null if appropriate
    animationEndIndex: endIndex.value === null && totalFrames.value > 0 
                         ? totalFrames.value - 1 
                         : (totalFrames.value === 0 ? null : endIndex.value),
    totalFrames: totalFrames.value,
  }));

  // --- Methods to update settings ---
  function updatePlaybackSettings(newSettings) {
    console.log("[useAnimatorSettings] Updating playback settings:", newSettings);
    if (newSettings.playbackFps !== undefined) playbackFps.value = newSettings.playbackFps;
    if (newSettings.startIndex !== undefined) startIndex.value = newSettings.startIndex;
    if (newSettings.endIndex !== undefined) endIndex.value = newSettings.endIndex;
  }

  function updateRangeSelection(payload) {
    console.log("[useAnimatorSettings] Updating range selection:", payload);
    if (payload.start !== undefined) startIndex.value = payload.start;
    if (payload.end !== undefined) endIndex.value = payload.end;
  }

  function initializeAnimatorOnNewVideo(newTotalFrames, extractionFps) {
    console.log(`[useAnimatorSettings] Initializing for new video. Total Frames: ${newTotalFrames}, Extraction FPS: ${extractionFps}`);
    totalFrames.value = newTotalFrames;
    playbackFps.value = extractionFps; // Default playback to extraction FPS
    startIndex.value = 0;
    endIndex.value = newTotalFrames > 0 ? newTotalFrames - 1 : null;
  }

  function loadAnimatorFromMetadata(loadedData, defaultExtractionFps) {
    console.log("[useAnimatorSettings] Loading from metadata:", loadedData);
    const newTotalFrames = typeof loadedData.totalFrames === 'number' ? loadedData.totalFrames : 0;
    totalFrames.value = newTotalFrames;
    
    playbackFps.value = typeof loadedData.playbackFps === 'number' 
                        ? loadedData.playbackFps 
                        : defaultExtractionFps;
                        
    startIndex.value = typeof loadedData.animationStartIndex === 'number' 
                       ? loadedData.animationStartIndex 
                       : 0;

    let newEndIndex = loadedData.animationEndIndex; // Can be number or null

    if (newTotalFrames === 0) {
        newEndIndex = null;
    } else {
        if (typeof newEndIndex !== 'number' || newEndIndex === null) { // if undefined, null, or other invalid type for calculation
            newEndIndex = newTotalFrames > 0 ? newTotalFrames - 1 : null;
        } else if (newEndIndex >= newTotalFrames) {
            newEndIndex = newTotalFrames - 1;
        }
    }
    endIndex.value = newEndIndex;

    // Ensure start is not > end if both are numbers and totalFrames > 0
    if (newTotalFrames > 0 && 
        typeof startIndex.value === 'number' && 
        typeof endIndex.value === 'number' && 
        startIndex.value > endIndex.value) {
        startIndex.value = endIndex.value; 
    }
     // Ensure startIndex is within bounds
    if (newTotalFrames > 0 && startIndex.value >= newTotalFrames) {
        startIndex.value = newTotalFrames -1;
    }
    if (startIndex.value < 0) startIndex.value = 0;
  }

  return {
    // Reactive state (directly or via computed if transformations needed)
    playbackFps, 
    startIndex,    
    endIndex,      
    totalFrames,   

    // Computed properties for UI binding / derived state
    currentSelectedRangeForGrid,
    initialPlaybackFpsForAnimator,
    initialStartIndexForAnimator,
    initialEndIndexForAnimator,
    animatorSettingsForSave, 

    // Methods
    updatePlaybackSettings,
    updateRangeSelection,
    initializeAnimatorOnNewVideo,
    loadAnimatorFromMetadata,
  };
} 