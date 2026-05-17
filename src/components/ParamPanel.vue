<script setup lang="ts">
import { computed } from 'vue'
import { useImageStore } from '@/stores/imageStore'
import { getWritableFormats } from '@/core/formats'

const store = useImageStore()
const writableFormats = computed(() => getWritableFormats())

function updateGlobalConfig(field: string, value: any) {
  store.images.forEach(item => {
    if (item.status !== 'processing') {
      store.updateConfig(item.id, { [field]: value })
    }
  })
}
</script>

<template>
  <div class="param-panel">
    <h3 class="panel-title">参数</h3>

    <!-- Compress mode -->
    <template v-if="store.activeMode === 'compress'">
      <div class="param-group">
        <label class="param-label">压缩类型</label>
        <div class="toggle-group">
          <button
            class="toggle-btn"
            :class="{ active: !store.images[0]?.config.lossless }"
            @click="updateGlobalConfig('lossless', false)"
          >有损</button>
          <button
            class="toggle-btn"
            :class="{ active: store.images[0]?.config.lossless }"
            @click="updateGlobalConfig('lossless', true)"
          >无损</button>
        </div>
      </div>

      <div class="param-group">
        <label class="param-label">质量: {{ store.images[0]?.config.quality ?? 80 }}</label>
        <input
          type="range"
          min="1"
          max="100"
          :value="store.images[0]?.config.quality ?? 80"
          @input="updateGlobalConfig('quality', Number(($event.target as HTMLInputElement).value))"
          class="range-input"
        />
      </div>
    </template>

    <!-- Convert mode -->
    <template v-if="store.activeMode === 'convert'">
      <div class="param-group">
        <label class="param-label">目标格式</label>
        <div class="format-grid">
          <button
            v-for="fmt in writableFormats"
            :key="fmt"
            class="format-btn"
            :class="{ active: store.images[0]?.config.targetFormat === fmt }"
            @click="updateGlobalConfig('targetFormat', fmt)"
          >{{ fmt.toUpperCase() }}</button>
        </div>
      </div>
    </template>

    <!-- Common params -->
    <div class="param-group">
      <label class="param-label">输出格式</label>
      <select
        :value="store.images[0]?.config.targetFormat ?? 'webp'"
        @change="updateGlobalConfig('targetFormat', ($event.target as HTMLSelectElement).value)"
        class="select-input"
      >
        <option v-for="fmt in writableFormats" :key="fmt" :value="fmt">
          {{ fmt.toUpperCase() }}
        </option>
      </select>
    </div>

    <div class="param-group">
      <label class="param-label">
        <input
          type="checkbox"
          :checked="!!store.images[0]?.config.maxWidth"
          @change="updateGlobalConfig('maxWidth', ($event.target as HTMLInputElement).checked ? 1920 : undefined)"
        />
        限制最大宽度
      </label>
    </div>
  </div>
</template>

<style scoped>
.param-panel {
  padding: 16px;
}
.panel-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
}
.param-group {
  margin-bottom: 16px;
}
.param-label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 6px;
}
.toggle-group {
  display: flex;
  gap: 4px;
  background: #f0f0f0;
  border-radius: 6px;
  padding: 2px;
}
.toggle-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  color: #666;
}
.toggle-btn.active {
  background: #fff;
  color: #409eff;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.range-input {
  width: 100%;
  cursor: pointer;
}
.format-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.format-btn {
  border: 1px solid #ddd;
  background: #fff;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  color: #666;
}
.format-btn.active {
  border-color: #409eff;
  color: #409eff;
  background: #ecf5ff;
}
.select-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  background: #fff;
}
</style>
