import { ref } from 'vue';

export default function useMagicWand(canvasRef, ctxRef, redrawCallback) {
  const isToolActive = ref(false);
  const tolerance = ref(30); // Default tolerance (0-255 range for color difference)

  const activate = () => {
    isToolActive.value = true;
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'crosshair'; // Or a custom magic wand cursor
    }
    // console.log("Magic Wand Activated");
  };

  const deactivate = () => {
    isToolActive.value = false;
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'default';
    }
    // console.log("Magic Wand Deactivated");
  };

  const getPixelColor = (imageData, x, y, width) => {
    const index = (Math.round(y) * width + Math.round(x)) * 4;
    if (index < 0 || index + 3 >= imageData.data.length) {
      // Should not happen if x,y are clamped, but as a safeguard
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    return {
      r: imageData.data[index],
      g: imageData.data[index + 1],
      b: imageData.data[index + 2],
      a: imageData.data[index + 3],
    };
  };

  const setPixelTransparent = (imageData, x, y, width) => {
    const index = (Math.round(y) * width + Math.round(x)) * 4;
    if (index < 0 || index + 3 >= imageData.data.length) return;
    imageData.data[index + 3] = 0;
  };

  const colorsAreSimilar = (color1, color2, tol) => {
    // The linked wasm-flood-fill example seems to have a single tolerance value that might be Manhattan distance or similar.
    // Let's try Manhattan distance on RGB.
    return (Math.abs(color1.r - color2.r) + Math.abs(color1.g - color2.g) + Math.abs(color1.b - color2.b)) <= tol;
  };
  
  const execute = (startX, startY) => {
    if (!canvasRef.value || !ctxRef.value) return false;
    const canvas = canvasRef.value;
    const ctx = ctxRef.value;
    const { width, height } = canvas;

    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return false;

    const imageData = ctx.getImageData(0, 0, width, height);
    const sampledColor = getPixelColor(imageData, startX, startY, width);

    if (sampledColor.a === 0) { // If clicked on an already transparent area
      // console.log("Sampled pixel is already fully transparent. No action.");
      return false; 
    }

    const queue = [[Math.round(startX), Math.round(startY)]];
    const visited = new Set();
    visited.add(`${Math.round(startX)},${Math.round(startY)}`);

    let pixelsChanged = 0;

    while (queue.length > 0) {
      const [x, y] = queue.shift();

      const currentPixelForAction = getPixelColor(imageData, x, y, width);
      if (currentPixelForAction.a > 0 && colorsAreSimilar(sampledColor, currentPixelForAction, tolerance.value)) {
         setPixelTransparent(imageData, x, y, width);
         pixelsChanged++;
      } else {
        continue;
      }

      const neighbors = [
        [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborKey = `${nx},${ny}`;
          if (!visited.has(neighborKey)) {
            visited.add(neighborKey);
            const neighborColor = getPixelColor(imageData, nx, ny, width);
            if (neighborColor.a > 0 && colorsAreSimilar(sampledColor, neighborColor, tolerance.value)) {
              queue.push([nx, ny]);
            }
          }
        }
      }
    }

    if (pixelsChanged > 0) {
      ctx.putImageData(imageData, 0, 0);
      if (redrawCallback) redrawCallback(true); 
      return true;
    }
    return false;
  };
  
  const setTol = (newTolerance) => {
    const val = parseInt(newTolerance, 10);
    // Max Manhattan distance for RGB is 255*3 = 765. Adjusting max tolerance value here.
    if (!isNaN(val) && val >= 0 && val <= 765) { 
        tolerance.value = val;
    }
  };

  return {
    isToolActive,
    tolerance,
    setTolerance: setTol,
    activate,
    deactivate,
    executeMagicWand: execute,
  };
} 