<script setup lang="ts">
import { useImageStore } from '@/stores/imageStore'
import { useImageProcessor } from '@/composables/useImageProcessor'
import { useBatchExport } from '@/composables/useBatchExport'

const store = useImageStore()
const { processAll } = useImageProcessor()
const { downloadSingle, downloadAllAsZip, downloadAllIndividual } = useBatchExport()

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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
            <th>文件名</th>
            <th>原大小</th>
            <th>格式</th>
            <th>处理后</th>
            <th>压缩率</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in store.images" :key="item.id">
            <td :title="item.name">{{ item.name }}</td>
            <td>{{ formatSize(item.size) }}</td>
            <td>{{ item.format?.toUpperCase() ?? '-' }}</td>
            <td>{{ item.resultSize ? formatSize(item.resultSize) : '-' }}</td>
            <td>
              <span v-if="item.status === 'done' && item.resultSize" class="rate">
                {{ ((1 - item.resultSize / item.size) * 100).toFixed(1) }}%
              </span>
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
.status-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}
.status-tag.pending { background: #f0f0f0; color: #999; }
.status-tag.processing { background: #ecf5ff; color: #409eff; }
.status-tag.done { background: #f0f9eb; color: #67c23a; }
.status-tag.error { background: #fef0f0; color: #f56c6c; }
.rate {
  color: #67c23a;
  font-weight: 500;
}
</style>
