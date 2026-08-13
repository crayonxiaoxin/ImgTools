<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '@/stores/imageStore'
import { version } from '../../package.json'
import {
  initVipsWithRetry,
  isVipsReady,
  getVipsError,
  onVipsReady,
} from '@/core/vips'

const { t } = useI18n()

const store = useImageStore()
const loading = ref(!isVipsReady())
const error = ref<string | null>(getVipsError())
const retryAttempt = ref(0)
const retryMax = ref(3)

const doneCount = computed(() => store.images.filter(i => i.status === 'done').length)
const totalCount = computed(() => store.images.length)
const showRetrying = computed(() => loading.value && (retryAttempt.value > 1 || !!error.value))

let unsubscribe: (() => void) | null = null

async function loadEngine() {
  loading.value = true
  error.value = null
  retryAttempt.value = 0
  store.setVipsLoading(true)

  try {
    await initVipsWithRetry({
      maxAttempts: retryMax.value,
      delayMs: 2000,
      onAttempt: ({ attempt, error: attemptError }) => {
        retryAttempt.value = attempt
        if (attemptError) error.value = attemptError
      },
    })
    loading.value = false
    error.value = null
    store.setVipsReady(true)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : (e as any)?.message ?? t('error.timeout')
    loading.value = false
    store.setVipsLoading(false)
    store.setVipsReady(false)
  }
}

onMounted(() => {
  unsubscribe = onVipsReady((ready, err) => {
    if (ready) {
      loading.value = false
      error.value = null
      store.setVipsReady(true)
    } else if (err && !loading.value) {
      error.value = err
    }
  })

  if (!isVipsReady()) {
    loadEngine()
  } else {
    loading.value = false
    store.setVipsReady(true)
    store.setVipsLoading(false)
  }
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<template>
  <div class="status-bar">
    <div class="status-left">
      <div v-if="loading" class="status-item">
        <span class="spinner"></span>
        <template v-if="showRetrying">
          {{ t('status.retrying', { attempt: retryAttempt, max: retryMax }) }}
        </template>
        <template v-else>
          {{ t('status.loading') }}
        </template>
      </div>
      <div v-else-if="error" class="status-item error">
        <span>{{ t('status.failed', { msg: error }) }}</span>
        <button type="button" class="retry-btn" @click="loadEngine">
          {{ t('status.retry') }}
        </button>
      </div>
      <div v-else class="status-item">
        <span>{{ t('status.ready') }}</span>
        <span v-if="totalCount > 0" class="divider">|</span>
        <span v-if="totalCount > 0">{{ t('status.progress', { done: doneCount, total: totalCount }) }}</span>
      </div>
    </div>
    <span class="version">v{{ version }}</span>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 10px var(--space-4);
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.01em;
}
.status-left {
  min-width: 0;
}
.status-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}
.status-item.error {
  color: var(--danger);
}
.retry-btn {
  margin-left: 4px;
  height: 22px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--danger) 35%, var(--border));
  border-radius: var(--radius-sm);
  background: var(--danger-bg);
  color: var(--danger);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--ease), border-color var(--ease);
}
.retry-btn:hover {
  border-color: var(--danger);
}
.divider {
  color: var(--border-strong);
}
.version {
  flex-shrink: 0;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
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

@media (max-width: 768px) {
  .status-bar {
    padding: 10px var(--space-2);
  }
}
</style>
