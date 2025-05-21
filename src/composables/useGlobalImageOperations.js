import { ref } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';

export default function useGlobalImageOperations(projectManagementRefs, messageUpdater) {
  // Deep log of what's received
  try {
    console.log("[useGlobalOps] Received projectManagementRefs (raw object):", projectManagementRefs);
    if (projectManagementRefs) {
      console.log("[useGlobalOps] projectManagementRefs.originalFrameFilePaths (raw, should be array):", projectManagementRefs.originalFrameFilePaths);
      console.log("[useGlobalOps] Array.isArray(projectManagementRefs.originalFrameFilePaths):", Array.isArray(projectManagementRefs.originalFrameFilePaths));
      console.log("[useGlobalOps] projectManagementRefs.extractedFrames (raw, should be array):", projectManagementRefs.extractedFrames);
      console.log("[useGlobalOps] Array.isArray(projectManagementRefs.extractedFrames):", Array.isArray(projectManagementRefs.extractedFrames));
    } else {
      console.log("[useGlobalOps] projectManagementRefs is falsy.");
    }
  } catch (e) {
    console.error("[useGlobalOps] Error during initial logging of projectManagementRefs:", e);
  }

  // These are now expected to be the actual arrays, not refs.
  const originalFrames = projectManagementRefs.originalFrameFilePaths;
  const currentExtractedFrames = projectManagementRefs.extractedFrames; // Use for length or initial state if needed

  const { initialProcessingMessage, updateProcessingMessage } = messageUpdater;

  const isProcessingGlobal = ref(false);
  const localProcessingMessage = ref(initialProcessingMessage);

  async function applyGlobalCrop(cropParams) {
    // Directly use originalFrames (the array)
    if (!originalFrames || !Array.isArray(originalFrames) || originalFrames.length === 0) {
      console.warn('[useGlobalImageOperations] applyGlobalCrop: originalFrames 无效或为空，无法继续裁剪。', originalFrames);
      if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
        messageUpdater.updateProcessingMessage('错误：没有可用于裁剪的原始帧路径。');
      }
      isProcessingGlobal.value = false;
      return null; // Indicate failure or no operation
    }
    // currentExtractedFrames is also an array, not a ref.
    if (!currentExtractedFrames || !Array.isArray(currentExtractedFrames)) {
        console.warn('[useGlobalImageOperations] applyGlobalCrop: currentExtractedFrames 数组无效。');
        // Decide if this is a critical error or if we can proceed with originalFrames only
    }

    isProcessingGlobal.value = true;
    if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
      messageUpdater.updateProcessingMessage(`正在对 ${originalFrames.length} 帧应用全局裁剪...`);
    } else {
      console.log(`[useGlobalImageOperations] messageUpdater 或 updateProcessingMessage 不可用。`);
    }
    
    const localOriginalPaths = [...originalFrames]; // Create a copy of the array
    const newExtractedFramesOutput = [];
    let processedCount = 0;

    console.log(`[useGlobalImageOperations] 开始处理 ${localOriginalPaths.length} 帧的全局裁剪。裁剪参数:`, cropParams);

    try {
      for (const originalPath of localOriginalPaths) {
        if (!originalPath || typeof originalPath !== 'string') {
          console.warn('[useGlobalImageOperations] 跳过无效的原始路径:', originalPath);
          newExtractedFramesOutput.push(''); 
          processedCount++;
          if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
            messageUpdater.updateProcessingMessage(`全局裁剪：已处理 ${processedCount}/${localOriginalPaths.length} 帧 (跳过一个无效路径)...`);
          }
          continue;
        }
        try {
          const image = new Image();
          image.crossOrigin = "Anonymous"; 
          
          const srcPathForImage = convertFileSrc(originalPath);
          console.log(`[useGlobalImageOperations] 正在加载图像: ${originalPath} (转换后: ${srcPathForImage})`);

          const dataUrl = await new Promise((resolve, reject) => {
            image.onload = () => {
              console.log(`[useGlobalImageOperations] 图像已加载: ${originalPath}`);
              const tempCanvas = document.createElement('canvas');
              const ctx = tempCanvas.getContext('2d');
              if (!ctx) {
                console.error('[useGlobalImageOperations] 无法获取临时画布的2D上下文', originalPath);
                reject(new Error('无法获取临时画布的2D上下文'));
                return;
              }

              tempCanvas.width = cropParams.width;
              tempCanvas.height = cropParams.height;

              console.log(
                `[useGlobalImageOperations] 裁剪图像 ${originalPath} - 源尺寸: ${image.naturalWidth}x${image.naturalHeight}, ` +
                `裁剪参数: (x:${cropParams.x}, y:${cropParams.y}, w:${cropParams.width}, h:${cropParams.height})`
              );

              ctx.drawImage(
                image,
                cropParams.x, 
                cropParams.y, 
                cropParams.width, 
                cropParams.height, 
                0, 
                0, 
                cropParams.width, 
                cropParams.height 
              );
              resolve(tempCanvas.toDataURL('image/png'));
            };
            image.onerror = (err) => {
              console.error('[useGlobalImageOperations] 加载图像失败:', originalPath, err);
              reject(new Error(`加载图像失败: ${originalPath}`));
            };
            image.src = srcPathForImage;
          });
          newExtractedFramesOutput.push(dataUrl);
        } catch (err) {
          console.error(`[useGlobalImageOperations] 处理单帧 ${originalPath} 时出错:`, err);
          newExtractedFramesOutput.push(''); 
        }
        processedCount++;
        if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
          messageUpdater.updateProcessingMessage(`全局裁剪：已处理 ${processedCount}/${localOriginalPaths.length} 帧...`);
        }
      }

      // Return the newly created array of data URLs
      if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
        messageUpdater.updateProcessingMessage(`所有 ${localOriginalPaths.length} 帧已成功应用全局裁剪！`);
      }
      console.log('[useGlobalImageOperations] 全局裁剪处理完成，返回新的帧数组。');
      return newExtractedFramesOutput;

    } catch (error) {
      console.error('[useGlobalImageOperations] applyGlobalCrop 函数主循环出错:', error);
      if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
        messageUpdater.updateProcessingMessage(`应用全局裁剪时发生错误: ${error.message || String(error)}`);
      }
      return null; // Indicate failure
    } finally {
      isProcessingGlobal.value = false;
      // Removed console.log from here as it's better after return or in calling function
    }
  }

  return {
    isProcessingGlobal,
    applyGlobalCrop,
    localProcessingMessage
  };
} 