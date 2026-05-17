<script setup lang="ts">
import { useImageStore } from '@/stores/imageStore'
import type { AppMode } from '@/stores/imageStore'

const store = useImageStore()

function switchMode(mode: AppMode) {
  store.setMode(mode)
}
</script>

<template>
  <aside class="sidebar">
    <div class="mode-section">
      <h3 class="section-title">模式</h3>
      <div
        class="mode-item"
        :class="{ active: store.activeMode === 'compress' }"
        @click="switchMode('compress')"
      >
        <span class="mode-icon">📦</span>
        <span>压缩</span>
      </div>
      <div
        class="mode-item"
        :class="{ active: store.activeMode === 'convert' }"
        @click="switchMode('convert')"
      >
        <span class="mode-icon">🔄</span>
        <span>转换</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 160px;
  background: #fff;
  border-right: 1px solid #eee;
  padding: 16px 0;
}
.section-title {
  font-size: 11px;
  text-transform: uppercase;
  color: #999;
  padding: 0 16px;
  margin-bottom: 8px;
  letter-spacing: 1px;
}
.mode-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all 0.15s;
}
.mode-item:hover {
  background: #f5f5f5;
}
.mode-item.active {
  background: #e8f4f8;
  color: #409eff;
  font-weight: 600;
}
.mode-icon {
  font-size: 16px;
}
</style>
