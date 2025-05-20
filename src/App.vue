<script setup>
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core"; // 取消注释 invoke
import { open } from "@tauri-apps/plugin-dialog";

// const greetMsg = ref(""); // Greet 功能不再需要
// const name = ref(""); // Greet 功能不再需要
const selectedVideoPath = ref("");
const projectName = ref(""); // 新增: 项目名称

// async function greet() { // Greet 功能不再需要
//   // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//   greetMsg.value = await invoke("greet", { name: name.value });
// }

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
      if (Array.isArray(selected)) {
        selectedVideoPath.value = selected[0];
      } else {
        selectedVideoPath.value = selected;
      }
      projectName.value = ""; // 选择新视频时，清空项目名称，或基于文件名建议一个?
      console.log("Selected video path:", selectedVideoPath.value);
    } else {
      selectedVideoPath.value = "";
      projectName.value = "";
      console.log("No file selected.");
    }
  } catch (error) {
    console.error("Error selecting file:", error);
    selectedVideoPath.value = "Error selecting file.";
    projectName.value = "";
  }
}

// 新增: 处理视频的函数
async function handleProcessVideo() {
  if (!selectedVideoPath.value) {
    alert("请先选择一个视频文件！");
    return;
  }
  if (!projectName.value.trim()) { // 检查项目名称是否为空或仅包含空格
    alert("请输入项目名称！");
    return;
  }
  // 简单的英文项目名校验 (只允许字母、数字、下划线、中划线)
  if (!/^[a-zA-Z0-9_-]+$/.test(projectName.value.trim())) {
    alert("项目名称只能包含英文字母、数字、下划线和中划线。");
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
    <h1>视频转精灵图工具</h1>

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

    <div class="row" style="margin-top: 20px;">
      <button @click="selectVideoFile">选择 MP4 视频文件</button>
    </div>
    <p v-if="selectedVideoPath">已选择: {{ selectedVideoPath }}</p>

    <!-- 新增: 项目名称输入框 -->
    <div class="row" style="margin-top: 10px;" v-if="selectedVideoPath">
      <input 
        type="text" 
        v-model="projectName" 
        placeholder="请输入项目名称 (英文/数字)"
        style="margin-right: 10px; width: 200px;"
      />
    </div>

    <!-- 修改: 开始处理按钮 -->
    <div class="row" style="margin-top: 10px;" v-if="selectedVideoPath">
      <button 
        @click="handleProcessVideo" 
        :disabled="!selectedVideoPath || !projectName.trim()"
      >
        开始处理
      </button>
    </div>

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
  padding-top: 10vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}

.row {
  display: flex;
  justify-content: center;
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
