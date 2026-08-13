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

      <button
        type="button"
        class="mode-item"
        :class="{ active: store.activeMode === 'compress' }"
        @click="switchMode('compress')"
      >
        <svg class="mode-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>
        <span>{{ t('sidebar.compress') }}</span>
      </button>

      <button
        type="button"
        class="mode-item"
        :class="{ active: store.activeMode === 'convert' }"
        @click="switchMode('convert')"
      >
        <svg class="mode-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
        <span>{{ t('sidebar.convert') }}</span>
      </button>

      <button
        type="button"
        class="mode-item"
        :class="{ active: store.activeMode === 'favicon' }"
        @click="switchMode('favicon')"
      >
        <svg class="mode-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9"/></svg>
        <span>{{ t('sidebar.favicon') }}</span>
      </button>

      <button
        type="button"
        class="mode-item"
        :class="{ active: store.activeMode === 'pdf' }"
        @click="switchMode('pdf')"
      >
        <svg class="mode-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
        <span>{{ t('sidebar.pdf') }}</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 188px;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  padding: var(--space-3) var(--space-2);
}
.section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 0 var(--space-2);
  margin-bottom: var(--space-2);
  letter-spacing: 0.08em;
}
.mode-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  margin-bottom: 2px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  text-align: left;
  transition: background var(--ease), color var(--ease);
}
.mode-item:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.mode-item.active {
  background: var(--bg-active);
  color: var(--primary-text);
}
.mode-icon {
  flex-shrink: 0;
  opacity: 0.85;
}
.mode-item.active .mode-icon {
  opacity: 1;
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
    background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
    backdrop-filter: blur(12px);
  }
  .section-title { display: none; }
  .mode-section { display: flex; }
  .mode-item {
    flex: 1;
    justify-content: center;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    border-radius: 0;
    padding: 10px 6px;
    min-height: 60px;
    font-size: 11px;
    font-weight: 500;
  }
  .mode-item.active {
    border-top: 2px solid var(--primary);
    background: var(--primary-bg);
  }
}
</style>
