import { ref } from 'vue';
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

export default function useProjectManagement() {
  const extractedFrames = ref([]); // These are asset: protocol URLs or dataURLs after edit
  const originalFrameFilePaths = ref([]); // To store original file paths from backend
  const processingMessage = ref("");
  const currentProjectName = ref(""); // Keep project name managed here for now
  const currentExtractionFps = ref(10); // Keep extraction FPS managed here

  async function processVideoWithBackend(videoFile, projectName, fps) {
    // videoFile is expected to be the path string here.
    // Extract filename from the path for the message.
    const fileNameForMessage = (typeof videoFile === 'string' && videoFile) ? videoFile.split(/[\\/]/).pop() || videoFile : '未知文件';
    
    processingMessage.value = `正在处理视频 '${fileNameForMessage}'，项目名：'${projectName}'，帧率：${fps} FPS...`;
    originalFrameFilePaths.value = []; // 确保在此次处理开始时将其重置为空数组
    extractedFrames.value = [];      // 同样重置 extractedFrames

    try {
      console.log(`[useProjectManagement] 调用 process_video - 项目: ${projectName}, 文件: ${fileNameForMessage}, FPS: ${fps}`);
      const result = await invoke('process_video', {
        path: videoFile, // Use videoFile directly as it is the path string
        projectName: projectName,
        fps: fps,
      });

      console.log('[useProjectManagement] 来自 process_video 的原始结果 (应为帧路径数组):', JSON.stringify(result)); // 记录原始结果

      if (result && Array.isArray(result)) {
        originalFrameFilePaths.value = result;
        extractedFrames.value = result.map(fp => {
          try {
            return convertFileSrc(fp);
          } catch (e) {
            console.error(`[useProjectManagement] 转换文件路径 ${fp} 时出错:`, e);
            return ''; 
          }
        }).filter(path => path !== ''); 

        console.log('[useProjectManagement] originalFrameFilePaths.value 已设置。数量:', originalFrameFilePaths.value.length);
        return originalFrameFilePaths.value; // <--- 在成功时返回帧路径
      } else {
        console.error('[useProjectManagement] process_video 未返回有效的帧路径数组。结果:', result);
        processingMessage.value = '错误：从后端获取的帧数据无效或格式不正确。';
        originalFrameFilePaths.value = []; 
        extractedFrames.value = [];
        return []; // <--- 在结果无效时返回空数组
      }
    } catch (error) {
      console.error('[useProjectManagement] processVideoWithBackend 函数出错:', error);
      processingMessage.value = `处理视频时出错: ${error.message || String(error)}`;
      originalFrameFilePaths.value = []; 
      extractedFrames.value = [];
      return []; // <--- 在捕获到错误时返回空数组
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