<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import useGlobalImageOperations from '../composables/useGlobalImageOperations';
import useFrameCropper from '../composables/useFrameCropper';

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

const { isProcessingGlobal, applyGlobalCrop } = useGlobalImageOperations(
  { extractedFrames: props.projectExtractedFrames, originalFrameFilePaths: props.projectOriginalFramePaths },
  { initialProcessingMessage: props.processingMessageString, updateProcessingMessage: props.updateAppProcessingMessage }
);

const { cropRect, handleMouseDown: cropperMouseDown, handleMouseMove: cropperMouseMove, handleMouseUpOrLeave: cropperMouseUpOrLeave, resetCrop: cropperResetCrop, drawCropSelection } = useFrameCropper(canvasRef, originalImageForCropping, () => redrawCanvas());

const redrawCanvas = () => {
  if (!ctx.value || !canvasRef.value) return;
  const canvas = canvasRef.value;
  const context = ctx.value;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (originalImageForCropping.value) {
    context.drawImage(originalImageForCropping.value, 0, 0, canvas.width, canvas.height);
  }
  drawCropSelection(context);
};

const drawImageOnCanvas = async () => {
  if (!canvasRef.value || !props.frameToEdit || !props.frameToEdit.src) {
    if (ctx.value) ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    originalImageForCropping.value = null;
    return;
  }
  const img = new Image();
  img.onload = async () => {
    originalImageForCropping.value = img;
    if (canvasRef.value) {
      canvasRef.value.width = img.naturalWidth;
      canvasRef.value.height = img.naturalHeight;
      await nextTick();
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

const handleResetCrop = () => cropperResetCrop();

const handleApplyCropToAllFrames = async () => {
  if (!cropRect.value.hasSelection || cropRect.value.size <= 0) {
    props.updateAppProcessingMessage("请先在当前帧上选择一个裁剪区域。");
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
    <canvas ref="canvasRef" class="editor-canvas" @mousedown="cropperMouseDown" @mousemove="cropperMouseMove" @mouseup="cropperMouseUpOrLeave" @mouseleave="cropperMouseUpOrLeave"></canvas>
    <div class="editor-controls">
      <button @click="saveChanges">保存更改</button>
      <button @click="cancelEdit">取消</button>
      <button @click="handleApplyCropToAllFrames" :disabled="isProcessingGlobal">{{ isProcessingGlobal ? '处理中...' : '应用到所有帧' }}</button>
      <button @click="handleResetCrop" :disabled="isProcessingGlobal">重置裁剪</button>
    </div>
  </div>
</template>

<style scoped>
.frame-editor-component { margin-top: 20px; padding: 20px; border: 1px solid #ccc; border-radius: 8px; display: flex; flex-direction: column; align-items: center; }
.editor-canvas { border: 1px solid #000; margin-bottom: 15px; max-width: 100%; height: auto; }
.editor-controls button { margin: 0 5px; padding: 8px 15px; }
@media (prefers-color-scheme: dark) {
  .frame-editor-component { border-color: #555; background-color: #3a3a3a; }
  .editor-canvas { border-color: #777; }
  .editor-controls button { background-color: #555; color: #eee; border: 1px solid #777; }
  .editor-controls button:hover { background-color: #666; }
}
</style> 