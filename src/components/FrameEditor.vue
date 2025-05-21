<script setup>
import { ref, watch, onMounted, nextTick, computed } from 'vue';
import useGlobalImageOperations from '../composables/useGlobalImageOperations';
import useFrameCropper from '../composables/useFrameCropper';

const props = defineProps({
  frameToEdit: { // Expected: { src: 'image_source_path', index: frame_index, originalSrc: 'original_asset_path_for_saving_if_needed' }
    type: Object,
    default: null
  },
  // Props from App.vue to be passed to useGlobalImageOperations
  projectExtractedFrames: {
    type: Object, // This is a ref, Vue handles unwrapping in template, direct use in script needs .value
    required: true
  },
  projectOriginalFramePaths: {
    type: Object, // This is a ref
    required: true
  },
  // Changed props for message handling
  processingMessageString: { // Current string value of the message
    type: String,
    default: ''
  },
  updateAppProcessingMessage: { // Function to update the message in App.vue
    type: Function,
    required: true
  }
});

console.log("[FrameEditor] Initial props.projectOriginalFramePaths:", props.projectOriginalFramePaths);
console.log("[FrameEditor] Initial props.projectOriginalFramePaths.value:", props.projectOriginalFramePaths ? props.projectOriginalFramePaths.value : 'props.projectOriginalFramePaths is falsy');
console.log("[FrameEditor] Initial props.projectExtractedFrames:", props.projectExtractedFrames);
console.log("[FrameEditor] Initial props.projectExtractedFrames.value:", props.projectExtractedFrames ? props.projectExtractedFrames.value : 'props.projectExtractedFrames is falsy');

const emit = defineEmits(['update-frame', 'cancel-edit', 'frames-globally-updated']);

const canvasRef = ref(null);
const ctx = ref(null);

// --- State for Cropping ---
const originalImageForCropping = ref(null); // Stores the original Image object
const canvasDisplaySize = ref({ width: 0, height: 0 }); // Keep for display scaling logic if needed elsewhere, or remove if only for getMousePos
// --- End State for Cropping ---

// Use a computed property to get the initial string value for the composable
const initialMessageForComposable = computed(() => props.processingMessageString);

// Initialize the global image operations composable
const {
  isProcessingGlobal, // Optional: use this to show a local loading state in FrameEditor
  applyGlobalCrop
} = useGlobalImageOperations(
  { // projectManagementRefs
    extractedFrames: props.projectExtractedFrames,
    originalFrameFilePaths: props.projectOriginalFramePaths,
  },
  { // messageUpdater
    initialProcessingMessage: props.processingMessageString, // Pass the initial string value directly
    updateProcessingMessage: props.updateAppProcessingMessage // Pass the update function from App.vue
  }
);

// Initialize the frame cropper composable
const { 
  cropRect, // Get reactive cropRect from the composable
  handleMouseDown: cropperMouseDown, 
  handleMouseMove: cropperMouseMove, 
  handleMouseUpOrLeave: cropperMouseUpOrLeave,
  resetCrop: cropperResetCrop,
  drawCropSelection
} = useFrameCropper(canvasRef, originalImageForCropping, () => redrawCanvas()); // Pass redrawCanvas as a callback

const redrawCanvas = () => {
  if (!ctx.value || !canvasRef.value) return;
  const canvas = canvasRef.value;
  const context = ctx.value;

  // Clear canvas
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the original image
  if (originalImageForCropping.value) {
    context.drawImage(originalImageForCropping.value, 0, 0, canvas.width, canvas.height);
  }

  // Draw the crop rectangle using the composable's function
  drawCropSelection(context); // Call the drawing function from useFrameCropper
};

const drawImageOnCanvas = async () => {
  if (!canvasRef.value || !props.frameToEdit || !props.frameToEdit.src) {
    if (ctx.value) {
      ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    }
    originalImageForCropping.value = null;
    return;
  }

  const img = new Image();
  img.onload = async () => {
    originalImageForCropping.value = img; // This will trigger the watch in useFrameCropper to reset crop
    if (canvasRef.value) {
      canvasRef.value.width = img.naturalWidth;
      canvasRef.value.height = img.naturalHeight;

      await nextTick(); 

      const rect = canvasRef.value.getBoundingClientRect();
      canvasDisplaySize.value = { width: rect.width, height: rect.height };
      
      console.log("Canvas natural/display:", 
                  img.naturalWidth, img.naturalHeight, 
                  canvasDisplaySize.value.width, canvasDisplaySize.value.height);

      redrawCanvas(); 
    }
  };
  img.onerror = (e) => {
    console.error("Error loading image for canvas:", e);
    originalImageForCropping.value = null;
    if (canvasRef.value && ctx.value) {
      ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    }
  };
  img.src = props.frameToEdit.src;
};

onMounted(() => {
  if (canvasRef.value) {
    ctx.value = canvasRef.value.getContext('2d');
    drawImageOnCanvas();
  }
});

watch(() => props.frameToEdit, (newFrame) => {
  console.log("[FrameEditor] frameToEdit prop changed:", newFrame);
  // Ensure canvas context is ready and reset crop state
  if (canvasRef.value && !ctx.value) { 
    ctx.value = canvasRef.value.getContext('2d');
  }
  drawImageOnCanvas(); 
}, { deep: true });

// --- Function to handle Reset Crop ---
const handleResetCrop = () => {
  cropperResetCrop(); // Call the reset function from useFrameCropper
  console.log("[FrameEditor] Crop reset requested.");
};
// --- End Function to handle Reset Crop ---

// --- Function to handle Apply Crop to All Frames ---
const handleApplyCropToAllFrames = async () => {
  if (!cropRect.value.hasSelection || cropRect.value.size <= 0) {
    props.updateAppProcessingMessage("请先在当前帧上选择一个裁剪区域。");
    return;
  }

  console.log("[FrameEditor] projectOriginalFramePaths.value before applyGlobalCrop:", props.projectOriginalFramePaths);

  const cropParamsToApply = {
    x: cropRect.value.x,
    y: cropRect.value.y,
    width: cropRect.value.size,
    height: cropRect.value.size, // Assuming square crop
  };

  props.updateAppProcessingMessage("正在应用全局裁剪...");
  console.log(`[FrameEditor] Applying crop to all frames with params:`, cropParamsToApply);
  
  const success = await applyGlobalCrop(cropParamsToApply); // from useGlobalImageOperations

  if (success) {
    console.log('[FrameEditor] Global crop reported success from composable, emitting frames-source-files-updated.');
    emit('frames-source-files-updated');
  } else {
    console.log('[FrameEditor] Global crop failed or was not attempted successfully according to composable.');
    if (projectManagementRefs && typeof projectManagementRefs.updateProcessingMessage === 'function') {
      projectManagementRefs.updateProcessingMessage('全局裁剪操作未成功或后端未确认成功。');
    } else {
      console.warn("[FrameEditor] Cannot update processing message: projectManagementRefs.updateProcessingMessage is not available.");
    }
  }
};
// --- End Function to handle Apply Crop to All Frames ---

const saveChanges = () => {
  if (!canvasRef.value || !props.frameToEdit) return;
  const imageDataUrl = canvasRef.value.toDataURL('image/png'); // Or appropriate format
  emit('update-frame', { index: props.frameToEdit.index, newSrcDataUrl: imageDataUrl });
  // Potentially also emit the originalSrc if App.vue needs to replace the file on disk later
};

const cancelEdit = () => {
  emit('cancel-edit');
};

</script>

<template>
  <div v-if="frameToEdit" class="frame-editor-component">
    <h3>编辑帧 #{{ frameToEdit.index }}</h3>
    <canvas 
      ref="canvasRef" 
      class="editor-canvas"
      @mousedown="cropperMouseDown"
      @mousemove="cropperMouseMove"
      @mouseup="cropperMouseUpOrLeave"
      @mouseleave="cropperMouseUpOrLeave"
    ></canvas>
    <div class="editor-controls">
      <button @click="saveChanges">保存更改</button>
      <button @click="cancelEdit">取消</button>
      <button @click="handleApplyCropToAllFrames" :disabled="isProcessingGlobal">{{ isProcessingGlobal ? '处理中...' : '应用到所有帧' }}</button>
      <button @click="handleResetCrop" :disabled="isProcessingGlobal">重置裁剪</button>
    </div>
  </div>
</template>

<style scoped>
.frame-editor-component {
  margin-top: 20px;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.editor-canvas {
  border: 1px solid #000;
  margin-bottom: 15px;
  max-width: 100%; /* Ensure canvas is responsive */
  height: auto;   /* Maintain aspect ratio */
}
.editor-controls button {
  margin: 0 5px;
  padding: 8px 15px;
}

@media (prefers-color-scheme: dark) {
  .frame-editor-component {
    border-color: #555;
    background-color: #3a3a3a;
  }
  .editor-canvas {
    border-color: #777;
  }
   .editor-controls button {
    background-color: #555;
    color: #eee;
    border: 1px solid #777;
  }
  .editor-controls button:hover {
    background-color: #666;
  }
}
</style> 