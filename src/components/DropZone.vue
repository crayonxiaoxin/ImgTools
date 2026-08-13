<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '@/stores/imageStore'

const { t } = useI18n()
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
      <div class="icon-wrap">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <p class="prompt">{{ t('dropzone.prompt') }}</p>
      <p class="hint">{{ t('dropzone.hint') }}</p>
    </div>
  </div>
</template>

<style scoped>
.drop-zone {
  height: 100%;
  min-height: 220px;
  border: 1px dashed var(--drop-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-4);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--ease), background var(--ease), box-shadow var(--ease);
  background: var(--drop-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}
.drop-zone:hover, .drop-zone.dragging {
  border-color: var(--primary);
  background: var(--drop-hover-bg);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 20%, transparent);
}
.icon-wrap {
  width: 44px;
  height: 44px;
  margin: 0 auto var(--space-3);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-muted);
  transition: color var(--ease), border-color var(--ease);
}
.drop-zone:hover .icon-wrap,
.drop-zone.dragging .icon-wrap {
  color: var(--primary);
  border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
}
.prompt {
  margin: 0 0 6px;
  font-size: var(--font-title);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text);
}
.hint {
  margin: 0;
  font-size: var(--font-caption);
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .drop-zone {
    min-height: 148px;
    padding: var(--space-4) var(--space-3);
  }
}
</style>
