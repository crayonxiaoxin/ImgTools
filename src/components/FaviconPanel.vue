<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '@/stores/imageStore'
import { FAVICON_SIZES } from '@/core/formats'
import { initVips } from '@/core/vips'
import { createIco } from '@/utils/ico'
import JSZip from 'jszip'

const store = useImageStore()

const selectedSizes = ref<number[]>([16, 32, 48])

function toggleSize(s: number) {
  const i = selectedSizes.value.indexOf(s)
  if (i >= 0) selectedSizes.value.splice(i, 1)
  else selectedSizes.value.push(s)
}

const hasImage = computed(() => store.images.length > 0)

// Crop state (cropping is disabled for now, defaults to center-square crop)
const croppingEnabled = ref(false)

const icoUrl = ref<string>()

async function generateFavicons() {
  if (!hasImage.value || selectedSizes.value.length === 0) return
  store.setProcessing(true)
  icoUrl.value = undefined

  for (const item of store.images) {
    if (item.status === 'processing') continue
    item.status = 'processing'
    try {
      const v = await initVips()
      const buffer = await item.file.arrayBuffer()
      const img = v.Image.newFromBuffer(new Uint8Array(buffer))

      // center-square crop
      const dim = Math.min(img.width, img.height)
      const left = Math.round((img.width - dim) / 2)
      const top = Math.round((img.height - dim) / 2)
      const cropped = img.crop(left, top, dim, dim)

      const sizes = selectedSizes.value
      const results: { url: string; size: number }[] = []
      const pngData: Uint8Array[] = []

      for (const s of sizes) {
        const scaled = cropped.resize(s / dim)
        const data = scaled.pngsaveBuffer()
        pngData.push(data)
        const blob = new Blob([data], { type: 'image/png' })
        const url = URL.createObjectURL(blob)
        results.push({ url, size: s })
      }
      store.setFaviconResults(item.id, results)

      // create ICO
      const ico = createIco(pngData, sizes)
      if (icoUrl.value) URL.revokeObjectURL(icoUrl.value)
      icoUrl.value = URL.createObjectURL(new Blob([ico], { type: 'image/x-icon' }))
    } catch (e: unknown) {
      store.setError(item.id, e instanceof Error ? e.message : String(e))
    }
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
  const done = store.images.filter(i => i.faviconResults?.length)
  if (done.length === 0) return

  const zip = new JSZip()
  for (const item of done) {
    if (!item.faviconResults) continue
    const base = item.name.replace(/\.[^.]+$/, '')
    for (const r of item.faviconResults) {
      const resp = await fetch(r.url)
      const blob = await resp.blob()
      zip.file(`${base}-${r.size}x${r.size}.png`, blob)
    }
  }
  // add ico to zip if available
  if (icoUrl.value) {
    const resp = await fetch(icoUrl.value)
    const blob = await resp.blob()
    zip.file('favicon.ico', blob)
  }
  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = 'favicons.zip'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="favicon-panel">
    <h3 class="panel-title">图标制作</h3>

    <div class="param-group">
      <label class="param-label">输出尺寸</label>
      <div class="size-grid">
        <button
          v-for="s in FAVICON_SIZES"
          :key="s"
          class="size-btn"
          :class="{ active: selectedSizes.includes(s) }"
          @click="toggleSize(s)"
        >{{ s }}×{{ s }}</button>
      </div>
    </div>

    <div class="favicon-actions">
      <button
        class="btn btn-primary"
        :disabled="store.processing || !hasImage || selectedSizes.length === 0"
        @click="generateFavicons"
      >
        {{ store.processing ? '生成中...' : '生成图标' }}
      </button>
      <button
        class="btn"
        :disabled="!icoUrl"
        @click="downloadIco"
      >下载 .ICO</button>
      <button
        class="btn"
        :disabled="!store.images.some(i => i.faviconResults?.length)"
        @click="downloadZip"
      >导出 ZIP</button>
    </div>

    <!-- Results preview -->
    <div v-if="store.images.some(i => i.faviconResults?.length)" class="preview-section">
      <h4 class="preview-title">预览</h4>
      <div v-for="item in store.images" :key="item.id" class="favicon-item">
        <p class="preview-name">{{ item.name }}</p>
        <div class="favicon-grid">
          <div v-for="r in item.faviconResults" :key="r.size" class="favicon-card">
            <img :src="r.url" :alt="`${r.size}x${r.size}`" :style="{ width: Math.min(r.size, 64) + 'px', height: Math.min(r.size, 64) + 'px' }" />
            <span class="favicon-label">{{ r.size }}×{{ r.size }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.favicon-panel {
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
  margin-bottom: 8px;
}
.size-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.size-btn {
  border: 1px solid #ddd;
  background: #fff;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  color: #666;
}
.size-btn.active {
  border-color: #409eff;
  color: #409eff;
  background: #ecf5ff;
}
.favicon-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
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
.preview-section {
  margin-top: 8px;
}
.preview-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}
.favicon-item {
  margin-bottom: 12px;
}
.preview-name {
  font-size: 12px;
  color: #333;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.favicon-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.favicon-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border: 1px solid #eee;
  border-radius: 6px;
  background: #fff;
}
.favicon-label {
  font-size: 10px;
  color: #999;
}
</style>
