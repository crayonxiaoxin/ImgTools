<script setup lang="ts">
import { useImageStore } from '@/stores/imageStore'
import { formatSize } from '@/utils/format'

const store = useImageStore()
</script>

<template>
  <div class="preview-area">
    <template v-if="store.images.length > 0">
      <div class="preview-grid">
        <div
          v-for="item in store.images"
          :key="item.id"
          class="preview-card"
        >
          <div class="preview-image-container">
            <img
              v-if="item.previewUrl"
              :src="item.previewUrl"
              :alt="item.name"
              class="preview-image"
            />
          </div>
          <div class="preview-info">
            <p class="preview-name" :title="item.name">{{ item.name }}</p>
            <p class="preview-size">{{ formatSize(item.size) }}</p>
            <p v-if="item.format" class="preview-format">{{ item.format.toUpperCase() }}</p>
            <p v-if="item.status === 'done' && item.resultSize" :class="item.resultSize <= item.size ? 'preview-result' : 'preview-larger'">
              处理后: {{ formatSize(item.resultSize) }}
              ({{ ((1 - item.resultSize / item.size) * 100).toFixed(0) }}%)
            </p>
            <p v-if="item.status === 'error'" class="preview-error">{{ item.errorMessage }}</p>
            <p v-if="item.status === 'processing'" class="preview-processing">处理中...</p>
          </div>
          <button class="remove-btn" @click="store.removeImage(item.id)">&times;</button>
        </div>
      </div>
    </template>
    <div v-else class="preview-empty">
      <p>暂无图片，请拖拽或选择</p>
    </div>
  </div>
</template>

<style scoped>
.preview-area {
  min-height: 200px;
}
.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.preview-card {
  position: relative;
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.preview-image-container {
  width: 100%;
  height: 140px;
  overflow: hidden;
  background: #f8f8f8;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.preview-info {
  padding: 8px;
  font-size: 12px;
}
.preview-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.preview-size, .preview-format {
  color: #999;
  margin: 2px 0;
}
.preview-result {
  color: #67c23a;
  font-weight: 500;
  margin: 2px 0;
}
.preview-larger {
  color: #e6a23c;
  font-weight: 500;
  margin: 2px 0;
}
.preview-error {
  color: #f56c6c;
  margin: 2px 0;
}
.preview-processing {
  color: #409eff;
  margin: 2px 0;
}
.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.4);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.remove-btn:hover {
  background: rgba(0,0,0,0.6);
}
.preview-empty {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
