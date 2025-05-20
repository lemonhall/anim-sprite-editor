<script setup>
const props = defineProps({
  frames: {
    type: Array,
    required: true,
    default: () => []
  }
});
</script>

<template>
  <div class="frames-grid-container-component" v-if="frames.length > 0">
    <div v-for="(frameSrc, index) in frames" :key="index" class="frame-item">
      <img :src="frameSrc" :alt="`Frame ${index + 1}`" />
    </div>
  </div>
  <div v-else class="no-frames-placeholder">
    <!-- Optional: Message when no frames are available to display in the grid -->
    <!-- <p>处理完成后，提取的帧将在此处显示。</p> -->
  </div>
</template>

<style scoped>
.frames-grid-container-component {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
  padding: 20px;
  margin-top: 10px;
  border-top: 1px solid #eee; 
}

.frame-item img {
  width: 100%;
  height: auto;
  object-fit: contain; 
  border: 1px solid #ddd;
  border-radius: 4px;
}

.no-frames-placeholder {
  padding: 20px;
  text-align: center;
  color: #888;
  font-size: 0.9em;
  margin-top: 10px;
}
</style> 