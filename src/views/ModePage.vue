<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useImageStore } from '@/stores/imageStore'
import type { AppMode } from '@/stores/imageStore'
import AppHeader from '@/components/AppHeader.vue'
import Sidebar from '@/components/Sidebar.vue'
import DropZone from '@/components/DropZone.vue'
import ParamPanel from '@/components/ParamPanel.vue'
import FaviconPanel from '@/components/FaviconPanel.vue'
import PdfPanel from '@/components/PdfPanel.vue'
import BatchList from '@/components/BatchList.vue'
import StatusBar from '@/components/StatusBar.vue'
import ToastHost from '@/components/ToastHost.vue'
import { useI18n } from 'vue-i18n'

// Initialize theme BEFORE child components mount
const savedTheme = localStorage.getItem('imgtools-theme')
if (savedTheme === 'dark' || savedTheme === 'light') {
  document.documentElement.classList.toggle('dark', savedTheme === 'dark')
} else {
  document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches)
}
// Listen for system changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('imgtools-theme')) {
    document.documentElement.classList.toggle('dark', e.matches)
  }
})

const { t } = useI18n()
const route = useRoute()
const store = useImageStore()
const isFaviconMode = computed(() => store.activeMode === 'favicon')
const showEngineHint = computed(() => store.vipsLoading && !store.vipsReady)

watch(() => route.name, (name) => {
  if (name && typeof name === 'string') {
    store.setMode(name as AppMode)
  }
}, { immediate: true })
</script>

<template>
  <div class="app-layout">
    <AppHeader />
    <div class="app-body">
      <Sidebar />
      <main class="main-area">
        <Transition name="engine-hint">
          <div v-if="showEngineHint" class="engine-hint" role="status">
            <span class="engine-spinner" aria-hidden="true"></span>
            <div>
              <p class="engine-title">{{ t('status.engineHintTitle') }}</p>
              <p class="engine-desc">{{ t('status.engineHintDesc') }}</p>
            </div>
          </div>
        </Transition>
        <FaviconPanel v-if="isFaviconMode" />
        <PdfPanel v-else-if="store.activeMode === 'pdf'" />
        <template v-else>
          <div class="content-panels">
            <div class="left-panel">
              <DropZone />
            </div>
            <div class="right-panel">
              <ParamPanel />
            </div>
          </div>
          <BatchList />
        </template>
      </main>
    </div>
    <StatusBar />
    <ToastHost />
  </div>
</template>

<style>
:root {
  --space-1: 8px;
  --space-2: 12px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --font-caption: 12px;
  --font-body: 14px;
  --font-title: 15px;
  --font-display: 18px;
  --control-h: 34px;
  --shadow-soft: 0 0 0 1px rgba(15, 23, 42, 0.04);
  --ease: 160ms cubic-bezier(0.2, 0.8, 0.2, 1);

  --bg-page: #f6f7f9;
  --bg-surface: #ffffff;
  --bg-hover: #f1f3f5;
  --bg-active: #eef2ff;
  --bg-dim: #eceef2;
  --bg-faint: #fafbfc;
  --border: #e8eaee;
  --border-strong: #d8dbe2;
  --text: #111827;
  --text-secondary: #4b5563;
  --text-muted: #9ca3af;
  --text-faint: #c4c9d4;
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --primary-bg: #eff4ff;
  --primary-text: #1d4ed8;
  --success: #16a34a;
  --success-bg: #f0fdf4;
  --warning: #d97706;
  --warning-bg: #fffbeb;
  --danger: #dc2626;
  --danger-bg: #fef2f2;
  --drop-border: #d5d9e2;
  --drop-bg: #fbfcfd;
  --drop-hover-bg: #f5f8ff;
  --crop-bg: #eceef2;
  --crop-mask: rgba(15, 23, 42, 0.48);
  --chip-border: #e2e5eb;
  --chip-hover: #94a3b8;
  --chip-active-bg: #eff4ff;
  --placeholder: #94a3b8;
  --card-border: #e8eaee;
  --card-bg: #fbfcfd;
  --tag-processing-bg: #eff4ff;
  --tag-done-bg: #f0fdf4;
  --tag-error-bg: #fef2f2;
  --tag-pending-bg: #eceef2;
}

:root.dark {
  --shadow-soft: 0 0 0 1px rgba(255, 255, 255, 0.06);
  --bg-page: #0b0c0f;
  --bg-surface: #12141a;
  --bg-hover: #1a1d26;
  --bg-active: #172033;
  --bg-dim: #1a1d26;
  --bg-faint: #0e1015;
  --border: #23262f;
  --border-strong: #323642;
  --text: #f3f4f6;
  --text-secondary: #a1a8b3;
  --text-muted: #6b7280;
  --text-faint: #4b5563;
  --primary: #60a5fa;
  --primary-hover: #3b82f6;
  --primary-bg: #152238;
  --primary-text: #93c5fd;
  --success: #22c55e;
  --success-bg: #0f2418;
  --warning: #f59e0b;
  --warning-bg: #2a1f0a;
  --danger: #f87171;
  --danger-bg: #2a1212;
  --drop-border: #323642;
  --drop-bg: #12141a;
  --drop-hover-bg: #152238;
  --crop-bg: #1a1d26;
  --crop-mask: rgba(0, 0, 0, 0.62);
  --chip-border: #323642;
  --chip-hover: #6b7280;
  --chip-active-bg: #152238;
  --placeholder: #6b7280;
  --card-border: #23262f;
  --card-bg: #1a1d26;
  --tag-processing-bg: #152238;
  --tag-done-bg: #0f2418;
  --tag-error-bg: #2a1212;
  --tag-pending-bg: #1a1d26;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: var(--font-body);
  font-feature-settings: 'ss01' on, 'cv11' on;
  letter-spacing: -0.011em;
  background: var(--bg-page);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

button, input, select, textarea {
  font: inherit;
  letter-spacing: inherit;
}

.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.main-area {
  position: relative;
  flex: 1;
  padding: var(--space-4);
  overflow-y: auto;
}
.content-panels {
  display: flex;
  gap: var(--space-3);
  align-items: stretch;
}
.left-panel {
  flex: 1;
  min-width: 0;
}
.right-panel {
  width: 300px;
  flex-shrink: 0;
}

.engine-hint {
  position: absolute;
  top: var(--space-4);
  left: var(--space-4);
  right: var(--space-4);
  z-index: 20;
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--primary) 22%, var(--border));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-surface) 88%, var(--primary-bg));
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-soft), 0 8px 24px rgba(15, 23, 42, 0.06);
  pointer-events: none;
}
.engine-hint-enter-active,
.engine-hint-leave-active {
  transition: opacity var(--ease), transform var(--ease);
}
.engine-hint-enter-from,
.engine-hint-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.engine-spinner {
  width: 14px;
  height: 14px;
  margin-top: 2px;
  flex-shrink: 0;
  border: 2px solid color-mix(in srgb, var(--primary) 30%, transparent);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: engine-spin 0.7s linear infinite;
}
@keyframes engine-spin {
  to { transform: rotate(360deg); }
}
.engine-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text);
}
.engine-desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .app-layout {
    padding-bottom: 60px;
  }
  .app-body {
    flex-direction: column;
  }
  .main-area {
    padding: var(--space-2);
  }
  .engine-hint {
    top: var(--space-2);
    left: var(--space-2);
    right: var(--space-2);
  }
  .content-panels {
    flex-direction: column;
    gap: var(--space-3);
  }
  .right-panel {
    width: 100%;
  }
}
</style>
