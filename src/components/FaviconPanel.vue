<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '@/stores/imageStore'
import { FAVICON_SIZES } from '@/core/formats'
import { initVips } from '@/core/vips'
import { createIco } from '@/utils/ico'
import { useToast } from '@/composables/useToast'
import JSZip from 'jszip'

const { t } = useI18n()
const toast = useToast()

const store = useImageStore()
const pickerRef = ref<HTMLInputElement>()
const dragging = ref(false)

const selectedSizes = ref<number[]>([16, 32, 48, 64])
const icoUrl = ref<string>()
const isProcessing = ref(false)

function toggleSize(s: number) {
  const i = selectedSizes.value.indexOf(s)
  if (i >= 0) selectedSizes.value.splice(i, 1)
  else selectedSizes.value.push(s)
}

const hasImage = computed(() => store.images.length > 0)
const current = computed(() => store.images[0])

// ── file pick (drop zone + click anywhere) ──
function openPicker() {
  pickerRef.value?.click()
}

function onFilePick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) {
    store.clearAll()
    store.addImages(Array.from(input.files))
    initCrop()
    input.value = ''
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragging.value = false
  if (e.dataTransfer?.files.length) {
    store.clearAll()
    store.addImages(Array.from(e.dataTransfer.files))
    initCrop()
  }
}

// ── crop state (all in natural image pixel coordinates) ──
const cropContainer = ref<HTMLDivElement>()
const containerSize = 280
let imgNaturalW = 0
let imgNaturalH = 0
const displayScale = ref(1)       // display px per image px
const displayW = ref(0)            // image display width in container px
const displayH = ref(0)            // image display height in container px
const cropImgX = ref(0)            // crop left in image pixels
const cropImgY = ref(0)            // crop top in image pixels
const cropImgSize = ref(0)         // crop size in image pixels

// computed display positions
const cropDisplayLeft = () => displayW.value > 0 ? (containerSize - displayW.value) / 2 + cropImgX.value * displayScale.value : 0
const cropDisplayTop = () => displayH.value > 0 ? (containerSize - displayH.value) / 2 + cropImgY.value * displayScale.value : 0
const cropDisplaySize = () => cropImgSize.value * displayScale.value

let isDraggingBox = false
let dragStartX = 0, dragStartY = 0
let dragOrigImgX = 0, dragOrigImgY = 0

let isResizing = false
let resizeStartX = 0
let resizeOrigSize = 0

function initCrop() {
  if (!current.value?.previewUrl) return
  const img = new Image()
  img.onload = () => {
    imgNaturalW = img.naturalWidth
    imgNaturalH = img.naturalHeight
    const s = Math.min(containerSize / imgNaturalW, containerSize / imgNaturalH)
    displayScale.value = s
    displayW.value = imgNaturalW * s
    displayH.value = imgNaturalH * s
    const dim = Math.min(imgNaturalW, imgNaturalH)
    cropImgSize.value = dim
    cropImgX.value = (imgNaturalW - dim) / 2
    cropImgY.value = (imgNaturalH - dim) / 2
  }
  img.src = current.value.previewUrl
}

function onBoxDown(e: MouseEvent) {
  isDraggingBox = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragOrigImgX = cropImgX.value
  dragOrigImgY = cropImgY.value
}

function onPointerMove(e: MouseEvent) {
  const s = displayScale.value
  if (isDraggingBox) {
    let nx = dragOrigImgX + (e.clientX - dragStartX) / s
    let ny = dragOrigImgY + (e.clientY - dragStartY) / s
    const dim = cropImgSize.value
    nx = Math.max(0, Math.min(nx, imgNaturalW - dim))
    ny = Math.max(0, Math.min(ny, imgNaturalH - dim))
    cropImgX.value = nx
    cropImgY.value = ny
  }
  if (isResizing) {
    const d = Math.max(20, resizeOrigSize + (e.clientX - resizeStartX) / s)
    const max = Math.min(imgNaturalW - cropImgX.value, imgNaturalH - cropImgY.value)
    cropImgSize.value = Math.min(d, max)
  }
}

function onPointerUp() {
  isDraggingBox = false
  isResizing = false
}

function onResizeDown(e: MouseEvent) {
  e.stopPropagation()
  isResizing = true
  resizeStartX = e.clientX
  resizeOrigSize = cropImgSize.value
}

onMounted(() => {
  document.addEventListener('mousemove', onPointerMove)
  document.addEventListener('mouseup', onPointerUp)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onPointerMove)
  document.removeEventListener('mouseup', onPointerUp)
})

// ── generate favicons using crop data ──
async function generate() {
  if (!current.value || selectedSizes.value.length === 0) return
  isProcessing.value = true
  icoUrl.value = undefined

  const item = current.value
  item.status = 'processing'
  try {
    const v = await initVips()
    const buffer = await item.file.arrayBuffer()
    const img = v.Image.newFromBuffer(new Uint8Array(buffer))

    const cx = Math.round(cropImgX.value)
    const cy = Math.round(cropImgY.value)
    const cw = Math.round(cropImgSize.value)
    const cropped = img.crop(cx, cy, cw, cw)

    const sizes = selectedSizes.value
    const pngData: Uint8Array[] = []
    const results: { url: string; size: number }[] = []

    for (const sz of sizes) {
      const scaled = cropped.resize(sz / cw)
      const data = scaled.pngsaveBuffer()
      pngData.push(data)
      const blob = new Blob([data as BlobPart], { type: 'image/png' })
      const url = URL.createObjectURL(blob)
      results.push({ url, size: sz })
    }
    store.setFaviconResults(item.id, results)

    const ico = createIco(pngData, sizes)
    if (icoUrl.value) URL.revokeObjectURL(icoUrl.value)
    icoUrl.value = URL.createObjectURL(new Blob([ico as BlobPart], { type: 'image/x-icon' }))
    toast.success(t('favicon.generateDone', { n: results.length }))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    store.setError(item.id, msg)
    toast.error(t('favicon.generateFailed', { msg }))
  }
  isProcessing.value = false
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
    zip.file(`${base}-${r.size}x${r.size}.png`, await fetch(r.url).then(r => r.blob()))
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
    <input ref="pickerRef" type="file" accept="image/*" style="display:none" @change="onFilePick" />

    <!-- Drop zone -->
    <div
      v-if="!hasImage"
      class="drop-hero"
      :class="{ dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop="onDrop"
      @click="openPicker"
    >
      <div class="drop-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
      <p class="drop-title">{{ t('favicon.dropTitle') }}</p>
      <p class="drop-hint">{{ t('favicon.dropHint') }}</p>
      <p class="drop-sub">{{ t('favicon.dropSub') }}</p>
    </div>

    <!-- Work area -->
    <template v-if="hasImage && current">
      <div class="work-area">
        <!-- Left: crop -->
        <div class="crop-col">
          <div class="crop-toolbar">
            <span class="crop-label">{{ t('favicon.cropLabel') }}</span>
            <span class="re-pick" @click="openPicker">{{ t('favicon.repick') }}</span>
          </div>
          <div
            ref="cropContainer"
            class="crop-container"
            :style="{ width: containerSize + 'px', height: containerSize + 'px' }"
          >
            <img
              v-if="current.previewUrl"
              :src="current.previewUrl"
              class="crop-image"
              :style="{
                width: displayW + 'px',
                height: displayH + 'px',
                left: (containerSize - displayW) / 2 + 'px',
                top: (containerSize - displayH) / 2 + 'px',
              }"
            />
            <div
              class="crop-box"
              :style="{
                left: cropDisplayLeft() + 'px',
                top: cropDisplayTop() + 'px',
                width: cropDisplaySize() + 'px',
                height: cropDisplaySize() + 'px',
              }"
              @mousedown="onBoxDown"
            >
              <div class="crop-handle" @mousedown="onResizeDown"></div>
            </div>
          </div>
          <p class="crop-hint">{{ t('favicon.cropHint') }}</p>
        </div>

        <!-- Right: controls -->
        <div class="controls-col">
          <div class="controls-panel">
          <h3 class="section-title">{{ t('favicon.outputSizes') }}</h3>
          <div class="size-grid">
            <button
              v-for="s in FAVICON_SIZES"
              :key="s"
              class="size-chip"
              :class="{ active: selectedSizes.includes(s) }"
              @click="toggleSize(s)"
            >{{ s }}×{{ s }}</button>
          </div>
          <p class="size-hint">{{ t('favicon.sizeCount', { n: selectedSizes.length }) }}</p>

          <button
            class="gen-btn"
            :disabled="isProcessing || selectedSizes.length === 0"
            @click="generate"
          >
            <span v-if="isProcessing" class="spinner"></span>
            {{ isProcessing ? t('favicon.generating') : t('favicon.generate') }}
          </button>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div v-if="current.faviconResults" class="results-area">
        <div class="results-header">
          <h3 class="section-title">{{ t('favicon.preview') }}</h3>
          <div class="results-actions">
            <button class="action-btn" :disabled="!icoUrl" @click="downloadIco">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {{ t('favicon.downloadIco') }}
            </button>
            <button class="action-btn" @click="downloadZip">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {{ t('favicon.downloadZip') }}
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
              <a :href="r.url" :download="`favicon-${r.size}x${r.size}.png`" class="result-dl">{{ t('favicon.download') }}</a>
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
  padding: var(--space-4) var(--space-3);
}

/* ── drop zone ── */
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
.drop-hero:hover .drop-icon,
.drop-hero.dragging .drop-icon { color: var(--primary); }
.drop-title { font-size: var(--font-title); font-weight: 600; letter-spacing: -0.02em; color: var(--text); margin-bottom: 4px; }
.drop-hint { font-size: 13px; color: var(--placeholder); }
.drop-sub { font-size: var(--font-caption); color: var(--chip-hover); margin-top: var(--space-2); }

/* ── work area ── */
.work-area {
  display: flex;
  gap: var(--space-5);
  align-items: flex-start;
}

/* ── crop ── */
.crop-col { flex-shrink: 0; }
.crop-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}
.crop-label { font-size: var(--font-body); font-weight: 600; color: var(--text); }
.re-pick { font-size: var(--font-caption); color: var(--primary); cursor: pointer; }
.re-pick:hover { text-decoration: underline; }
.crop-container {
  position: relative;
  background: var(--bg-dim);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--card-border);
  user-select: none;
}
.crop-image {
  position: absolute;
  display: block;
}
.crop-box {
  position: absolute;
  border: 2px solid var(--bg-surface);
  box-shadow: 0 0 0 9999px var(--crop-mask);
  cursor: move;
  z-index: 2;
}
.crop-handle {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 14px;
  height: 14px;
  background: var(--bg-surface);
  border: 2px solid var(--primary);
  border-radius: 3px;
  cursor: nwse-resize;
  z-index: 3;
}
.crop-hint { font-size: 11px; color: var(--placeholder); margin-top: 6px; text-align: center; }

/* ── controls ── */
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
  margin-bottom: var(--space-2);
}
.size-grid { display: flex; flex-wrap: wrap; gap: var(--space-1); margin-bottom: var(--space-1); }
.size-chip {
  padding: 0 14px;
  min-height: var(--control-h);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: border-color var(--ease), background var(--ease), color var(--ease);
}
.size-chip:hover { border-color: var(--border-strong); color: var(--text); }
.size-chip.active {
  border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
  background: var(--primary-bg);
  color: var(--primary-text);
}
.size-hint { font-size: var(--font-caption); color: var(--placeholder); margin-bottom: var(--space-3); }

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
.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.5);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── results ── */
.results-area { border-top: 1px solid var(--card-border); padding-top: var(--space-4); margin-top: var(--space-5); }
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
.results-actions { display: flex; gap: var(--space-1); flex-wrap: wrap; }
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
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.results-grid { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.result-card {
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-surface);
  width: 128px;
  box-shadow: var(--shadow-soft);
}
.result-preview {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card-bg);
}
.result-preview img { display: block; image-rendering: pixelated; }
.result-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  border-top: 1px solid var(--border);
}
.result-size { font-size: var(--font-caption); color: var(--text-muted); }
.result-dl { font-size: var(--font-caption); color: var(--primary); text-decoration: none; }
.result-dl:hover { text-decoration: underline; }

@media (max-width: 640px) {
  .work-area { flex-direction: column; align-items: center; gap: var(--space-4); }
  .controls-col { width: 100%; }
  .gen-btn { width: 100%; justify-content: center; }
}
</style>
