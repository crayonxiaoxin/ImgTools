<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '@/stores/imageStore'
import { FAVICON_SIZES } from '@/core/formats'
import { initVips } from '@/core/vips'
import { createIco } from '@/utils/ico'
import { formatSize } from '@/utils/format'
import JSZip from 'jszip'

const store = useImageStore()
const dragging = ref(false)
const icoUrl = ref<string>()
const selectedSizes = ref<number[]>([16, 32, 48, 64])

function toggleSize(s: number) {
  const i = selectedSizes.value.indexOf(s)
  if (i >= 0) selectedSizes.value.splice(i, 1)
  else selectedSizes.value.push(s)
}

const hasImage = computed(() => store.images.length > 0)
const current = computed(() => store.images[0])

// drag / drop
function onDrop(e: DragEvent) {
  e.preventDefault()
  dragging.value = false
  if (e.dataTransfer?.files.length) store.addImages(Array.from(e.dataTransfer.files))
}
function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) store.addImages(Array.from(input.files))
  input.value = ''
}

// generate
async function generate() {
  if (!current.value || selectedSizes.value.length === 0) return
  store.setProcessing(true)
  icoUrl.value = undefined

  const item = current.value
  item.status = 'processing'
  try {
    const v = await initVips()
    const buffer = await item.file.arrayBuffer()
    const img = v.Image.newFromBuffer(new Uint8Array(buffer))

    const dim = Math.min(img.width, img.height)
    const left = Math.round((img.width - dim) / 2)
    const top = Math.round((img.height - dim) / 2)
    const cropped = img.crop(left, top, dim, dim)

    const sizes = selectedSizes.value
    const pngData: Uint8Array[] = []
    const results: { url: string; size: number }[] = []

    for (const s of sizes) {
      const scaled = cropped.resize(s / dim)
      const data = scaled.pngsaveBuffer()
      pngData.push(data)
      const blob = new Blob([data], { type: 'image/png' })
      const url = URL.createObjectURL(blob)
      results.push({ url, size: s })
    }
    store.setFaviconResults(item.id, results)

    const ico = createIco(pngData, sizes)
    if (icoUrl.value) URL.revokeObjectURL(icoUrl.value)
    icoUrl.value = URL.createObjectURL(new Blob([ico], { type: 'image/x-icon' }))
  } catch (e: unknown) {
    store.setError(item.id, e instanceof Error ? e.message : String(e))
  }
  store.setProcessing(false)
}

function downloadIco() {
  if (!icoUrl.value) return
  const a = document.createElement('a')
  a.href = icoUrl.value
  a.download = 'favicon.ico'
  a.click()
}

async function downloadZip() {
  if (!current.value?.faviconResults) return
  const zip = new JSZip()
  const base = current.value.name.replace(/\.[^.]+$/, '')
  for (const r of current.value.faviconResults) {
    const resp = await fetch(r.url)
    zip.file(`${base}-${r.size}x${r.size}.png`, await resp.blob())
  }
  if (icoUrl.value) {
    zip.file('favicon.ico', await fetch(icoUrl.value).then(r => r.blob()))
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'favicons.zip'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="favicon-page">
    <!-- Drop zone (hero area) -->
    <div
      v-if="!hasImage"
      class="drop-hero"
      :class="{ dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop="onDrop"
    >
      <div class="drop-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
      <p class="drop-title">上传图片制作图标</p>
      <p class="drop-hint">支持 JPEG / PNG / WebP / AVIF 格式</p>
      <button class="pick-btn" @click="($refs.picker as HTMLInputElement).click()">选择文件</button>
      <input ref="picker" type="file" accept="image/*" style="display:none" @change="onPick" />
    </div>

    <!-- Work area -->
    <template v-if="hasImage && current">
      <div class="work-area">
        <!-- Left: preview -->
        <div class="preview-col">
          <div class="preview-card">
            <img v-if="current.previewUrl" :src="current.previewUrl" class="preview-img" />
          </div>
          <p class="current-name">{{ current.name }}</p>
          <p v-if="current.format" class="current-meta">{{ current.format.toUpperCase() }} · {{ formatSize(current.size) }}</p>
        </div>

        <!-- Right: controls -->
        <div class="controls-col">
          <h3 class="section-title">输出尺寸</h3>
          <div class="size-grid">
            <button
              v-for="s in FAVICON_SIZES"
              :key="s"
              class="size-chip"
              :class="{ active: selectedSizes.includes(s) }"
              @click="toggleSize(s)"
            >
              <span class="size-val">{{ s }}×{{ s }}</span>
              <span class="size-dot" :style="{ width: Math.min(s / 256 * 24, 24) + 'px', height: Math.min(s / 256 * 24, 24) + 'px' }"></span>
            </button>
          </div>
          <p class="size-hint">已选 {{ selectedSizes.length }} 个尺寸</p>

          <button
            class="gen-btn"
            :disabled="store.processing || selectedSizes.length === 0"
            @click="generate"
          >
            <span v-if="store.processing" class="spinner"></span>
            {{ store.processing ? '生成中…' : '生成图标' }}
          </button>
        </div>
      </div>

      <!-- Results -->
      <div v-if="current.faviconResults" class="results-area">
        <div class="results-header">
          <h3 class="section-title">预览</h3>
          <div class="results-actions">
            <button class="action-btn ico-btn" :disabled="!icoUrl" @click="downloadIco">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              下载 .ICO
            </button>
            <button class="action-btn zip-btn" @click="downloadZip">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              下载 ZIP
            </button>
          </div>
        </div>
        <div class="results-grid">
          <div v-for="r in current.faviconResults" :key="r.size" class="result-card">
            <div class="result-preview">
              <img :src="r.url" :style="{ width: Math.min(r.size * 3, 120) + 'px', height: Math.min(r.size * 3, 120) + 'px' }" />
            </div>
            <div class="result-info">
              <span class="result-size">{{ r.size }}×{{ r.size }}</span>
              <span class="result-download">
                <a :href="r.url" :download="`favicon-${r.size}x${r.size}.png`">下载</a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.favicon-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px;
}

/* ── drop zone ── */
.drop-hero {
  border: 2px dashed #d0d5dd;
  border-radius: 20px;
  padding: 64px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s;
  background: #fafbfc;
}
.drop-hero:hover,
.drop-hero.dragging {
  border-color: #409eff;
  background: #f0f7ff;
}
.drop-icon {
  color: #98a2b3;
  margin-bottom: 12px;
}
.drop-hero:hover .drop-icon,
.drop-hero.dragging .drop-icon {
  color: #409eff;
}
.drop-title {
  font-size: 16px;
  font-weight: 600;
  color: #1d2939;
  margin-bottom: 4px;
}
.drop-hint {
  font-size: 13px;
  color: #98a2b3;
  margin-bottom: 20px;
}
.pick-btn {
  display: inline-block;
  padding: 8px 24px;
  border: 1px solid #d0d5dd;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  color: #344054;
  cursor: pointer;
}
.pick-btn:hover {
  background: #f9fafb;
}

/* ── work area ── */
.work-area {
  display: flex;
  gap: 32px;
  align-items: flex-start;
  margin-bottom: 32px;
}
.preview-col {
  flex-shrink: 0;
  width: 200px;
  text-align: center;
}
.preview-card {
  width: 200px;
  height: 200px;
  border-radius: 16px;
  overflow: hidden;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e4e7ec;
  margin-bottom: 8px;
}
.preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.current-name {
  font-size: 13px;
  color: #1d2939;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.current-meta {
  font-size: 11px;
  color: #98a2b3;
}

.controls-col {
  flex: 1;
  min-width: 0;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1d2939;
  margin-bottom: 12px;
}

.size-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.size-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid #e4e7ec;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 13px;
  color: #344054;
  min-width: 80px;
}
.size-chip:hover {
  border-color: #b0b7c3;
}
.size-chip.active {
  border-color: #409eff;
  background: #eff6ff;
  color: #2563eb;
}
.size-val {
  font-weight: 500;
}
.size-dot {
  display: inline-block;
  border-radius: 2px;
  background: currentColor;
  opacity: 0.4;
}
.size-chip.active .size-dot {
  opacity: 1;
}
.size-hint {
  font-size: 12px;
  color: #98a2b3;
  margin-bottom: 16px;
}

.gen-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 28px;
  border: none;
  border-radius: 10px;
  background: #409eff;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.gen-btn:hover:not(:disabled) {
  background: #2d7ee0;
}
.gen-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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

/* ── results ── */
.results-area {
  border-top: 1px solid #e4e7ec;
  padding-top: 24px;
}
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.results-actions {
  display: flex;
  gap: 8px;
}
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: 1px solid #d0d5dd;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  color: #344054;
}
.action-btn:hover:not(:disabled) {
  background: #f9fafb;
}
.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.results-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.result-card {
  border: 1px solid #e4e7ec;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  width: 128px;
}
.result-preview {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafbfc;
}
.result-preview img {
  display: block;
  image-rendering: pixelated;
}
.result-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-top: 1px solid #f0f0f0;
}
.result-size {
  font-size: 12px;
  color: #667085;
}
.result-download a {
  font-size: 12px;
  color: #409eff;
  text-decoration: none;
}
.result-download a:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .work-area {
    flex-direction: column;
    align-items: center;
  }
  .controls-col {
    width: 100%;
  }
}
</style>
