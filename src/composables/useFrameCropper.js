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
      canvasRef.value.style.cursor = 'crop'; // Or specific crop cursor
    }
    console.log("[useFrameCropper] Activated. isToolActive:", isToolActive.value);
  };

  const deactivate = () => {
    isToolActive.value = false;
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'default';
    }
    console.log("[useFrameCropper] Deactivated. isToolActive:", isToolActive.value);
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
    console.log("[useFrameCropper] handleMouseDown. isToolActive:", isToolActive.value);
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
    console.log("[useFrameCropper] handleMouseMove. isToolActive:", isToolActive.value, "isSelecting:", cropRect.value.isSelecting);
    if (!isToolActive.value || !cropRect.value.isSelecting || !originalImage.value) return;
    const currentPos = getMousePos(event);
    const deltaX = currentPos.x - startPoint.value.x;
    const deltaY = currentPos.y - startPoint.value.y;
    let size = Math.max(Math.abs(deltaX), Math.abs(deltaY));
    let newX = startPoint.value.x;
    let newY = startPoint.value.y;

    if (deltaX < 0) newX = startPoint.value.x - size;
    if (deltaY < 0) newY = startPoint.value.y - size;

    if (newX < 0) {
      size += newX;
      newX = 0;
    }
    if (newY < 0) {
      size += newY;
      newY = 0;
    }
    if (newX + size > canvasRef.value.width) {
      size = canvasRef.value.width - newX;
    }
    if (newY + size > canvasRef.value.height) {
      size = canvasRef.value.height - newY;
    }
    if (size < 0) size = 0;

    cropRect.value.x = newX;
    cropRect.value.y = newY;
    cropRect.value.size = size;
    if (redrawCanvasCallback) redrawCanvasCallback();
  };

  const handleMouseUpOrLeave = () => {
    console.log("[useFrameCropper] handleMouseUpOrLeave triggered. isToolActive:", isToolActive.value, "Current isSelecting before logic:", cropRect.value.isSelecting);
    if (!isToolActive.value || !cropRect.value.isSelecting) {
      console.log("[useFrameCropper] handleMouseUpOrLeave returning early. Conditions not met (tool active/is selecting).");
      return;
    }
    cropRect.value.isSelecting = false;
    if (cropRect.value.size > 5) { 
      cropRect.value.hasSelection = true;
      console.log("[useFrameCropper] Valid selection made. size:", cropRect.value.size);
    } else {
      cropRect.value.hasSelection = false; 
      cropRect.value.size = 0; 
      console.log("[useFrameCropper] Selection too small or invalid, reset. size:", cropRect.value.size);
    }
    console.log("[useFrameCropper] handleMouseUpOrLeave finished. isToolActive:", isToolActive.value, "New isSelecting:", cropRect.value.isSelecting, "hasSelection:", cropRect.value.hasSelection);
    if (redrawCanvasCallback) redrawCanvasCallback();
  };

  const resetCrop = () => {
    cropRect.value = {
      x: 0,
      y: 0,
      size: 0,
      isSelecting: false,
      hasSelection: false,
    };
    if (redrawCanvasCallback) redrawCanvasCallback();
    console.log("[useFrameCropper] Crop reset.");
  };

  const drawCropSelection = (context) => {
    console.log("[useFrameCropper] drawCropSelection called. isToolActive:", isToolActive.value, "cropRect:", JSON.parse(JSON.stringify(cropRect.value)));

    // Condition to draw: tool must be active AND (either selecting OR has a selection)
    // The size check was too restrictive for the initial mousedown event.
    if (!isToolActive.value || !(cropRect.value.isSelecting || cropRect.value.hasSelection)) {
      console.log("[useFrameCropper] drawCropSelection returning early. Conditions not met. isToolActive:", isToolActive.value, "isSelecting:", cropRect.value.isSelecting, "hasSelection:", cropRect.value.hasSelection);
      return;
    }
    
    // Also, if there's a selection but size is zero (e.g. after a reset or failed selection), don't draw.
    // This is mostly for hasSelection case. If isSelecting, even a zero size might be okay to start with (though invisible).
    // However, strokeRect with 0 size is a no-op anyway.
    if (cropRect.value.size <= 0 && !cropRect.value.isSelecting) { // If hasSelection is true but size is 0, or just no valid rect.
        console.log("[useFrameCropper] drawCropSelection: size is 0 and not actively selecting, returning.");
        return;
    }

    if (!canvasRef.value || !context) {
        console.warn("[useFrameCropper] drawCropSelection: canvasRef or context is null.");
        return;
    }

    context.strokeStyle = 'rgba(0, 0, 255, 0.7)';
    context.lineWidth = 2;
    context.setLineDash([5, 5]);

    // Cropping is done on the natural image dimensions. The canvas displays the image potentially scaled.
    // However, the cropRect values (x, y, size) are already in canvas coordinates (natural image size)
    // because getMousePos scales them.
    // When drawing on canvas, if canvas.width/height IS the naturalWidth/Height, no scaling needed.
    // The issue was in redrawCanvas of FrameEditor, where it was scaling again.
    // Here, we assume cropRect values are directly usable on the canvas whose dimensions match the image.
    context.strokeRect(cropRect.value.x, cropRect.value.y, cropRect.value.size, cropRect.value.size);
    context.setLineDash([]);
  };
  
  // Watch for changes in the original image to reset crop state
  watch(originalImage, (newImg, oldImg) => {
    if (newImg !== oldImg) {
      // console.log("[useFrameCropper] Original image changed, resetting crop.");
      resetCrop(); // Reset crop when image changes, active or not
    }
  }, { deep: true });

  // Activate on init if specified
  if (initialIsActive) {
    activate();
  }

  return {
    cropRect,
    isToolActive, // Export for external checks if needed, though mostly internal
    handleMouseDown,
    handleMouseMove,
    handleMouseUpOrLeave,
    resetCrop,
    drawCropSelection,
    activate,
    deactivate
  };
} 