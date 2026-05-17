<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import Sidebar from '@/components/Sidebar.vue'
import DropZone from '@/components/DropZone.vue'
import ImagePreview from '@/components/ImagePreview.vue'
import ParamPanel from '@/components/ParamPanel.vue'
import BatchList from '@/components/BatchList.vue'
import StatusBar from '@/components/StatusBar.vue'
</script>

<template>
  <div class="app-layout">
    <AppHeader />
    <div class="app-body">
      <Sidebar />
      <main class="main-area">
        <div class="content-panels">
          <div class="left-panel">
            <DropZone />
            <ImagePreview />
          </div>
          <div class="right-panel">
            <ParamPanel />
          </div>
        </div>
        <BatchList />
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
</style>
