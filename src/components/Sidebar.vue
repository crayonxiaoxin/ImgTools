<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useImageStore } from '@/stores/imageStore'
import type { AppMode } from '@/stores/imageStore'

const { t } = useI18n()
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
      <h3 class="section-title">{{ t('sidebar.mode') }}</h3>
      <div
        class="mode-item"
        :class="{ active: store.activeMode === 'compress' }"
        @click="switchMode('compress')"
      >
        <span class="mode-icon">📦</span>
        <span>{{ t('sidebar.compress') }}</span>
      </div>
      <div
        class="mode-item"
        :class="{ active: store.activeMode === 'convert' }"
        @click="switchMode('convert')"
      >
        <span class="mode-icon">🔄</span>
        <span>{{ t('sidebar.convert') }}</span>
      </div>
      <div
        class="mode-item"
        :class="{ active: store.activeMode === 'favicon' }"
        @click="switchMode('favicon')"
      >
        <span class="mode-icon">⭐</span>
        <span>{{ t('sidebar.favicon') }}</span>
      </div>
      <div
        class="mode-item"
        :class="{ active: store.activeMode === 'pdf' }"
        @click="switchMode('pdf')"
      >
        <span class="mode-icon">📄</span>
        <span>{{ t('sidebar.pdf') }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 160px;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  padding: 16px 0;
}
.section-title {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-muted);
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
  color: var(--text-secondary);
  transition: all 0.15s;
}
.mode-item:hover {
  background: var(--bg-hover);
}
.mode-item.active {
  background: var(--bg-active);
  color: var(--primary);
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
    border-top: 1px solid var(--border);
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
    border-top: 2px solid var(--primary);
    background: var(--primary-bg);
  }
}
</style>
