<script setup>
import { ref, watch, onMounted } from 'vue';

const props = defineProps({
  frameToEdit: { // Expected: { src: 'image_source_path', index: frame_index, originalSrc: 'original_asset_path_for_saving_if_needed' }
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update-frame', 'cancel-edit']);

const canvasRef = ref(null);
const ctx = ref(null);

const drawImageOnCanvas = () => {
  if (!canvasRef.value || !props.frameToEdit || !props.frameToEdit.src) {
    if (ctx.value) { // Clear canvas if no image
        ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    }
    return;
  }

  const img = new Image();
  img.onload = () => {
    if (canvasRef.value) { // Check if canvasRef is still valid
        // Set canvas dimensions based on image, or fixed dimensions
        canvasRef.value.width = img.naturalWidth;
        canvasRef.value.height = img.naturalHeight;
        if (ctx.value) {
            ctx.value.drawImage(img, 0, 0);
        }
    }
  };
  img.onerror = (e) => {
    console.error("Error loading image for canvas:", e);
    // Optionally clear canvas or show error message
    if (canvasRef.value && ctx.value) {
        ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    }
  };
  img.src = props.frameToEdit.src; // This should be a URL tauri can load (e.g. asset: protocol or convertFileSrc result)
};

onMounted(() => {
  if (canvasRef.value) {
    ctx.value = canvasRef.value.getContext('2d');
    drawImageOnCanvas();
  }
});

watch(() => props.frameToEdit, (newFrame) => {
  console.log("[FrameEditor] frameToEdit prop changed:", newFrame);
  if (canvasRef.value && ctx.value) { // Ensure canvas context is ready
    drawImageOnCanvas();
  } else if (canvasRef.value && !ctx.value) { // If canvas exists but context not yet acquired
    ctx.value = canvasRef.value.getContext('2d');
    drawImageOnCanvas();
  }
}, { deep: true });

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
    <canvas ref="canvasRef" class="editor-canvas"></canvas>
    <div class="editor-controls">
      <button @click="saveChanges">保存更改</button>
      <button @click="cancelEdit">取消</button>
      <!-- Placeholder for more tools -->
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