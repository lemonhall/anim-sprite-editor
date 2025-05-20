<script setup>
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core"; // 取消注释 invoke
import { open } from "@tauri-apps/plugin-dialog";

// const greetMsg = ref(""); // Greet 功能不再需要
// const name = ref(""); // Greet 功能不再需要
const selectedVideoPath = ref("");

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
      console.log("Selected video path:", selectedVideoPath.value);
    } else {
      selectedVideoPath.value = "";
      console.log("No file selected.");
    }
  } catch (error) {
    console.error("Error selecting file:", error);
    selectedVideoPath.value = "Error selecting file.";
  }
}

// 新增: 处理视频的函数
async function handleProcessVideo() {
  if (!selectedVideoPath.value) {
    console.warn("No video selected to process.");
    // 可以考虑在这里给用户一些提示，例如使用 alert 或者一个界面元素
    alert("请先选择一个视频文件！");
    return;
  }
  try {
    console.log(`Sending path to backend: ${selectedVideoPath.value}`);
    // 调用后端的 process_video 命令
    const result = await invoke("process_video", { path: selectedVideoPath.value });
    console.log("Backend processing result:", result); // 期望后端返回一些信息
    alert(`后端消息: ${result}`); // 简单显示后端返回
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

    <!-- 新增: 开始处理按钮 -->
    <div class="row" style="margin-top: 10px;" v-if="selectedVideoPath">
      <button @click="handleProcessVideo" :disabled="!selectedVideoPath">
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
