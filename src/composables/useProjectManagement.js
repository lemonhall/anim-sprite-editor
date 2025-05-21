import { ref } from 'vue';
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

export default function useProjectManagement() {
  const extractedFrames = ref([]); // These are asset: protocol URLs or dataURLs after edit
  const originalFrameFilePaths = ref([]); // To store original file paths from backend
  const processingMessage = ref("");
  const currentProjectName = ref(""); // Keep project name managed here for now
  const currentExtractionFps = ref(10); // Keep extraction FPS managed here

  async function processVideoWithBackend(videoPath, projectName, fpsValue) {
    processingMessage.value = "正在处理视频，请稍候...";
    extractedFrames.value = []; // Clear previous frames before processing new video
    originalFrameFilePaths.value = [];

    try {
      console.log(`[useProjectManagement] Sending to backend - Path: ${videoPath}, Project: ${projectName}, FPS: ${fpsValue}`);
      const frameFilePathsFromBackend = await invoke("process_video", { 
        path: videoPath, 
        projectName: projectName, // This project name is the one from input
        fps: Number(fpsValue)
      });
      console.log("[useProjectManagement] Backend processing result (raw file paths):", frameFilePathsFromBackend);
      
      if (Array.isArray(frameFilePathsFromBackend) && frameFilePathsFromBackend.length > 0) {
        originalFrameFilePaths.value = [...frameFilePathsFromBackend];
        extractedFrames.value = frameFilePathsFromBackend.map(p => convertFileSrc(p)); 
        processingMessage.value = `成功提取 ${frameFilePathsFromBackend.length} 帧！`;
        // Return success and frame count, App.vue can then update animatorSettings
        return { success: true, frameCount: frameFilePathsFromBackend.length };
      } else if (Array.isArray(frameFilePathsFromBackend) && frameFilePathsFromBackend.length === 0) {
        processingMessage.value = "处理成功，但未提取到任何帧。请检查视频内容和FPS设置。";
        return { success: true, frameCount: 0 };
      } else {
        processingMessage.value = "后端返回了意外的数据格式。";
        console.warn("[useProjectManagement] Unexpected backend response:", frameFilePathsFromBackend);
        return { success: false, frameCount: 0, error: "Unexpected backend response" };
      }
    } catch (error) {
      console.error("[useProjectManagement] Error calling process_video command:", error);
      processingMessage.value = `处理视频失败: ${error}`;
      return { success: false, frameCount: 0, error: String(error) };
    }
  }

  // Function to be called when ProjectSetupAndImport is ready
  // This will update local state and then call the backend processing.
  // Returns the result of backend processing.
  async function importAndProcessVideo(importData) {
    processingMessage.value = "正在准备处理视频...";
    currentProjectName.value = importData.projectName; // Update project name here
    currentExtractionFps.value = importData.fps;   // Update extraction FPS here
    
    // Reset frames before new processing
    extractedFrames.value = [];
    originalFrameFilePaths.value = [];

    return await processVideoWithBackend(importData.videoPath, importData.projectName, importData.fps);
  }


  return {
    extractedFrames,
    originalFrameFilePaths,
    processingMessage,
    currentProjectName,
    currentExtractionFps,
    // processVideoWithBackend, // Expose if direct call needed, or use wrapper
    importAndProcessVideo
  };
} 