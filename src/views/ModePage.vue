<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useImageStore } from '@/stores/imageStore'
import type { AppMode } from '@/stores/imageStore'
import AppHeader from '@/components/AppHeader.vue'
import Sidebar from '@/components/Sidebar.vue'
import DropZone from '@/components/DropZone.vue'
import ParamPanel from '@/components/ParamPanel.vue'
import FaviconPanel from '@/components/FaviconPanel.vue'
import BatchList from '@/components/BatchList.vue'
import StatusBar from '@/components/StatusBar.vue'

const route = useRoute()
const store = useImageStore()
const isFaviconMode = computed(() => store.activeMode === 'favicon')

const prefersDark = ref(false)

onMounted(() => {
  const saved = localStorage.getItem('imgtools-theme')
  if (saved === 'dark' || saved === 'light') {
    document.documentElement.classList.toggle('dark', saved === 'dark')
    prefersDark.value = saved === 'dark'
  } else {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    prefersDark.value = mq.matches
    document.documentElement.classList.toggle('dark', mq.matches)
    mq.addEventListener('change', (e) => {
      if (!localStorage.getItem('imgtools-theme')) {
        prefersDark.value = e.matches
        document.documentElement.classList.toggle('dark', e.matches)
      }
    })
  }
})

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
        <FaviconPanel v-if="isFaviconMode" />
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
  </div>
</template>

<style>
:root {
  --bg-page: #f5f5f5;
  --bg-surface: #fff;
  --bg-hover: #f5f5f5;
  --bg-active: #e8f4f8;
  --bg-dim: #f0f0f0;
  --bg-faint: #fafafa;
  --border: #eee;
  --border-strong: #ddd;
  --text: #333;
  --text-secondary: #666;
  --text-muted: #999;
  --text-faint: #bbb;
  --primary: #409eff;
  --primary-hover: #2d7ee0;
  --primary-bg: #ecf5ff;
  --primary-text: #2563eb;
  --success: #67c23a;
  --success-bg: #f0f9eb;
  --warning: #e6a23c;
  --warning-bg: #fef0f0;
  --danger: #f56c6c;
  --danger-bg: #fef0f0;
  --drop-border: #d0d5dd;
  --drop-bg: #fafbfc;
  --drop-hover-bg: #f0f7ff;
  --crop-bg: #f0f0f0;
  --crop-mask: rgba(0,0,0,0.45);
  --chip-border: #e4e7ec;
  --chip-hover: #b0b7c3;
  --chip-active-bg: #eff6ff;
  --placeholder: #98a2b3;
  --card-border: #e4e7ec;
  --card-bg: #fafbfc;
  --tag-processing-bg: #ecf5ff;
  --tag-done-bg: #f0f9eb;
  --tag-error-bg: #fef0f0;
  --tag-pending-bg: #f0f0f0;
}

:root.dark {
  --bg-page: #1a1a2e;
  --bg-surface: #16213e;
  --bg-hover: #1e2a4a;
  --bg-active: #1a3a5c;
  --bg-dim: #1e2a4a;
  --bg-faint: #0f3460;
  --border: #2a3a5c;
  --border-strong: #3a4a6c;
  --text: #e0e6f0;
  --text-secondary: #a0b0c8;
  --text-muted: #7a8aaa;
  --text-faint: #5a6a8a;
  --primary: #60b0ff;
  --primary-hover: #409eff;
  --primary-bg: #1a3050;
  --primary-text: #60b0ff;
  --success: #67c23a;
  --success-bg: #1a3a1a;
  --warning: #e6a23c;
  --danger: #f56c6c;
  --danger-bg: #3a1a1a;
  --drop-border: #3a4a6c;
  --drop-bg: #16213e;
  --drop-hover-bg: #1a3050;
  --crop-bg: #1e2a4a;
  --crop-mask: rgba(0,0,0,0.6);
  --chip-border: #3a4a6c;
  --chip-hover: #5a6a8a;
  --chip-active-bg: #1a3050;
  --placeholder: #5a6a8a;
  --card-border: #2a3a5c;
  --card-bg: #1e2a4a;
  --tag-processing-bg: #1a3050;
  --tag-done-bg: #1a3a1a;
  --tag-error-bg: #3a1a1a;
  --tag-pending-bg: #2a3a5c;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-page);
  color: var(--text);
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
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}
.content-panels {
  display: flex;
  gap: 16px;
}
.left-panel {
  flex: 1;
}
.right-panel {
  width: 240px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .app-body {
    flex-direction: column;
  }
  .main-area {
    padding: 12px;
    padding-bottom: 60px;
  }
  .content-panels {
    flex-direction: column;
  }
  .right-panel {
    width: 100%;
  }
}
</style>
