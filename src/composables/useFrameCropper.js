import { ref, watch } from 'vue';

export default function useFrameCropper(canvasRef, originalImage, redrawCanvasCallback, initialIsActive = true) {
  const isToolActive = ref(initialIsActive);
  const cropRect = ref({
    x: 0,
    y: 0,
    size: 0,
    isSelecting: false,
    hasSelection: false,
  });
  const startPoint = ref({ x: 0, y: 0 });

  const activate = () => {
    isToolActive.value = true;
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'crop';
    }
  };

  const deactivate = () => {
    isToolActive.value = false;
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'default';
    }
  };

  const getMousePos = (event) => {
    if (!canvasRef.value || !originalImage.value) return { x: 0, y: 0 };
    const rect = canvasRef.value.getBoundingClientRect();
    const scaleX = canvasRef.value.width / rect.width;
    const scaleY = canvasRef.value.height / rect.height;
    let x = (event.clientX - rect.left) * scaleX;
    let y = (event.clientY - rect.top) * scaleY;
    x = Math.max(0, Math.min(x, canvasRef.value.width));
    y = Math.max(0, Math.min(y, canvasRef.value.height));
    return { x, y };
  };

  const handleMouseDown = (event) => {
    if (!isToolActive.value || !originalImage.value) return;
    const pos = getMousePos(event);
    startPoint.value = pos;
    cropRect.value = {
      x: pos.x,
      y: pos.y,
      size: 0,
      isSelecting: true,
      hasSelection: false,
    };
    if (redrawCanvasCallback) redrawCanvasCallback();
  };

  const handleMouseMove = (event) => {
    if (!isToolActive.value || !cropRect.value.isSelecting || !originalImage.value) return;
    const currentPos = getMousePos(event);
    const deltaX = currentPos.x - startPoint.value.x;
    const deltaY = currentPos.y - startPoint.value.y;
    let size = Math.max(Math.abs(deltaX), Math.abs(deltaY));
    let newX = startPoint.value.x;
    let newY = startPoint.value.y;
    if (deltaX < 0) newX = startPoint.value.x - size;
    if (deltaY < 0) newY = startPoint.value.y - size;
    if (newX < 0) { size += newX; newX = 0; }
    if (newY < 0) { size += newY; newY = 0; }
    if (newX + size > canvasRef.value.width) { size = canvasRef.value.width - newX; }
    if (newY + size > canvasRef.value.height) { size = canvasRef.value.height - newY; }
    if (size < 0) size = 0;
    cropRect.value.x = newX;
    cropRect.value.y = newY;
    cropRect.value.size = size;
    if (redrawCanvasCallback) redrawCanvasCallback();
  };

  const handleMouseUpOrLeave = () => {
    if (!isToolActive.value || !cropRect.value.isSelecting) {
      return;
    }
    cropRect.value.isSelecting = false;
    if (cropRect.value.size > 5) { 
      cropRect.value.hasSelection = true;
    } else {
      cropRect.value.hasSelection = false; 
      cropRect.value.size = 0; 
    }
    if (redrawCanvasCallback) redrawCanvasCallback();
  };

  const resetCrop = () => {
    cropRect.value = { x: 0, y: 0, size: 0, isSelecting: false, hasSelection: false };
    if (redrawCanvasCallback) redrawCanvasCallback();
  };

  const drawCropSelection = (context) => {
    if (!isToolActive.value || !(cropRect.value.isSelecting || cropRect.value.hasSelection)) {
      return;
    }
    if (cropRect.value.size <= 0 && !cropRect.value.isSelecting) {
        return;
    }
    if (!canvasRef.value || !context) {
        return;
    }
    context.strokeStyle = 'rgba(0, 0, 255, 0.7)';
    context.lineWidth = 2;
    context.setLineDash([5, 5]);
    context.strokeRect(cropRect.value.x, cropRect.value.y, cropRect.value.size, cropRect.value.size);
    context.setLineDash([]);
  };
  
  watch(originalImage, (newImg, oldImg) => {
    if (newImg !== oldImg) {
      resetCrop();
    }
  }, { deep: true });
  
  if (initialIsActive) {
    activate();
  }

  return {
    cropRect,
    isToolActive,
    handleMouseDown,
    handleMouseMove,
    handleMouseUpOrLeave,
    resetCrop,
    drawCropSelection,
    activate,
    deactivate
  };
} 