<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { processPdf, type PdfProcessOptions } from '@/core/pdf'
import { formatSize } from '@/utils/format'
import { useToast } from '@/composables/useToast'
import JSZip from 'jszip'

const { t } = useI18n()
const toast = useToast()

const file = ref<File>()
const dragging = ref(false)
const isProcessing = ref(false)
const convertError = ref<string | null>(null)
const results = ref<{ data: Uint8Array; pageIndex: number; width: number; height: number; url?: string }[]>([])
const totalPages = ref(0)
const pickerRef = ref<HTMLInputElement>()

const scale = ref(1)
const format = ref<'png' | 'jpeg' | 'webp'>('png')
const quality = ref(90)
const mode = ref<'long' | 'pages'>('pages')
const pageFrom = ref(1)
const pageTo = ref(999)

function openPicker() { pickerRef.value?.click() }

function onFilePick(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (f) {
    file.value = f
    results.value = []
    convertError.value = null
  }
  input.value = ''
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragging.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f && f.type === 'application/pdf') {
    file.value = f
    results.value = []
    convertError.value = null
  }
}

function removeFile() {
  file.value = undefined
  results.value = []
  convertError.value = null
}

async function convert() {
  if (!file.value) return
  isProcessing.value = true
  results.value = []
  convertError.value = null

  try {
    const buffer = await file.value.arrayBuffer()
    const opts: PdfProcessOptions = {
      scale: Number(scale.value),
      format: format.value,
      quality: quality.value,
      mode: mode.value,
      pageRange: [pageFrom.value, pageTo.value],
    }

    const output = await processPdf(buffer, opts)
    totalPages.value = output.totalPages

    for (const page of output.pages) {
      const blob = new Blob([page.data as BlobPart], { type: `image/${format.value}` })
      results.value.push({ ...page, url: URL.createObjectURL(blob) })
    }
    toast.success(t('pdf.convertDone', { n: results.value.length }))
  } catch (e: unknown) {
    console.error(e)
    convertError.value = e instanceof Error ? e.message : String(e)
    toast.error(t('pdf.convertFailed', { msg: convertError.value }))
  }

  isProcessing.value = false
}

async function downloadAll() {
  if (results.value.length === 0) return
  const zip = new JSZip()
  const base = file.value?.name.replace(/\.pdf$/i, '') || 'output'

  for (const r of results.value) {
    const ext = format.value
    const name = mode.value === 'long' ? `${base}.${ext}` : `${base}_p${r.pageIndex}.${ext}`
    zip.file(name, r.data)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${base}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

function downloadSingle(index: number) {
  const r = results.value[index]
  if (!r?.url) return
  const a = document.createElement('a')
  a.href = r.url
  const base = file.value?.name.replace(/\.pdf$/i, '') || 'output'
  a.download = mode.value === 'long' ? `${base}.${format.value}` : `${base}_p${r.pageIndex}.${format.value}`
  a.click()
}
</script>

<template>
  <div class="pdf-page">
    <input ref="pickerRef" type="file" accept="application/pdf" style="display:none" @change="onFilePick" />

    <!-- Upload -->
    <div v-if="!file" class="drop-hero" :class="{ dragging }"
      @dragover.prevent="dragging = true" @dragleave="dragging = false"
      @drop="onDrop" @click="openPicker">
      <div class="drop-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="12" y2="12"/>
          <line x1="15" y1="15" x2="12" y2="12"/>
        </svg>
      </div>
      <p class="drop-title">{{ t('pdf.dropTitle') }}</p>
      <p class="drop-hint">{{ t('pdf.dropHint') }}</p>
      <p class="drop-sub">{{ t('pdf.dropSub') }}</p>
    </div>

    <!-- Controls -->
    <template v-if="file">
      <div class="work-area">
        <div class="info-col">
          <div class="file-card">
            <div class="file-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <p class="file-name">{{ file.name }}</p>
            <p class="file-size">{{ formatSize(file.size) }}</p>
            <span class="re-pick" @click="removeFile">{{ t('pdf.repick') }}</span>
          </div>
        </div>

        <div class="controls-col">
          <div class="controls-panel">
          <h3 class="section-title">{{ t('pdf.settings') }}</h3>

          <div class="param-row">
            <label>{{ t('pdf.outputFormat') }}</label>
            <select v-model="format" class="sel">
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
          </div>

          <div class="param-row">
            <label>{{ t('pdf.scale') }}</label>
            <select v-model="scale" class="sel">
              <option :value="1">{{ t('pdf.scale1x') }}</option>
              <option :value="1.5">{{ t('pdf.scale15x') }}</option>
              <option :value="2">{{ t('pdf.scale2x') }}</option>
              <option :value="3">{{ t('pdf.scale3x') }}</option>
            </select>
          </div>

          <div class="param-row">
            <label>{{ t('pdf.outputMode') }}</label>
            <select v-model="mode" class="sel">
              <option value="long">{{ t('pdf.modeLong') }}</option>
              <option value="pages">{{ t('pdf.modePages') }}</option>
            </select>
          </div>

          <div class="param-row">
            <label>{{ t('pdf.pageRange') }}</label>
            <div class="range-row">
              <input type="number" v-model.number="pageFrom" min="1" class="num" /> —
              <input type="number" v-model.number="pageTo" min="1" class="num" />
            </div>
          </div>

          <div v-if="format !== 'png'" class="param-row">
            <label>{{ t('pdf.quality', { v: quality }) }}</label>
            <input type="range" v-model.number="quality" min="10" max="100" class="range" />
          </div>

          <button class="gen-btn" :disabled="isProcessing" @click="convert">
            <span v-if="isProcessing" class="spinner"></span>
            {{ isProcessing ? t('pdf.converting') : t('pdf.convert') }}
          </button>
          <p v-if="convertError" class="convert-error">{{ t('pdf.convertFailed', { msg: convertError }) }}</p>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div v-if="results.length > 0" class="results-area">
        <div class="results-header">
          <h3 class="section-title">
            {{ t('pdf.results') }}
            <span class="result-count">
              {{ mode === 'long'
                ? t('pdf.resultCountImages', { n: results.length, total: totalPages })
                : t('pdf.resultCountPages', { n: results.length, total: totalPages }) }}
            </span>
          </h3>
          <div class="results-actions">
            <button class="action-btn" @click="downloadAll">{{ t('pdf.downloadZip') }}</button>
          </div>
        </div>
        <div class="results-grid">
          <div v-for="(r, i) in results" :key="i" class="result-card">
            <div class="result-preview">
              <img :src="r.url" />
            </div>
            <div class="result-info">
              <span class="result-label">
                {{ mode === 'long' ? t('pdf.longImage') : t('pdf.pageLabel', { n: r.pageIndex }) }}
                · {{ r.width }}×{{ r.height }}
              </span>
              <a class="result-dl" @click="downloadSingle(i)">{{ t('pdf.download') }}</a>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pdf-page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-3);
}
.drop-hero {
  border: 1px dashed var(--drop-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-4);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--ease), background var(--ease), box-shadow var(--ease);
  background: var(--drop-bg);
}
.drop-hero:hover, .drop-hero.dragging {
  border-color: var(--primary);
  background: var(--drop-hover-bg);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 20%, transparent);
}
.drop-icon { color: var(--placeholder); margin-bottom: var(--space-2); }
.drop-hero:hover .drop-icon, .drop-hero.dragging .drop-icon { color: var(--primary); }
.drop-title { font-size: var(--font-title); font-weight: 600; letter-spacing: -0.02em; color: var(--text); margin-bottom: 4px; }
.drop-hint { font-size: 13px; color: var(--placeholder); }
.drop-sub { font-size: var(--font-caption); color: var(--chip-hover); margin-top: var(--space-2); }

.work-area { display: flex; gap: var(--space-5); align-items: flex-start; }
.info-col { flex-shrink: 0; width: 180px; }
.file-card {
  text-align: center;
  padding: var(--space-4);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  box-shadow: var(--shadow-soft);
}
.file-icon { color: var(--danger); margin-bottom: var(--space-1); }
.file-name {
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-size { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.re-pick {
  font-size: var(--font-caption);
  color: var(--primary);
  cursor: pointer;
  margin-top: 4px;
  display: inline-block;
}

.controls-col { flex: 1; min-width: 0; }
.controls-panel {
  padding: var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
}
.section-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: var(--space-3);
}
.param-row { margin-bottom: var(--space-3); }
.param-row label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.sel {
  appearance: none;
  width: 100%;
  height: var(--control-h);
  padding: 0 28px 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background:
    var(--bg-surface)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")
    no-repeat right 10px center;
  color: var(--text);
  font-size: 13px;
  outline: none;
  transition: border-color var(--ease);
}
.sel:hover, .sel:focus { border-color: var(--border-strong); }
.range-row { display: flex; align-items: center; gap: var(--space-1); }
.num {
  width: 64px;
  height: var(--control-h);
  padding: 0 var(--space-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  color: var(--text);
  font-size: 13px;
  text-align: center;
  outline: none;
}
.range { width: 100%; accent-color: var(--primary); }

.gen-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-4);
  height: 36px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--primary);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: background var(--ease);
}
.gen-btn:hover:not(:disabled) { background: var(--primary-hover); }
.gen-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.convert-error {
  margin-top: var(--space-2);
  font-size: var(--font-caption);
  color: var(--danger);
  word-break: break-word;
}
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.5);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.results-area {
  border-top: 1px solid var(--card-border);
  padding-top: var(--space-4);
  margin-top: var(--space-5);
}
.results-area .section-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-transform: none;
  color: var(--text);
  margin-bottom: 0;
}
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.result-count {
  font-weight: 400;
  font-size: var(--font-caption);
  color: var(--text-muted);
  margin-left: var(--space-1);
}
.results-actions { display: flex; gap: var(--space-1); }
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 var(--space-3);
  height: var(--control-h);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: var(--text-secondary);
  transition: border-color var(--ease), background var(--ease), color var(--ease);
}
.action-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
  color: var(--text);
}
.results-grid { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.result-card {
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-surface);
  width: 240px;
  box-shadow: var(--shadow-soft);
}
.result-preview {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card-bg);
  overflow: hidden;
}
.result-preview img { max-width: 100%; max-height: 100%; object-fit: contain; }
.result-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  border-top: 1px solid var(--border);
}
.result-label { font-size: 11px; color: var(--text-muted); }
.result-dl { font-size: var(--font-caption); color: var(--primary); cursor: pointer; }

@media (max-width: 640px) {
  .work-area { flex-direction: column; align-items: center; gap: var(--space-4); }
  .controls-col { width: 100%; }
  .info-col { width: 100%; }
  .gen-btn { width: 100%; justify-content: center; }
}
</style>
