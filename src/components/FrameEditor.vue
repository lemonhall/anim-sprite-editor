<script setup>
import { ref, watch, onMounted, nextTick, computed } from 'vue';
import useGlobalImageOperations from '../composables/useGlobalImageOperations';

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
const cropRect = ref({ // Stores crop rectangle relative to the original image dimensions
  x: 0,
  y: 0,
  size: 0,
  isSelecting: false,
  hasSelection: false,
});
const startPoint = ref({ x: 0, y: 0 }); // Mouse down start point on canvas
const canvasDisplaySize = ref({ width: 0, height: 0 }); // Actual display size of canvas for scaling mouse coords
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

  // Draw the crop rectangle if selecting or has selection
  if (originalImageForCropping.value && (cropRect.value.isSelecting || cropRect.value.hasSelection) && cropRect.value.size > 0) {
    context.strokeStyle = 'rgba(0, 0, 255, 0.7)';
    context.lineWidth = 2;
    context.setLineDash([5, 5]); // Dashed line
    // Coordinates and size are relative to the original image, scale them to canvas display size
    const displayX = cropRect.value.x * (canvas.width / originalImageForCropping.value.naturalWidth);
    const displayY = cropRect.value.y * (canvas.height / originalImageForCropping.value.naturalHeight);
    const displaySize = cropRect.value.size * (canvas.width / originalImageForCropping.value.naturalWidth); // Assuming square aspect ratio for image on canvas
    
    context.strokeRect(displayX, displayY, displaySize, displaySize);
    context.setLineDash([]); // Reset line dash
  }
};

const drawImageOnCanvas = async () => {
  if (!canvasRef.value || !props.frameToEdit || !props.frameToEdit.src) {
    if (ctx.value) {
      ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    }
    originalImageForCropping.value = null;
    cropRect.value = { x: 0, y: 0, size: 0, isSelecting: false, hasSelection: false };
    return;
  }

  const img = new Image();
  img.onload = async () => {
    originalImageForCropping.value = img; // Store the original image object
    if (canvasRef.value) {
      canvasRef.value.width = img.naturalWidth;
      canvasRef.value.height = img.naturalHeight;

      // Wait for next tick to ensure canvas dimensions are updated in DOM for getBoundingClientRect
      await nextTick(); 

      const rect = canvasRef.value.getBoundingClientRect();
      canvasDisplaySize.value = { width: rect.width, height: rect.height };
      
      console.log("Canvas natural/display:", 
                  img.naturalWidth, img.naturalHeight, 
                  canvasDisplaySize.value.width, canvasDisplaySize.value.height);

      cropRect.value = { x: 0, y: 0, size: 0, isSelecting: false, hasSelection: false }; // Reset crop
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

// --- Mouse Event Handlers for Cropping ---
const getMousePos = (event) => {
  if (!canvasRef.value || !originalImageForCropping.value) return { x:0, y:0 };
  const rect = canvasRef.value.getBoundingClientRect();
  
  // Scale mouse coordinates from display size to canvas natural size
  const scaleX = canvasRef.value.width / rect.width;
  const scaleY = canvasRef.value.height / rect.height;
  
  let x = (event.clientX - rect.left) * scaleX;
  let y = (event.clientY - rect.top) * scaleY;

  // Clamp to image boundaries
  x = Math.max(0, Math.min(x, canvasRef.value.width));
  y = Math.max(0, Math.min(y, canvasRef.value.height));
  return { x, y };
};

const handleMouseDown = (event) => {
  if (!originalImageForCropping.value) return;
  const pos = getMousePos(event);
  startPoint.value = pos;
  cropRect.value = {
    x: pos.x,
    y: pos.y,
    size: 0,
    isSelecting: true,
    hasSelection: false,
  };
  redrawCanvas();
};

const handleMouseMove = (event) => {
  if (!cropRect.value.isSelecting || !originalImageForCropping.value) return;
  const currentPos = getMousePos(event);
  
  const deltaX = currentPos.x - startPoint.value.x;
  const deltaY = currentPos.y - startPoint.value.y;
  
  // For square, size is max of absolute deltaX and deltaY
  let size = Math.max(Math.abs(deltaX), Math.abs(deltaY));

  // Determine top-left corner based on drag direction
  let newX = startPoint.value.x;
  let newY = startPoint.value.y;

  if (deltaX < 0) {
    newX = startPoint.value.x - size;
  }
  if (deltaY < 0) {
    newY = startPoint.value.y - size;
  }
  
  // Ensure cropRect is within image boundaries
  if (newX < 0) {
    size += newX; // Reduce size if x goes negative
    newX = 0;
  }
  if (newY < 0) {
    size += newY; // Reduce size if y goes negative
    newY = 0;
  }
  if (newX + size > canvasRef.value.width) {
    size = canvasRef.value.width - newX;
  }
  if (newY + size > canvasRef.value.height) {
    size = canvasRef.value.height - newY;
  }
  if (size < 0) size = 0; // Prevent negative size

  cropRect.value.x = newX;
  cropRect.value.y = newY;
  cropRect.value.size = size;
  
  redrawCanvas();
};

const handleMouseUpOrLeave = (event) => {
  if (cropRect.value.isSelecting) {
    cropRect.value.isSelecting = false;
    if (cropRect.value.size > 5) { // Consider a minimum size for a valid selection
      cropRect.value.hasSelection = true;
    } else {
      cropRect.value.hasSelection = false; 
      cropRect.value.size = 0; // Ensure size is 0 if not a valid selection
    }
    redrawCanvas();
  }
};

// --- End Mouse Event Handlers ---

// --- Function to handle Reset Crop ---
const handleResetCrop = () => {
  if (!originalImageForCropping.value || !canvasRef.value) return;
  
  // Reset crop rectangle state
  cropRect.value = {
    x: 0,
    y: 0,
    size: 0,
    isSelecting: false,
    hasSelection: false,
  };
  
  // Ensure canvas dimensions are reset to original image dimensions
  // This might be redundant if originalImageForCropping is the sole source for redrawCanvas dimensions
  // but good for explicit reset.
  // canvasRef.value.width = originalImageForCropping.value.naturalWidth;
  // canvasRef.value.height = originalImageForCropping.value.naturalHeight;
  // Actually, drawImageOnCanvas already handles setting canvas to original image and resetting crop.
  // So, calling it is simpler if it doesn't trigger a full image reload unnecessarily.
  // For now, a targeted reset is fine.
  
  console.log("[FrameEditor] Crop reset.");
  redrawCanvas(); // Redraw with no selection
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
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUpOrLeave"
      @mouseleave="handleMouseUpOrLeave"
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