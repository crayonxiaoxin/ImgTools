<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useImageStore } from '@/stores/imageStore'
import { useImageProcessor } from '@/composables/useImageProcessor'
import { useBatchExport } from '@/composables/useBatchExport'
import { formatSize } from '@/utils/format'

const { t } = useI18n()
const store = useImageStore()

const statusKey: Record<string, string> = {
  pending: 'batch.statusPending',
  processing: 'batch.statusProcessing',
  done: 'batch.statusDone',
  error: 'batch.statusError',
}
const { processAll } = useImageProcessor()
const { downloadSingle, downloadAllAsZip, downloadAllIndividual } = useBatchExport()

function hasResults(): boolean {
  return store.images.some(i => i.status === 'done')
}
</script>

<template>
  <div class="batch-list">
    <div class="batch-header">
      <h3>{{ t('batch.title', { n: store.images.length }) }}</h3>
      <div class="batch-actions">
        <button
          class="btn btn-primary"
          :disabled="store.processing"
          @click="processAll"
        >
          {{ store.processing ? t('batch.processing') : t('batch.start') }}
        </button>
        <button
          class="btn"
          :disabled="!hasResults()"
          @click="downloadAllAsZip"
        >{{ t('batch.exportZip') }}</button>
        <button
          class="btn"
          :disabled="!hasResults()"
          @click="downloadAllIndividual"
        >{{ t('batch.downloadAll') }}</button>
        <button
          class="btn btn-danger"
          :disabled="store.images.length === 0"
          @click="store.clearAll()"
        >{{ t('batch.clear') }}</button>
      </div>
    </div>
    <div class="batch-table-wrap" v-if="store.images.length > 0">
      <table class="batch-table">
        <thead>
          <tr>
            <th></th>
            <th>{{ t('batch.colFilename') }}</th>
            <th>{{ t('batch.colOriginalSize') }}</th>
            <th>{{ t('batch.colFormat') }}</th>
            <th>{{ t('batch.colResult') }}</th>
            <th>{{ t('batch.colStatus') }}</th>
            <th>{{ t('batch.colAction') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in store.images" :key="item.id">
            <td class="thumb-cell">
              <img v-if="item.previewUrl" :src="item.previewUrl" :alt="item.name" class="thumb" />
            </td>
            <td :title="item.name">{{ item.name }}</td>
            <td>{{ formatSize(item.size) }}</td>
            <td>
              {{ item.format?.toUpperCase() ?? '-' }}
              <template v-if="item.status === 'done' && item.config.targetFormat !== item.format">
                → {{ item.config.targetFormat.toUpperCase() }}
              </template>
            </td>
            <td>
              <template v-if="item.resultSize">
                <span v-if="item.resultSize < item.size" class="rate">
                  → {{ formatSize(item.resultSize) }} (-{{ ((1 - item.resultSize / item.size) * 100).toFixed(0) }}%)
                </span>
                <span v-else class="rate-negative">{{ t('batch.uncompressed') }}</span>
              </template>
              <span v-else>-</span>
            </td>
            <td>
              <span class="status-tag" :class="item.status">
                {{ t(statusKey[item.status]) }}
              </span>
            </td>
            <td>
              <button
                v-if="item.status === 'done'"
                class="btn btn-sm"
                @click="downloadSingle(item.id)"
              >{{ t('batch.download') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.batch-list {
  margin-top: 16px;
}
.batch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.batch-header h3 {
  font-size: 14px;
  font-weight: 600;
}
.batch-actions {
  display: flex;
  gap: 6px;
}
.btn {
  padding: 6px 14px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: var(--bg-surface);
  font-size: 13px;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: var(--bg-dim);
  color: var(--text-muted);
  border-color: var(--border);
}
.btn-primary {
  background: var(--primary);
  color: var(--bg-surface);
  border-color: var(--primary);
}
.btn-primary:disabled {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-primary:disabled::before {
  content: '';
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.6);
  border-top-color: var(--bg-surface);
  border-radius: 50%;
  animation: btn-spin 0.6s linear infinite;
}
@keyframes btn-spin {
  to { transform: rotate(360deg); }
}
.btn-danger {
  color: var(--danger);
  border-color: var(--danger);
}
.btn-sm {
  padding: 2px 8px;
  font-size: 12px;
}
.batch-table-wrap {
  overflow-x: auto;
}
.batch-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.batch-table th {
  background: var(--bg-hover);
  padding: 8px 10px;
  text-align: left;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}
.batch-table td {
  padding: 8px 10px;
  border-top: 1px solid var(--border);
}
.thumb-cell {
  width: 48px;
  padding: 4px !important;
}
.thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  display: block;
}
.status-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}
.status-tag.pending { background: var(--bg-dim); color: var(--text-muted); }
.status-tag.processing {
  background: var(--primary-bg);
  color: var(--primary);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.status-tag.processing::before {
  content: '';
  width: 10px;
  height: 10px;
  border: 2px solid var(--primary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: proc-spin 0.6s linear infinite;
}
@keyframes proc-spin {
  to { transform: rotate(360deg); }
}
.status-tag.done { background: var(--success-bg); color: var(--success); }
.status-tag.error { background: var(--danger-bg); color: var(--danger); }
.rate {
  color: var(--success);
  font-weight: 500;
}
.rate-negative {
  color: var(--warning);
  font-weight: 500;
}

@media (max-width: 768px) {
  .batch-table th,
  .batch-table td {
    padding: 6px 4px;
    font-size: 12px;
  }
  .batch-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .batch-actions {
    flex-wrap: wrap;
  }
  .thumb-cell {
    width: 36px;
  }
  .thumb {
    width: 28px;
    height: 28px;
  }
}
</style>
