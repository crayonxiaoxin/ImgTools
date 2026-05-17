<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '@/stores/imageStore'
import { FAVICON_SIZES } from '@/core/formats'
import { initVips } from '@/core/vips'
import { createIco } from '@/utils/ico'
import { formatSize } from '@/utils/format'
import JSZip from 'jszip'

const { t } = useI18n()

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
let resizeStartX = 0, resizeStartY = 0
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
  resizeStartY = e.clientY
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
      const blob = new Blob([data], { type: 'image/png' })
      results.push({ url: URL.createObjectURL(blob), size: sz })
    }
    store.setFaviconResults(item.id, results)

    const ico = createIco(pngData, sizes)
    if (icoUrl.value) URL.revokeObjectURL(icoUrl.value)
    icoUrl.value = URL.createObjectURL(new Blob([ico], { type: 'image/x-icon' }))
  } catch (e: unknown) {
    store.setError(item.id, e instanceof Error ? e.message : String(e))
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
.drop-hero:hover, .drop-hero.dragging {
  border-color: #409eff;
  background: #f0f7ff;
}
.drop-icon { color: #98a2b3; margin-bottom: 12px; }
.drop-hero:hover .drop-icon,
.drop-hero.dragging .drop-icon { color: #409eff; }
.drop-title { font-size: 16px; font-weight: 600; color: #1d2939; margin-bottom: 4px; }
.drop-hint { font-size: 13px; color: #98a2b3; }
.drop-sub { font-size: 12px; color: #b0b7c3; margin-top: 12px; }

/* ── work area ── */
.work-area {
  display: flex;
  gap: 32px;
  align-items: flex-start;
}

/* ── crop ── */
.crop-col { flex-shrink: 0; }
.crop-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.crop-label { font-size: 14px; font-weight: 600; color: #1d2939; }
.re-pick { font-size: 12px; color: #409eff; cursor: pointer; }
.re-pick:hover { text-decoration: underline; }
.crop-container {
  position: relative;
  background: #f0f0f0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #e4e7ec;
  user-select: none;
}
.crop-image {
  position: absolute;
  display: block;
}
.crop-box {
  position: absolute;
  border: 2px solid #fff;
  box-shadow: 0 0 0 9999px rgba(0,0,0,0.45);
  cursor: move;
  z-index: 2;
}
.crop-handle {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 14px;
  height: 14px;
  background: #fff;
  border: 2px solid #409eff;
  border-radius: 3px;
  cursor: nwse-resize;
  z-index: 3;
}
.crop-hint { font-size: 11px; color: #98a2b3; margin-top: 6px; text-align: center; }

/* ── controls ── */
.controls-col { flex: 1; min-width: 0; }
.section-title { font-size: 14px; font-weight: 600; color: #1d2939; margin-bottom: 12px; }
.size-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.size-chip {
  padding: 8px 14px;
  border: 1px solid #e4e7ec;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: #344054;
  transition: all 0.15s;
}
.size-chip:hover { border-color: #b0b7c3; }
.size-chip.active {
  border-color: #409eff;
  background: #eff6ff;
  color: #2563eb;
}
.size-hint { font-size: 12px; color: #98a2b3; margin-bottom: 16px; }

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
.gen-btn:hover:not(:disabled) { background: #2d7ee0; }
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
.results-area { border-top: 1px solid #e4e7ec; padding-top: 24px; margin-top: 32px; }
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.results-actions { display: flex; gap: 8px; }
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
.action-btn:hover:not(:disabled) { background: #f9fafb; }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.results-grid { display: flex; gap: 12px; flex-wrap: wrap; }
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
.result-preview img { display: block; image-rendering: pixelated; }
.result-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-top: 1px solid #f0f0f0;
}
.result-size { font-size: 12px; color: #667085; }
.result-dl { font-size: 12px; color: #409eff; text-decoration: none; }
.result-dl:hover { text-decoration: underline; }

@media (max-width: 640px) {
  .work-area { flex-direction: column; align-items: center; }
  .controls-col { width: 100%; }
}
</style>
