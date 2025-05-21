import { ref } from 'vue';

export default function useFrameEditing(extractedFramesRef, processingMessageRef) {
  const frameBeingEdited = ref(null); // Stores { index, src }

  function requestEditFrame(frameIndex) {
    if (frameIndex >= 0 && frameIndex < extractedFramesRef.value.length) {
      const frameSrc = extractedFramesRef.value[frameIndex];
      frameBeingEdited.value = {
        index: frameIndex,
        src: frameSrc, // This could be an asset URL or a data URL if already edited
      };
      console.log("[useFrameEditing] Editing frame:", frameBeingEdited.value);
    } else {
      console.warn("[useFrameEditing] Invalid frame index for editing:", frameIndex);
      if (processingMessageRef) {
        processingMessageRef.value = `无效的帧索引: ${frameIndex}`;
      }
      frameBeingEdited.value = null;
    }
  }

  function confirmFrameUpdate(payload) {
    // This function doesn't directly modify extractedFrames.
    // It signals that an update is ready. App.vue will handle the actual update.
    console.log("[useFrameEditing] Frame update confirmed (payload from editor):", payload);
    if (payload && payload.index >= 0 && payload.index < extractedFramesRef.value.length) {
      // The actual update of extractedFramesRef.value[payload.index] = payload.newSrcDataUrl;
      // will be done in App.vue after this function's successful execution or based on its return.
      // For now, this composable just manages the frameBeingEdited state.
      if (processingMessageRef) {
        processingMessageRef.value = `帧 #${payload.index} 准备更新。`;
      }
      frameBeingEdited.value = null; 
      return true; // Indicate success for App.vue to proceed with update
    }
    if (processingMessageRef) {
        processingMessageRef.value = `帧更新失败，无效的数据。`;
    }
    frameBeingEdited.value = null; // Also clear on failure to prevent inconsistent state
    return false; // Indicate failure
  }

  function cancelFrameEdit() {
    console.log("[useFrameEditing] Frame editing cancelled.");
    frameBeingEdited.value = null;
    if (processingMessageRef) {
      processingMessageRef.value = "帧编辑已取消。";
    }
  }

  return {
    frameBeingEdited,
    requestEditFrame,
    confirmFrameUpdate, // Renamed from handleFrameUpdated for clarity
    cancelFrameEdit,    // Renamed from handleCancelEdit
  };
} 