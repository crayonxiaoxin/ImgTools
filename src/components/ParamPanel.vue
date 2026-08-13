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
      store.updateConfig(item.id, { targetFormat: FORMATS[item.format].writable ? item.format : 'png' })
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

    <!-- Strip mode -->
    <template v-if="store.activeMode === 'strip'">
      <p class="hint">{{ t('strip.desc') }}</p>
      <label class="check-row">
        <input
          type="checkbox"
          :checked="store.stripConfig.removeIcc"
          @change="store.setStripConfig({ removeIcc: ($event.target as HTMLInputElement).checked })"
        />
        <span>{{ t('strip.removeIcc') }}</span>
      </label>
      <p class="hint muted">{{ t('strip.removeIccHint') }}</p>
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
  height: 100%;
  padding: var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
}
.panel-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-bottom: var(--space-4);
  color: var(--text);
}
.param-group {
  margin-bottom: var(--space-4);
}
.param-group:last-child {
  margin-bottom: 0;
}
.param-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.toggle-group {
  display: flex;
  gap: 2px;
  background: var(--bg-dim);
  border-radius: var(--radius-sm);
  padding: 3px;
}
.toggle-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0 var(--space-2);
  min-height: 30px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: var(--text-secondary);
  transition: background var(--ease), color var(--ease), box-shadow var(--ease);
}
.toggle-btn.active {
  background: var(--bg-surface);
  color: var(--text);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}
.toggle-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.range-input {
  width: 100%;
  cursor: pointer;
  accent-color: var(--primary);
}
.format-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.format-btn {
  border: 1px solid var(--border);
  background: var(--bg-surface);
  padding: 0 12px;
  min-height: 30px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  color: var(--text-secondary);
  transition: border-color var(--ease), color var(--ease), background var(--ease);
}
.format-btn:hover {
  border-color: var(--border-strong);
  color: var(--text);
}
.format-btn.active {
  border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
  color: var(--primary-text);
  background: var(--primary-bg);
}
.select-input,
.width-input {
  appearance: none;
  width: 100%;
  height: var(--control-h);
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--bg-surface);
  color: var(--text);
  outline: none;
  transition: border-color var(--ease);
}
.select-input {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}
.select-input:hover,
.select-input:focus,
.width-input:hover,
.width-input:focus {
  border-color: var(--border-strong);
}
.width-input {
  width: 88px;
}
.max-width-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}
.max-width-row .param-label {
  text-transform: none;
  letter-spacing: -0.01em;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0;
}
.width-unit {
  font-size: var(--font-caption);
  color: var(--text-muted);
}
.hint {
  margin: 0 0 var(--space-3);
  font-size: var(--font-caption);
  color: var(--text-muted);
  line-height: 1.5;
}
.hint.muted {
  margin-top: var(--space-1);
  margin-bottom: var(--space-3);
  font-size: 11px;
}
.check-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-bottom: var(--space-1);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
}
.check-row input {
  accent-color: var(--primary);
}

@media (max-width: 768px) {
  .param-panel {
    padding: var(--space-3);
  }
}
</style>
