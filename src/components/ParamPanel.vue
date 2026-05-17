<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '@/stores/imageStore'
import { getWritableFormats, FORMATS } from '@/core/formats'

const { t } = useI18n()

const store = useImageStore()
const writableFormats = computed(() => getWritableFormats())

const currentFormat = computed(() => {
  const fmt = store.images[0]?.config.targetFormat
  return fmt ? FORMATS[fmt] : null
})

const lossySupported = computed(() => currentFormat.value?.lossyCompress ?? false)

const qualityVisible = computed(() => {
  const fmt = outputFormat.value
  const lossless = store.images[0]?.config.lossless
  if (lossless && fmt === 'png') return false
  if (lossless && fmt === 'bmp') return false
  return true
})

const outputFormat = ref<string | null>(null)

watch(() => store.images[0]?.format, (fmt) => {
  if (outputFormat.value === null && fmt) {
    syncOriginalFormat()
  }
})

function syncOriginalFormat() {
  store.images.forEach(item => {
    if (item.format && item.status !== 'processing') {
      store.updateConfig(item.id, { targetFormat: item.format })
    }
  })
}

function setOutputFormat(fmt: string | null) {
  outputFormat.value = fmt
  if (fmt === null) {
    syncOriginalFormat()
  } else {
    updateGlobalConfig('targetFormat', fmt as any)
  }
}

watch(currentFormat, (fmt) => {
  if (fmt && !fmt.lossyCompress && store.images[0]?.config.lossless === false) {
    updateGlobalConfig('lossless', true)
  }
})

const maxWidthEnabled = ref(false)
const maxWidthValue = ref(1920)

watch(() => store.images[0]?.config.maxWidth, (val) => {
  if (val !== undefined) {
    maxWidthEnabled.value = true
    maxWidthValue.value = val
  }
})

function updateGlobalConfig(field: string, value: any) {
  store.images.forEach(item => {
    if (item.status !== 'processing') {
      store.updateConfig(item.id, { [field]: value })
    }
  })
}

function toggleMaxWidth(enabled: boolean) {
  maxWidthEnabled.value = enabled
  updateGlobalConfig('maxWidth', enabled ? maxWidthValue.value : undefined)
}

function setMaxWidth(val: number) {
  maxWidthValue.value = val
  if (maxWidthEnabled.value) {
    updateGlobalConfig('maxWidth', val)
  }
}
</script>

<template>
  <div class="param-panel">
    <h3 class="panel-title">{{ t('param.title') }}</h3>

    <!-- Compress mode -->
    <template v-if="store.activeMode === 'compress'">
      <div class="param-group">
        <label class="param-label">{{ t('param.compressType') }}</label>
        <div class="toggle-group">
          <button
            class="toggle-btn"
            :class="{ active: !store.images[0]?.config.lossless }"
            :disabled="!lossySupported"
            @click="updateGlobalConfig('lossless', false)"
          >{{ t('param.lossy') }}</button>
          <button
            class="toggle-btn"
            :class="{ active: store.images[0]?.config.lossless || !lossySupported }"
            @click="updateGlobalConfig('lossless', true)"
          >{{ t('param.lossless') }}</button>
        </div>
      </div>

      <div class="param-group" v-if="qualityVisible">
        <label class="param-label">{{ t('param.quality', { v: store.images[0]?.config.quality ?? 80 }) }}</label>
        <input
          type="range"
          min="1"
          max="100"
          :value="store.images[0]?.config.quality ?? 80"
          @input="updateGlobalConfig('quality', Number(($event.target as HTMLInputElement).value))"
          class="range-input"
        />
      </div>

      <div class="param-group">
        <label class="param-label">{{ t('param.outputFormat') }}</label>
        <select
          :value="outputFormat ?? '__original__'"
          @change="setOutputFormat(($event.target as HTMLSelectElement).value === '__original__' ? null : ($event.target as HTMLSelectElement).value)"
          class="select-input"
        >
          <option value="__original__">{{ t('param.originalFormat') }}</option>
          <option v-for="fmt in writableFormats" :key="fmt" :value="fmt">
            {{ fmt.toUpperCase() }}
          </option>
        </select>
      </div>
    </template>

    <!-- Convert mode -->
    <template v-if="store.activeMode === 'convert'">
      <div class="param-group">
        <label class="param-label">{{ t('param.targetFormat') }}</label>
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

    <div class="param-group">
      <div class="max-width-row">
        <input
          type="checkbox"
          :checked="maxWidthEnabled"
          @change="toggleMaxWidth(($event.target as HTMLInputElement).checked)"
        />
        <label class="param-label" style="margin:0;cursor:pointer">{{ t('param.maxWidth') }}</label>
        <input
          v-if="maxWidthEnabled"
          type="number"
          min="100"
          max="10000"
          :value="maxWidthValue"
          @input="setMaxWidth(Number(($event.target as HTMLInputElement).value))"
          class="width-input"
        />
        <span v-if="maxWidthEnabled" class="width-unit">{{ t('param.px') }}</span>
      </div>
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
  color: var(--text);
}
.param-group {
  margin-bottom: 16px;
}
.param-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.toggle-group {
  display: flex;
  gap: 4px;
  background: var(--bg-dim);
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
  color: var(--text-secondary);
}
.toggle-btn.active {
  background: var(--bg-surface);
  color: var(--primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.toggle-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-secondary);
}
.format-btn.active {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-bg);
}
.select-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  font-size: 13px;
  background: var(--bg-surface);
}
.max-width-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.width-input {
  width: 80px;
  padding: 4px 6px;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  font-size: 13px;
}
.width-unit {
  font-size: 12px;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .param-panel {
    padding: 12px;
  }
}
</style>
