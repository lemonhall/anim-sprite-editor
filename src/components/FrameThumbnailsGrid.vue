<script setup>
import { computed } from 'vue';

const props = defineProps({
  frames: {
    type: Array,
    required: true,
    default: () => []
  },
  selectedRange: {
    type: Object,
    required: true,
    default: () => ({ start: 0, end: -1 })
  }
});

const emit = defineEmits(['edit-frame-requested']);

const isFrameSelected = (index) => {
  if (props.selectedRange && typeof props.selectedRange.start === 'number' && typeof props.selectedRange.end === 'number') {
    return index >= props.selectedRange.start && index <= props.selectedRange.end;
  }
  return false;
};

const handleDoubleClick = (index) => {
  console.log(`[FrameGrid] Double-clicked on frame index: ${index}`);
  emit('edit-frame-requested', index);
};
</script>

<template>
  <div class="frames-grid-container-component" v-if="frames.length > 0">
    <div 
      v-for="(frameSrc, index) in frames" 
      :key="index" 
      class="frame-item" 
      :class="{ 'is-selected': isFrameSelected(index) }"
    >
      <img 
        :src="frameSrc" 
        :alt="`Frame ${index}`" 
        @dblclick="handleDoubleClick(index)" />
      <span class="frame-sequence-number">{{ index }}</span>
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

.frame-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px;
}

.frame-item img {
  width: 100%;
  height: auto;
  object-fit: contain; 
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

.frame-item.is-selected img {
  border: 2px dashed #007bff;
  outline: 1px solid transparent;
}

.frame-sequence-number {
  margin-top: 4px;
  font-size: 0.8em;
  color: #555;
}

.no-frames-placeholder {
  padding: 20px;
  text-align: center;
  color: #888;
  font-size: 0.9em;
  margin-top: 10px;
}

@media (prefers-color-scheme: dark) {
  .frames-grid-container-component {
    border-top-color: #444;
  }
  .frame-item img {
    border-color: #555;
  }
  .frame-item.is-selected img {
    border-color: #378CE7;
  }
  .frame-sequence-number {
    color: #bbb;
  }
  .no-frames-placeholder {
    color: #aaa;
  }
}
</style> 