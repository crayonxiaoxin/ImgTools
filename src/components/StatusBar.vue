<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useImageStore } from '@/stores/imageStore'
import { initVips, isVipsReady, getVipsError, onVipsReady } from '@/core/vips'

const store = useImageStore()
const loading = ref(!isVipsReady())
const error = ref<string | null>(getVipsError())

const doneCount = computed(() => store.images.filter(i => i.status === 'done').length)
const totalCount = computed(() => store.images.length)

onMounted(() => {
  if (!isVipsReady()) {
    initVips()
      .then(() => {
        loading.value = false
        store.setVipsReady(true)
      })
      .catch((e: any) => {
        error.value = e.message ?? 'Failed to load image processor'
        loading.value = false
      })
  } else {
    loading.value = false
    store.setVipsReady(true)
  }

  onVipsReady((ready, err) => {
    loading.value = false
    if (err) error.value = err
    else store.setVipsReady(true)
  })
})
</script>

<template>
  <div class="status-bar">
    <div v-if="loading" class="status-item">
      <span class="spinner"></span>
      加载图像引擎...
    </div>
    <div v-else-if="error" class="status-item error">
      引擎加载失败: {{ error }}
    </div>
    <div v-else class="status-item">
      <span>引擎就绪</span>
      <span v-if="totalCount > 0" class="divider">|</span>
      <span v-if="totalCount > 0">{{ doneCount }}/{{ totalCount }} 已完成</span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: #fafafa;
  border-top: 1px solid #eee;
  font-size: 12px;
  color: #666;
}
.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-item.error {
  color: #f56c6c;
}
.divider {
  color: #ddd;
}
.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #ddd;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
