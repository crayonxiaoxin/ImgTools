<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '@/stores/imageStore'

const store = useImageStore()
const dragging = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

function onDragOver(e: DragEvent) {
  e.preventDefault()
  dragging.value = true
}

function onDragLeave() {
  dragging.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragging.value = false
  if (e.dataTransfer?.files.length) {
    store.addImages(Array.from(e.dataTransfer.files))
  }
}

function onFilePick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) {
    store.addImages(Array.from(input.files))
    input.value = ''
  }
}

function selectFiles() {
  inputRef.value?.click()
}
</script>

<template>
  <div
    class="drop-zone"
    :class="{ dragging }"
    role="button"
    tabindex="0"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @click="selectFiles"
    @keydown.enter="selectFiles"
    @keydown.space.prevent="selectFiles"
  >
    <input
      ref="inputRef"
      type="file"
      multiple
      accept="image/*"
      style="display:none"
      @change="onFilePick"
    />
    <div class="drop-zone-content">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <p>将图片拖拽到此处</p>
      <p class="hint">或点击选择文件</p>
    </div>
  </div>
</template>

<style scoped>
.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #fafafa;
}
.drop-zone:hover, .drop-zone.dragging {
  border-color: #409eff;
  background: #ecf5ff;
}
.drop-zone-content svg {
  color: #999;
  margin-bottom: 8px;
}
.drop-zone-content p {
  margin: 4px 0;
  font-size: 14px;
  color: #333;
}
.hint {
  font-size: 12px !important;
  color: #999 !important;
}
</style>
