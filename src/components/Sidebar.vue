<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useImageStore } from '@/stores/imageStore'
import type { AppMode } from '@/stores/imageStore'

const router = useRouter()
const route = useRoute()
const store = useImageStore()

function switchMode(mode: AppMode) {
  if (route.name !== mode) {
    router.push({ name: mode })
  }
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
      <div
        class="mode-item"
        :class="{ active: store.activeMode === 'favicon' }"
        @click="switchMode('favicon')"
      >
        <span class="mode-icon">⭐</span>
        <span>Favicon</span>
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

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    border-right: none;
    border-top: 1px solid #eee;
    padding: 0;
    z-index: 100;
  }
  .section-title {
    display: none;
  }
  .mode-section {
    display: flex;
  }
  .mode-item {
    flex: 1;
    justify-content: center;
    padding: 10px 8px;
    font-size: 12px;
  }
  .mode-item.active {
    border-top: 2px solid #409eff;
    background: #f5faff;
  }
}
</style>
