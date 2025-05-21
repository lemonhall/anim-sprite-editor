import { ref } from 'vue';
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

export default function useProjectManagement() {
  const extractedFrames = ref([]); // These are asset: protocol URLs or dataURLs after edit
  const originalFrameFilePaths = ref([]); // To store original file paths from backend
  const processingMessage = ref("");
  const currentProjectName = ref(""); // Keep project name managed here for now
  const currentExtractionFps = ref(10); // Keep extraction FPS managed here

  async function processVideoWithBackend(videoFile, projectName, fps) {
    processingMessage.value = `正在处理视频 '${videoFile.name}'，项目名：'${projectName}'，帧率：${fps} FPS...`;
    originalFrameFilePaths.value = []; // 确保在此次处理开始时将其重置为空数组
    extractedFrames.value = [];      // 同样重置 extractedFrames

    try {
      console.log(`[useProjectManagement] 调用 process_video - 项目: ${projectName}, 文件: ${videoFile.name}, FPS: ${fps}`);
      const result = await invoke('process_video', {
        path: videoFile.path, // 假设 videoFile 对象有 path 属性
        projectName: projectName,
        fps: fps,
      });

      console.log('[useProjectManagement] 来自 process_video 的原始结果:', JSON.stringify(result)); // 记录原始结果

      if (result && result.frame_paths && Array.isArray(result.frame_paths)) {
        originalFrameFilePaths.value = result.frame_paths;
        extractedFrames.value = result.frame_paths.map(fp => {
          try {
            return convertFileSrc(fp);
          } catch (e) {
            console.error(`[useProjectManagement] 转换文件路径 ${fp} 时出错:`, e);
            return ''; // 对于转换失败的路径返回空字符串或特定占位符
          }
        }).filter(path => path !== ''); // 过滤掉转换失败的路径

        console.log('[useProjectManagement] originalFrameFilePaths.value 已设置。数量:', originalFrameFilePaths.value.length);
        // 在 App.vue 中处理总帧数等 animatorSettings 的更新，
        // 此处仅关注 projectManagement 相关的 refs
      } else {
        console.error('[useProjectManagement] process_video 未返回有效的 frame_paths。结果:', result);
        processingMessage.value = '错误：从后端获取的帧数据无效。';
        originalFrameFilePaths.value = []; // 确保在数据无效时 originalFrameFilePaths 为空数组
        extractedFrames.value = [];
      }
      // 可以在这里根据 result.total_frames 更新项目相关的总帧数 ref (如果 useProjectManagement 中有的话)
      // 例如: if (result && typeof result.total_frames === 'number') { projectTotalFrames.value = result.total_frames; }

    } catch (error) {
      console.error('[useProjectManagement] processVideoWithBackend 函数出错:', error);
      processingMessage.value = `处理视频时出错: ${error.message || String(error)}`;
      originalFrameFilePaths.value = []; // 出错时确保 originalFrameFilePaths 为安全的空数组
      extractedFrames.value = [];
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