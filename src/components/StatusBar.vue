<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '@/stores/imageStore'
import { initVips, isVipsReady, getVipsError, onVipsReady } from '@/core/vips'

const { t } = useI18n()

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
        error.value = e.message ?? t('error.timeout')
        loading.value = false
      })
  } else {
    loading.value = false
    store.setVipsReady(true)
  }

  onVipsReady((_ready, err) => {
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
      {{ t('status.loading') }}
    </div>
    <div v-else-if="error" class="status-item error">
      {{ t('status.failed', { msg: error }) }}
    </div>
    <div v-else class="status-item">
      <span>{{ t('status.ready') }}</span>
      <span v-if="totalCount > 0" class="divider">|</span>
      <span v-if="totalCount > 0">{{ t('status.progress', { done: doneCount, total: totalCount }) }}</span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: var(--bg-faint);
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-secondary);
}
.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-item.error {
  color: var(--danger);
}
.divider {
  color: var(--border-strong);
}
.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border-strong);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
