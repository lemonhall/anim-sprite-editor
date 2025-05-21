import { ref } from 'vue';
import { invoke } from "@tauri-apps/api/core";

export default function useGlobalImageOperations(projectManagementRefs, messageUpdater) {
  // Deep log of what's received
  try {
    console.log("[useGlobalOps] Received projectManagementRefs (raw object):", projectManagementRefs);
    if (projectManagementRefs && projectManagementRefs.originalFrameFilePaths) {
      console.log("[useGlobalOps] projectManagementRefs.originalFrameFilePaths (isArray):", Array.isArray(projectManagementRefs.originalFrameFilePaths));
    } else {
      console.warn("[useGlobalOps] projectManagementRefs or originalFrameFilePaths is not available for logging.");
    }
  } catch (e) {
    console.error("[useGlobalOps] Error during initial logging of projectManagementRefs:", e);
  }

  const originalFilePathsArray = projectManagementRefs.originalFrameFilePaths; // This is expected to be a ref

  const isProcessingGlobal = ref(false);

  async function applyGlobalCrop(cropParams) {
    console.log('[useGlobalImageOperations] applyGlobalCrop CALLED. Checking originalFilePathsArray:', originalFilePathsArray);
    if (!originalFilePathsArray || !Array.isArray(originalFilePathsArray) || originalFilePathsArray.length === 0) {
      console.warn('[useGlobalImageOperations] applyGlobalCrop: originalFrameFilePaths 无效或为空，无法继续裁剪。Details:', 
        {
          hasOriginalFilePathsArrayItself: !!originalFilePathsArray,
          isArrayItself: Array.isArray(originalFilePathsArray),
          lengthItself: Array.isArray(originalFilePathsArray) ? originalFilePathsArray.length : 'N/A'
        }
      );
      if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
        messageUpdater.updateProcessingMessage('错误：没有可用于裁剪的原始帧路径。');
      }
      isProcessingGlobal.value = false;
      return false; // Indicate failure
    }

    isProcessingGlobal.value = true;
    const pathCount = originalFilePathsArray.length;
    if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
      messageUpdater.updateProcessingMessage(`正在请求后端对 ${pathCount} 帧应用全局裁剪...`);
    } else {
      console.log(`[useGlobalImageOperations] messageUpdater 或 updateProcessingMessage 不可用。`);
    }
    
    console.log(`[useGlobalImageOperations] 调用后端 'apply_crop_to_files'，路径数量: ${pathCount}。裁剪参数:`, cropParams);

    try {
      // The originalFrameFilePaths.value already contains the \\?\ prefixed paths from backend.
      // Rust command apply_crop_to_files will handle these paths.

      // Ensure cropParams values are integers as expected by the backend (u32)
      const sanitizedCropParams = {
        x: Math.round(cropParams.x),
        y: Math.round(cropParams.y),
        width: Math.round(cropParams.width),
        height: Math.round(cropParams.height),
      };
      console.log(`[useGlobalImageOperations] Sanitized Crop Params (rounded):`, sanitizedCropParams);

      const resultMessage = await invoke('apply_crop_to_files', {
        originalPaths: originalFilePathsArray, 
        cropParams: sanitizedCropParams // Use sanitized params
      });
      
      console.log("[useGlobalImageOperations] Backend 'apply_crop_to_files' result:", resultMessage);

      if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
        messageUpdater.updateProcessingMessage(String(resultMessage) || "后端裁剪操作已完成，但未返回具体消息。");
      }
      return true; // Indicate success from backend attempt

    } catch (error) {
      console.error('[useGlobalImageOperations] 调用后端 apply_crop_to_files 时出错:', error);
      const errorMessage = error.message || String(error) || "未知错误";
      if (messageUpdater && typeof messageUpdater.updateProcessingMessage === 'function') {
        messageUpdater.updateProcessingMessage(`应用全局裁剪时发生后端错误: ${errorMessage}`);
      }
      return false; // Indicate failure
    } finally {
      isProcessingGlobal.value = false;
    }
  }

  return {
    isProcessingGlobal,
    applyGlobalCrop,
  };
} 