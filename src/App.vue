<script setup lang="ts">
import { computed } from 'vue'
import { useImageStore } from '@/stores/imageStore'
import AppHeader from '@/components/AppHeader.vue'
import Sidebar from '@/components/Sidebar.vue'
import DropZone from '@/components/DropZone.vue'
import ParamPanel from '@/components/ParamPanel.vue'
import FaviconPanel from '@/components/FaviconPanel.vue'
import BatchList from '@/components/BatchList.vue'
import StatusBar from '@/components/StatusBar.vue'

const store = useImageStore()
const isFaviconMode = computed(() => store.activeMode === 'favicon')
</script>

<template>
  <div class="app-layout">
    <AppHeader />
    <div class="app-body">
      <Sidebar />
      <main class="main-area">
        <template v-if="isFaviconMode">
          <div class="content-panels">
            <div class="left-panel">
              <DropZone />
            </div>
            <div class="right-panel">
              <FaviconPanel />
            </div>
          </div>
        </template>
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
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
}
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.app-body {
  display: flex;
  flex: 1;
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
