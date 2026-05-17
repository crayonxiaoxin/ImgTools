<script setup lang="ts">
import { useImageStore } from '@/stores/imageStore'
import { useImageProcessor } from '@/composables/useImageProcessor'
import { useBatchExport } from '@/composables/useBatchExport'
import { formatSize } from '@/utils/format'

const store = useImageStore()
const { processAll } = useImageProcessor()
const { downloadSingle, downloadAllAsZip, downloadAllIndividual } = useBatchExport()

const statusLabels: Record<string, string> = {
  pending: '等待处理',
  processing: '处理中',
  done: '已完成',
  error: '失败',
}

function hasResults(): boolean {
  return store.images.some(i => i.status === 'done')
}
</script>

<template>
  <div class="batch-list">
    <div class="batch-header">
      <h3>文件列表 ({{ store.images.length }})</h3>
      <div class="batch-actions">
        <button
          class="btn btn-primary"
          :disabled="store.processing"
          @click="processAll"
        >
          {{ store.processing ? '处理中...' : '开始处理' }}
        </button>
        <button
          class="btn"
          :disabled="!hasResults()"
          @click="downloadAllAsZip"
        >导出 ZIP</button>
        <button
          class="btn"
          :disabled="!hasResults()"
          @click="downloadAllIndividual"
        >逐个下载</button>
        <button
          class="btn btn-danger"
          :disabled="store.images.length === 0"
          @click="store.clearAll()"
        >清空</button>
      </div>
    </div>
    <div class="batch-table-wrap" v-if="store.images.length > 0">
      <table class="batch-table">
        <thead>
          <tr>
            <th></th>
            <th>文件名</th>
            <th>原大小</th>
            <th>格式</th>
            <th>结果</th>
            <th>状态</th>
            <th>操作</th>
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
                <span v-else class="rate-negative">未压缩</span>
              </template>
              <span v-else>-</span>
            </td>
            <td>
              <span class="status-tag" :class="item.status">
                {{ statusLabels[item.status] }}
              </span>
            </td>
            <td>
              <button
                v-if="item.status === 'done'"
                class="btn btn-sm"
                @click="downloadSingle(item.id)"
              >下载</button>
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
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
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
  border-top-color: #fff;
  border-radius: 50%;
  animation: btn-spin 0.6s linear infinite;
}
@keyframes btn-spin {
  to { transform: rotate(360deg); }
}
.btn-danger {
  color: #f56c6c;
  border-color: #f56c6c;
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
  background: #f5f5f5;
  padding: 8px 10px;
  text-align: left;
  font-weight: 500;
  color: #666;
  white-space: nowrap;
}
.batch-table td {
  padding: 8px 10px;
  border-top: 1px solid #eee;
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
.status-tag.pending { background: #f0f0f0; color: #999; }
.status-tag.processing {
  background: #ecf5ff;
  color: #409eff;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.status-tag.processing::before {
  content: '';
  width: 10px;
  height: 10px;
  border: 2px solid #409eff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: proc-spin 0.6s linear infinite;
}
@keyframes proc-spin {
  to { transform: rotate(360deg); }
}
.status-tag.done { background: #f0f9eb; color: #67c23a; }
.status-tag.error { background: #fef0f0; color: #f56c6c; }
.rate {
  color: #67c23a;
  font-weight: 500;
}
.rate-negative {
  color: #e6a23c;
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
