<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import useGlobalImageOperations from '../composables/useGlobalImageOperations';
import useFrameCropper from '../composables/useFrameCropper';
import useMagicWand from '../composables/useMagicWand';

const props = defineProps({
  frameToEdit: { type: Object, default: null },
  projectExtractedFrames: { type: Object, required: true },
  projectOriginalFramePaths: { type: Object, required: true },
  processingMessageString: { type: String, default: '' },
  updateAppProcessingMessage: { type: Function, required: true }
});

const emit = defineEmits(['update-frame', 'cancel-edit', 'frames-globally-updated']);

const canvasRef = ref(null);
const ctx = ref(null);
const originalImageForCropping = ref(null);

const activeTool = ref('crop');

const updateBaseImageAfterCanvasChange = async (sourceTool) => {
  if (!canvasRef.value) return;
  const dataUrl = canvasRef.value.toDataURL('image/png');
  const img = new Image();
  img.onload = () => {
    originalImageForCropping.value = img;
    redrawCanvas();
  };
  img.src = dataUrl;
};

const { isProcessingGlobal, applyGlobalCrop } = useGlobalImageOperations(
  { extractedFrames: props.projectExtractedFrames, originalFrameFilePaths: props.projectOriginalFramePaths },
  { initialProcessingMessage: props.processingMessageString, updateProcessingMessage: props.updateAppProcessingMessage }
);

const { 
  cropRect, 
  handleMouseDown: cropperMouseDown, 
  handleMouseMove: cropperMouseMove,
  handleMouseUpOrLeave: cropperMouseUpOrLeave, 
  resetCrop: cropperResetCrop, 
  drawCropSelection, 
  activate: activateCropTool, 
  deactivate: deactivateCropTool 
} = useFrameCropper(canvasRef, originalImageForCropping, () => redrawCanvas(), activeTool.value === 'crop');

const { 
  isToolActive: isMagicWandActive, 
  tolerance: magicWandTolerance, 
  setTolerance: setMagicWandTolerance, 
  activate: activateMagicWandTool, 
  deactivate: deactivateMagicWandTool, 
  executeMagicWand 
} = useMagicWand(canvasRef, ctx, () => updateBaseImageAfterCanvasChange('magicWand'));

const setActiveTool = (toolName) => {
  const previousTool = activeTool.value;
  if (previousTool === 'crop' && previousTool !== toolName) {
    deactivateCropTool();
  } else if (previousTool === 'magicWand' && previousTool !== toolName) {
    deactivateMagicWandTool();
  }
  activeTool.value = toolName;
  if (toolName === 'crop') {
    activateCropTool();
  } else if (toolName === 'magicWand') {
    activateMagicWandTool();
  }
};

const redrawCanvas = () => {
  if (!ctx.value || !canvasRef.value || !originalImageForCropping.value) {
    if (ctx.value && canvasRef.value) ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    return;
  }
  const canvas = canvasRef.value;
  const context = ctx.value;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(originalImageForCropping.value, 0, 0, canvas.width, canvas.height);
  if (activeTool.value === 'crop' && (cropRect.value.isSelecting || cropRect.value.hasSelection)) {
     drawCropSelection(context);
  }
};

const drawImageOnCanvas = async () => {
  if (!canvasRef.value || !props.frameToEdit || !props.frameToEdit.src) {
    if (ctx.value) ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    originalImageForCropping.value = null;
    return;
  }
  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = async () => {
    originalImageForCropping.value = img;
    if (canvasRef.value) {
      canvasRef.value.width = img.naturalWidth;
      canvasRef.value.height = img.naturalHeight;
      await nextTick();
      setActiveTool('crop'); 
      redrawCanvas();
    }
  };
  img.onerror = () => {
    originalImageForCropping.value = null;
    if (canvasRef.value && ctx.value) ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
  };
  img.src = props.frameToEdit.src;
};

onMounted(() => {
  if (canvasRef.value) {
    ctx.value = canvasRef.value.getContext('2d');
    drawImageOnCanvas();
  }
});

watch(() => props.frameToEdit, () => {
  if (canvasRef.value && !ctx.value) ctx.value = canvasRef.value.getContext('2d');
  drawImageOnCanvas();
}, { deep: true });

const handleCanvasMouseDown = (event) => {
  if (activeTool.value === 'crop') {
    cropperMouseDown(event);
  } else if (activeTool.value === 'magicWand') {
    if (!canvasRef.value || !originalImageForCropping.value) return;
    const rect = canvasRef.value.getBoundingClientRect();
    const scaleX = canvasRef.value.width / rect.width;
    const scaleY = canvasRef.value.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    executeMagicWand(Math.round(x), Math.round(y));
  }
};

const handleCanvasMouseMove = (event) => {
  if (activeTool.value === 'crop') {
    if (typeof cropperMouseMove === 'function') {
        cropperMouseMove(event);
    } 
  }
};

const handleCanvasMouseUp = (event) => {
  if (activeTool.value === 'crop') {
    if (typeof cropperMouseUpOrLeave === 'function') {
      cropperMouseUpOrLeave(event);
    } 
  }
};

const handleCanvasMouseLeave = (event) => {
  if (activeTool.value === 'crop') {
    if (typeof cropperMouseUpOrLeave === 'function') {
      cropperMouseUpOrLeave(event);
    } 
  }
};

const handleResetTools = () => {
  if (activeTool.value === 'crop') {
    cropperResetCrop();
  }
  redrawCanvas(); 
};

const handleApplyCropToAllFrames = async () => {
  if (activeTool.value !== 'crop' || !cropRect.value.hasSelection || cropRect.value.size <= 0) {
    props.updateAppProcessingMessage("请先使用裁剪工具选择一个区域。");
    return;
  }
  const cropParamsToApply = { x: cropRect.value.x, y: cropRect.value.y, width: cropRect.value.size, height: cropRect.value.size };
  props.updateAppProcessingMessage("正在应用全局裁剪...");
  const success = await applyGlobalCrop(cropParamsToApply);
  if (success) emit('frames-source-files-updated');
  else props.updateAppProcessingMessage('全局裁剪操作失败或未成功。');
};

const saveChanges = () => {
  if (!canvasRef.value || !props.frameToEdit) return;
  const imageDataUrl = canvasRef.value.toDataURL('image/png');
  emit('update-frame', { index: props.frameToEdit.index, newSrcDataUrl: imageDataUrl });
};

const cancelEdit = () => emit('cancel-edit');

</script>

<template>
  <div v-if="frameToEdit" class="frame-editor-component">
    <h3>编辑帧 #{{ frameToEdit.index }}</h3>
    <canvas 
      ref="canvasRef" 
      class="editor-canvas" 
      @mousedown="handleCanvasMouseDown" 
      @mousemove="handleCanvasMouseMove" 
      @mouseup="handleCanvasMouseUp" 
      @mouseleave="handleCanvasMouseLeave"
    ></canvas>
    <div class="editor-tool-selector">
      <button @click="setActiveTool('crop')" :class="{active: activeTool === 'crop'}">裁剪</button>
      <button @click="setActiveTool('magicWand')" :class="{active: activeTool === 'magicWand'}">魔术棒</button>
    </div>
    <div v-if="activeTool === 'magicWand'" class="tool-controls magic-wand-controls">
      <label for="tolerance">容差: {{ magicWandTolerance }}</label>
      <input type="range" id="tolerance" min="0" max="765" :value="magicWandTolerance" @input="setMagicWandTolerance($event.target.value)" :disabled="isProcessingGlobal">
    </div>
     <div v-if="activeTool === 'crop'" class="tool-controls crop-controls">
      <!-- Placeholder for crop-specific controls if any in future -->
    </div>
    <div class="editor-controls">
      <button @click="saveChanges" :disabled="isProcessingGlobal">保存更改</button>
      <button @click="cancelEdit" :disabled="isProcessingGlobal">取消</button>
      <button 
        @click="handleApplyCropToAllFrames" 
        :disabled="isProcessingGlobal || activeTool !== 'crop' || !cropRect?.hasSelection"
      >应用到所有帧 (仅裁剪)</button>
      <button @click="handleResetTools" :disabled="isProcessingGlobal">重置工具</button>
    </div>
  </div>
</template>

<style scoped>
.frame-editor-component { margin-top: 20px; padding: 20px; border: 1px solid #ccc; border-radius: 8px; display: flex; flex-direction: column; align-items: center; }
.editor-canvas { border: 1px solid #000; margin-bottom: 15px; max-width: 100%; height: auto; cursor: default; }
.editor-tool-selector { margin-bottom: 10px; display: flex; gap: 10px; }
.editor-tool-selector button { padding: 6px 12px; border: 1px solid #ccc; background-color: #f0f0f0; cursor: pointer; }
.editor-tool-selector button.active { background-color: #4CAF50; color: white; border-color: #4CAF50; }
.tool-controls { margin-bottom: 10px; display: flex; align-items: center; gap: 10px; min-height: 30px; /* Ensure space even if empty */ }
.magic-wand-controls label { margin-right: 5px; }
.magic-wand-controls input[type="range"] { width: 150px; }
.editor-controls { display: flex; gap: 10px; margin-top:10px;}
.editor-controls button { padding: 8px 15px; }

@media (prefers-color-scheme: dark) {
  .frame-editor-component { border-color: #555; background-color: #3a3a3a; }
  .editor-canvas { border-color: #777; }
  .editor-tool-selector button { background-color: #555; color: #eee; border-color: #777; }
  .editor-tool-selector button.active { background-color: #007bff; border-color: #007bff; }
  .tool-controls { color: #eee; }
  .editor-controls button { background-color: #555; color: #eee; border: 1px solid #777; }
  .editor-controls button:hover { background-color: #666; }
}
</style> 