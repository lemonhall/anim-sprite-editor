import { ref } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';

export default function useGlobalImageOperations(projectManagementRefs, messageUpdater) {
  // Deep log of what's received
  try {
    console.log("[useGlobalOps] Received projectManagementRefs (raw object):", projectManagementRefs);
    if (projectManagementRefs) {
      console.log("[useGlobalOps] projectManagementRefs.originalFrameFilePaths (raw):", projectManagementRefs.originalFrameFilePaths);
      if (projectManagementRefs.originalFrameFilePaths) {
        console.log("[useGlobalOps] projectManagementRefs.originalFrameFilePaths.value (attempting .value access):", projectManagementRefs.originalFrameFilePaths.value);
        console.log("[useGlobalOps] Array.isArray(projectManagementRefs.originalFrameFilePaths.value):", Array.isArray(projectManagementRefs.originalFrameFilePaths.value));
      } else {
        console.log("[useGlobalOps] projectManagementRefs.originalFrameFilePaths is falsy.");
      }
      console.log("[useGlobalOps] projectManagementRefs.extractedFrames (raw):", projectManagementRefs.extractedFrames);
      if (projectManagementRefs.extractedFrames) {
        console.log("[useGlobalOps] projectManagementRefs.extractedFrames.value (attempting .value access):", projectManagementRefs.extractedFrames.value);
      } else {
        console.log("[useGlobalOps] projectManagementRefs.extractedFrames is falsy.");
      }
    } else {
      console.log("[useGlobalOps] projectManagementRefs is falsy.");
    }
  } catch (e) {
    console.error("[useGlobalOps] Error during initial logging of projectManagementRefs:", e);
  }

  const { extractedFrames, originalFrameFilePaths } = projectManagementRefs;
  const { initialProcessingMessage, updateProcessingMessage } = messageUpdater;

  const isProcessingGlobal = ref(false); // Local processing state for this composable
  const localProcessingMessage = ref(initialProcessingMessage);

  async function applyGlobalCrop(cropParams) {
    if (!projectManagementRefs || 
        !projectManagementRefs.originalFrameFilePaths || 
        !projectManagementRefs.originalFrameFilePaths.value || 
        !Array.isArray(projectManagementRefs.originalFrameFilePaths.value) ||
        projectManagementRefs.originalFrameFilePaths.value.length === 0) {
      console.warn('[useGlobalImageOperations] applyGlobalCrop: originalFrameFilePaths 无效或为空，无法继续裁剪。', 
                   projectManagementRefs && projectManagementRefs.originalFrameFilePaths ? projectManagementRefs.originalFrameFilePaths.value : 'projectManagementRefs.originalFrameFilePaths is null/undefined');
      if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
        messageUpdater.updateProcessingMessage('错误：没有可用于裁剪的原始帧路径。');
      }
      isProcessingGlobal.value = false;
      return;
    }
    if (!projectManagementRefs.extractedFrames || !projectManagementRefs.extractedFrames.value) {
        console.warn('[useGlobalImageOperations] applyGlobalCrop: extractedFrames ref 无效，无法更新预览。');
        // 即使 extractedFrames 无效，仍然尝试处理原始文件，但会发出警告
    }

    isProcessingGlobal.value = true;
    if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
      messageUpdater.updateProcessingMessage(`正在对 ${projectManagementRefs.originalFrameFilePaths.value.length} 帧应用全局裁剪...`);
    } else {
      console.log(`[useGlobalImageOperations] messageUpdater 或 updateProcessingMessage 不可用。`);
    }
    
    const localOriginalPaths = [...projectManagementRefs.originalFrameFilePaths.value]; // 创建副本以防万一
    const newExtractedFrames = [];
    let processedCount = 0;

    console.log(`[useGlobalImageOperations] 开始处理 ${localOriginalPaths.length} 帧的全局裁剪。裁剪参数:`, cropParams);

    try {
      for (const originalPath of localOriginalPaths) {
        if (!originalPath || typeof originalPath !== 'string') {
          console.warn('[useGlobalImageOperations] 跳过无效的原始路径:', originalPath);
          newExtractedFrames.push(''); // 保留占位符或错误指示
          processedCount++;
          if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
            messageUpdater.updateProcessingMessage(`全局裁剪：已处理 ${processedCount}/${localOriginalPaths.length} 帧 (跳过一个无效路径)...`);
          }
          continue;
        }
        try {
          const image = new Image();
          image.crossOrigin = "Anonymous"; // 如果图像来自不同源，可能需要
          
          // 使用 convertFileSrc 确保路径对 Image.src 有效
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
                cropParams.x, // 源 x
                cropParams.y, // 源 y
                cropParams.width, // 源宽度
                cropParams.height, // 源高度
                0, // 目标 x
                0, // 目标 y
                cropParams.width, // 目标宽度
                cropParams.height // 目标高度
              );
              resolve(tempCanvas.toDataURL('image/png'));
            };
            image.onerror = (err) => {
              console.error('[useGlobalImageOperations] 加载图像失败:', originalPath, err);
              reject(new Error(`加载图像失败: ${originalPath}`));
            };
            image.src = srcPathForImage;
          });
          newExtractedFrames.push(dataUrl);
        } catch (err) {
          console.error(`[useGlobalImageOperations] 处理单帧 ${originalPath} 时出错:`, err);
          newExtractedFrames.push(''); // 如果单帧处理失败，添加空字符串或错误占位符
        }
        processedCount++;
        if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
          messageUpdater.updateProcessingMessage(`全局裁剪：已处理 ${processedCount}/${localOriginalPaths.length} 帧...`);
        }
      }

      if (projectManagementRefs.extractedFrames && projectManagementRefs.extractedFrames.value) {
        projectManagementRefs.extractedFrames.value = newExtractedFrames;
        console.log('[useGlobalImageOperations] projectManagementRefs.extractedFrames 已更新。');
      } else {
        console.warn('[useGlobalImageOperations] projectManagementRefs.extractedFrames ref 无效，无法更新预览数组。');
      }
      
      if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
        messageUpdater.updateProcessingMessage(`所有 ${localOriginalPaths.length} 帧已成功应用全局裁剪！`);
      }
    } catch (error) {
      console.error('[useGlobalImageOperations] applyGlobalCrop 函数主循环出错:', error);
      if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
        messageUpdater.updateProcessingMessage(`应用全局裁剪时发生错误: ${error.message || String(error)}`);
      }
    } finally {
      isProcessingGlobal.value = false;
      console.log('[useGlobalImageOperations] 全局裁剪处理完成。');
    }
  }

  return {
    isProcessingGlobal,
    applyGlobalCrop,
    localProcessingMessage // Expose if needed by the component using this composable
  };
} 