<script setup>
import { ref } from "vue";
import { invoke, convertFileSrc } from "@tauri-apps/api/core"; // 导入 convertFileSrc
import { open } from "@tauri-apps/plugin-dialog";

// const greetMsg = ref(""); // Greet 功能不再需要
// const name = ref(""); // Greet 功能不再需要
const selectedVideoPath = ref("");
const projectName = ref(""); // 新增: 项目名称
const videoPlayerSrc = ref(""); // 新增: 用于视频播放器的 src

// async function greet() { // Greet 功能不再需要
//   // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//   greetMsg.value = await invoke("greet", { name: name.value });
// }

// 检查项目名称是否有效 (辅助函数)
function isProjectNameValid(name) {
  if (!name.trim()) return false;
  return /^[a-zA-Z0-9_-]+$/.test(name.trim());
}

async function selectVideoFile() {
  try {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Video',
        extensions: ['mp4']
      }]
    });
    if (selected) {
      const path = Array.isArray(selected) ? selected[0] : selected;
      selectedVideoPath.value = path;
      videoPlayerSrc.value = convertFileSrc(path); // 转换为可播放的 URL
      console.log("Selected video path:", path);
      console.log("Video player src:", videoPlayerSrc.value);

      if (isProjectNameValid(projectName.value)) {
        console.log("Project name is valid, attempting auto-process...");
        await handleProcessVideo(); 
      } else {
        console.log("Project name is not (yet) valid, skipping auto-process.");
      }
    } else {
      selectedVideoPath.value = "";
      videoPlayerSrc.value = ""; // 清空播放器 src
      console.log("No file selected.");
    }
  } catch (error) {
    console.error("Error selecting file:", error);
    selectedVideoPath.value = "Error selecting file.";
    videoPlayerSrc.value = ""; // 出错时清空
  }
}

// 新增: 处理视频的函数
async function handleProcessVideo() {
  if (!selectedVideoPath.value) {
    alert("请先选择一个视频文件！");
    return;
  }
  if (!isProjectNameValid(projectName.value)) {
    alert("请输入有效的项目名称 (只能包含英文字母、数字、下划线和中划线)！");
    return;
  }

  try {
    console.log(`Sending to backend - Path: ${selectedVideoPath.value}, Project: ${projectName.value.trim()}`);
    const result = await invoke("process_video", { 
      path: selectedVideoPath.value, 
      projectName: projectName.value.trim()
    });
    console.log("Backend processing result:", result);
    alert(`后端消息: ${result}`);
  } catch (error) {
    console.error("Error calling process_video command:", error);
    alert(`处理视频失败: ${error}`);
  }
}
</script>

<template>
  <main class="container">
    <!-- <h1>视频转精灵图工具</h1> --> <!-- 移除页面标题 -->

    <!-- 项目名称输入框 - 保持在左上角区域 -->
    <div style="display: flex; justify-content: flex-start; align-items: center; margin-bottom: 20px; padding-left: 20px;">
      <label for="project-name-input" style="margin-right: 8px; font-size: 0.9em;">项目名称:</label>
      <input 
        id="project-name-input"
        type="text" 
        v-model="projectName" 
        placeholder="(英文/数字/_-)"
        style="width: 200px; padding: 0.4em 0.8em; font-size: 0.9em;"
      />
    </div>

    <!-- "导入" 按钮居中 -->
    <div class="row" style="margin-top: 10px;"> <!-- 调整了 margin-top -->
      <button @click="selectVideoFile">导入</button>
    </div>
    <!-- <p v-if="selectedVideoPath">已导入: {{ selectedVideoPath }}</p> --> <!-- 移除已导入提示 -->

    <!-- 新增: 视频播放器 -->
    <div class="row" style="margin-top: 20px;" v-if="videoPlayerSrc">
      <video :src="videoPlayerSrc" controls style="max-width: 80%; max-height: 400px; border: 1px solid #ccc;"></video>
    </div>

    <!-- 移除了 Vite, Tauri, Vue logos 和相关文字 -->
    <!--
    <div class="row">
      <a href="https://vitejs.dev" target="_blank">
        <img src="/vite.svg" class="logo vite" alt="Vite logo" />
      </a>
      <a href="https://tauri.app" target="_blank">
        <img src="/tauri.svg" class="logo tauri" alt="Tauri logo" />
      </a>
      <a href="https://vuejs.org/" target="_blank">
        <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
      </a>
    </div>
    <p>Click on the Tauri, Vite, and Vue logos to learn more.</p>
    -->

    <!-- 移除了 Greet 功能的表单 -->
    <!--
    <form class="row" @submit.prevent="greet">
      <input id="greet-input" v-model="name" placeholder="Enter a name..." />
      <button type="submit">Greet</button>
    </form>
    <p>{{ greetMsg }}</p>
    -->

  </main>
</template>

<style scoped>
/* 清理了 scoped 样式，移除了 .logo 相关定义 */
</style>
<style>
/* 清理了全局样式，移除了 .logo 和 a 相关定义 */
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;

  color: #0f0f0f;
  background-color: #f6f6f6;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

.container {
  margin: 0;
  padding-top: 20px; /* 减少顶部内边距 */
  display: flex;
  flex-direction: column;
  /* justify-content: center; */ /* 让内容自然流动，项目名靠左，其他 .row 元素居中 */
  /* text-align: center; */ /* text-align 会影响 label，在 row 中处理居中 */
}

.row {
  display: flex;
  justify-content: center; /* 保持 .row 内元素居中 */
  width: 100%; /* 确保 .row 占据可用宽度以便正确居中其内容 */
}

h1 {
  text-align: center;
}

input, /* 保留 input 基础样式，虽然目前没有，但后续可能添加 */
button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  color: #0f0f0f;
  background-color: #ffffff;
  transition: border-color 0.25s;
  box-shadow: 0 2px 2px rgba(0, 0, 0, 0.2);
}

button {
  cursor: pointer;
}

button:hover {
  border-color: #396cd8;
}
button:active {
  border-color: #396cd8;
  background-color: #e8e8e8;
}

input,
button {
  outline: none;
}

/* #greet-input 相关样式已在上次移除 */

@media (prefers-color-scheme: dark) {
  :root {
    color: #f6f6f6;
    background-color: #2f2f2f;
  }

  input,
  button {
    color: #ffffff;
    background-color: #0f0f0f98;
  }
  button:active {
    background-color: #0f0f0f69;
  }
}
</style>
