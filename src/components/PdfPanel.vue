<script setup lang="ts">
import { ref } from 'vue'
import { processPdf, type PdfProcessOptions } from '@/core/pdf'
import { formatSize } from '@/utils/format'
import JSZip from 'jszip'

const file = ref<File>()
const dragging = ref(false)
const isProcessing = ref(false)
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
  }
}

function removeFile() {
  file.value = undefined
  results.value = []
}

async function convert() {
  if (!file.value) return
  isProcessing.value = true
  results.value = []

  try {
    const buffer = await file.value.arrayBuffer()
    const opts: PdfProcessOptions = {
      scale: scale.value,
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
  } catch (e: unknown) {
    console.error(e)
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
      <p class="drop-title">上传 PDF 转换为图片</p>
      <p class="drop-hint">支持任意页数 PDF → PNG / JPEG / WebP</p>
      <p class="drop-sub">点击或拖拽上传</p>
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
            <span class="re-pick" @click="removeFile">重新选择</span>
          </div>
        </div>

        <div class="controls-col">
          <h3 class="section-title">输出设置</h3>

          <div class="param-row">
            <label>输出格式</label>
            <select v-model="format" class="sel">
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
          </div>

          <div class="param-row">
            <label>渲染精度</label>
            <select v-model="scale" class="sel">
              <option :value="1">1×（普通）</option>
              <option :value="1.5">1.5×</option>
              <option :value="2">2×（高清）</option>
              <option :value="3">3×（超清）</option>
            </select>
          </div>

          <div class="param-row">
            <label>输出模式</label>
            <select v-model="mode" class="sel">
              <option value="long">长图拼接</option>
              <option value="pages">逐页输出</option>
            </select>
          </div>

          <div class="param-row">
            <label>页面范围</label>
            <div class="range-row">
              <input type="number" v-model.number="pageFrom" min="1" class="num" /> —
              <input type="number" v-model.number="pageTo" min="1" class="num" />
            </div>
          </div>

          <div v-if="format !== 'png'" class="param-row">
            <label>质量: {{ quality }}</label>
            <input type="range" v-model.number="quality" min="10" max="100" class="range" />
          </div>

          <button class="gen-btn" :disabled="isProcessing" @click="convert">
            <span v-if="isProcessing" class="spinner"></span>
            {{ isProcessing ? '转换中…' : '转换' }}
          </button>
        </div>
      </div>

      <!-- Results -->
      <div v-if="results.length > 0" class="results-area">
        <div class="results-header">
          <h3 class="section-title">
            结果
            <span class="result-count">{{ results.length }} {{ mode === 'long' ? '张' : '页' }} · 共 {{ totalPages }} 页</span>
          </h3>
          <div class="results-actions">
            <button class="action-btn" @click="downloadAll">下载 ZIP</button>
          </div>
        </div>
        <div class="results-grid">
          <div v-for="(r, i) in results" :key="i" class="result-card">
            <div class="result-preview">
              <img :src="r.url" />
            </div>
            <div class="result-info">
              <span class="result-label">{{ mode === 'long' ? '长图' : `第 ${r.pageIndex} 页` }} · {{ r.width }}×{{ r.height }}</span>
              <a class="result-dl" @click="downloadSingle(i)">下载</a>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pdf-page { max-width: 720px; margin: 0 auto; padding: 24px 16px; }
.drop-hero {
  border: 2px dashed var(--drop-border); border-radius: 20px; padding: 64px 24px;
  text-align: center; cursor: pointer; transition: all 0.25s; background: var(--drop-bg);
}
.drop-hero:hover, .drop-hero.dragging { border-color: var(--primary); background: var(--drop-hover-bg); }
.drop-icon { color: var(--placeholder); margin-bottom: 12px; }
.drop-hero:hover .drop-icon, .drop-hero.dragging .drop-icon { color: var(--primary); }
.drop-title { font-size: 16px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.drop-hint { font-size: 13px; color: var(--placeholder); }
.drop-sub { font-size: 12px; color: var(--chip-hover); margin-top: 12px; }

.work-area { display: flex; gap: 32px; align-items: flex-start; }
.info-col { flex-shrink: 0; width: 180px; }
.file-card {
  text-align: center; padding: 20px; border: 1px solid var(--card-border);
  border-radius: 12px; background: var(--bg-surface);
}
.file-icon { color: var(--danger); margin-bottom: 8px; }
.file-name { font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.re-pick { font-size: 12px; color: var(--primary); cursor: pointer; margin-top: 4px; display: inline-block; }

.controls-col { flex: 1; min-width: 0; }
.section-title { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 12px; }
.param-row { margin-bottom: 14px; }
.param-row label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.sel {
  width: 100%; padding: 6px 8px; border: 1px solid var(--border-strong); border-radius: 6px;
  background: var(--bg-surface); color: var(--text); font-size: 13px;
}
.range-row { display: flex; align-items: center; gap: 6px; }
.num {
  width: 60px; padding: 5px 6px; border: 1px solid var(--border-strong); border-radius: 4px;
  background: var(--bg-surface); color: var(--text); font-size: 13px; text-align: center;
}
.range { width: 100%; }

.gen-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 10px 28px; border: none;
  border-radius: 10px; background: var(--primary); color: var(--bg-surface);
  font-size: 14px; font-weight: 500; cursor: pointer;
}
.gen-btn:hover:not(:disabled) { background: var(--primary-hover); }
.gen-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.spinner {
  width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.5);
  border-top-color: var(--bg-surface); border-radius: 50%; animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.results-area { border-top: 1px solid var(--card-border); padding-top: 24px; margin-top: 32px; }
.results-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.result-count { font-weight: 400; font-size: 12px; color: var(--text-muted); margin-left: 8px; }
.results-actions { display: flex; gap: 8px; }
.action-btn {
  display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px;
  border: 1px solid var(--border-strong); border-radius: 8px; background: var(--bg-surface);
  font-size: 13px; cursor: pointer; color: var(--text-secondary);
}
.action-btn:hover:not(:disabled) { background: var(--bg-hover); }
.results-grid { display: flex; gap: 12px; flex-wrap: wrap; }
.result-card {
  border: 1px solid var(--card-border); border-radius: 12px; overflow: hidden;
  background: var(--bg-surface); width: 240px;
}
.result-preview {
  height: 160px; display: flex; align-items: center; justify-content: center;
  background: var(--card-bg); overflow: hidden;
}
.result-preview img { max-width: 100%; max-height: 100%; object-fit: contain; }
.result-info {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 10px; border-top: 1px solid var(--border);
}
.result-label { font-size: 11px; color: var(--text-muted); }
.result-dl { font-size: 12px; color: var(--primary); cursor: pointer; }

@media (max-width: 640px) { .work-area { flex-direction: column; align-items: center; } .controls-col { width: 100%; } }
</style>
