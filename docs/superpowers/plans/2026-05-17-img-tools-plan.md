# ImgTools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-only image compression and format conversion tool using wasm-vips.

**Architecture:** Vue 3 SPA with Pinia state management. wasm-vips handles all image decode/encode/transform in-browser. Processing pipeline is a series of composable steps (decode → transform → encode). UI has two modes (compress/convert) sharing the same preview and batch list components.

**Tech Stack:** Vue 3 + Vite + TypeScript, Pinia, wasm-vips, JSZip

---

## File Structure

```
img-tools/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── core/
│   │   ├── vips.ts              — wasm-vips init, singleton
│   │   ├── pipeline.ts          — decode → transform → encode pipeline
│   │   ├── compress.ts          — compress params → vips encode options
│   │   └── formats.ts           — format support matrix + helpers
│   ├── composables/
│   │   ├── useImageProcessor.ts — process single image
│   │   └── useBatchExport.ts    — batch download / zip
│   ├── stores/
│   │   └── imageStore.ts        — Pinia store: images[], mode, config
│   └── components/
│       ├── AppHeader.vue
│       ├── DropZone.vue
│       ├── ImagePreview.vue
│       ├── Sidebar.vue
│       ├── ParamPanel.vue
│       ├── BatchList.vue
│       └── StatusBar.vue
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `img-tools/package.json`
- Create: `img-tools/tsconfig.json`
- Create: `img-tools/tsconfig.node.json`
- Create: `img-tools/vite.config.ts`
- Create: `img-tools/index.html`
- Create: `img-tools/src/main.ts`
- Create: `img-tools/src/App.vue`
- Create: `img-tools/src/vite-env.d.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "img-tools",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.5",
    "pinia": "^2.2",
    "wasm-vips": "^0.2",
    "jszip": "^3.10"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2",
    "typescript": "^5.6",
    "vite": "^6.0",
    "vue-tsc": "^2.2"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
}
```

- [ ] **Step 3: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    exclude: ['wasm-vips'],
  },
})
```

- [ ] **Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ImgTools</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create src/vite-env.d.ts**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 7: Create src/main.ts**

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

- [ ] **Step 8: Create src/App.vue**

```vue
<script setup lang="ts">
</script>

<template>
  <div id="app-root">
    <p>ImgTools</p>
  </div>
</template>
```

- [ ] **Step 9: Install dependencies**

Run: `npm install`
Expected: node_modules created, no errors

- [ ] **Step 10: Verify build**

Run: `npx vite build`
Expected: Build succeeds, dist/ folder created

- [ ] **Step 11: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Vue 3 + Vite + Pinia project"
```

---

### Task 2: Formats Module

**Files:**
- Create: `src/core/formats.ts`

- [ ] **Step 1: Create formats module**

```ts
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'bmp' | 'tiff' | 'svg'

export interface FormatInfo {
  format: ImageFormat
  label: string
  extensions: string[]
  mime: string
  readable: boolean
  writable: boolean
  lossyCompress: boolean
  losslessCompress: boolean
}

export const FORMATS: Record<ImageFormat, FormatInfo> = {
  jpeg: { format: 'jpeg', label: 'JPEG', extensions: ['.jpg', '.jpeg', '.jpe'], mime: 'image/jpeg', readable: true, writable: true, lossyCompress: true, losslessCompress: false },
  png:  { format: 'png',  label: 'PNG',  extensions: ['.png'],           mime: 'image/png',  readable: true, writable: true, lossyCompress: false, losslessCompress: true },
  webp: { format: 'webp', label: 'WebP', extensions: ['.webp'],          mime: 'image/webp', readable: true, writable: true, lossyCompress: true,  losslessCompress: true },
  avif: { format: 'avif', label: 'AVIF', extensions: ['.avif'],          mime: 'image/avif', readable: true, writable: true, lossyCompress: true,  losslessCompress: true },
  gif:  { format: 'gif',  label: 'GIF',  extensions: ['.gif'],           mime: 'image/gif',  readable: true, writable: false, lossyCompress: false, losslessCompress: false },
  bmp:  { format: 'bmp',  label: 'BMP',  extensions: ['.bmp'],           mime: 'image/bmp',  readable: true, writable: true, lossyCompress: false, losslessCompress: false },
  tiff: { format: 'tiff', label: 'TIFF', extensions: ['.tif', '.tiff'],  mime: 'image/tiff', readable: true, writable: true, lossyCompress: false, losslessCompress: true },
  svg:  { format: 'svg',  label: 'SVG',  extensions: ['.svg'],           mime: 'image/svg+xml', readable: true, writable: false, lossyCompress: false, losslessCompress: false },
}

export function detectFormat(filename: string, mime?: string): ImageFormat | null {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  for (const info of Object.values(FORMATS)) {
    if (info.extensions.includes(ext)) return info.format
    if (mime && info.mime === mime) return info.format
  }
  return null
}

export function getWritableFormats(): ImageFormat[] {
  return (Object.values(FORMATS) as FormatInfo[])
    .filter(f => f.writable)
    .map(f => f.format)
}

export function isFormatSupported(format: ImageFormat): boolean {
  return format in FORMATS
}
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/core/formats.ts
git commit -m "feat: add format support matrix"
```

---

### Task 3: Vips Core — WASM Initialization

**Files:**
- Create: `src/core/vips.ts`

- [ ] **Step 1: Create vips wrapper**

```ts
import type Vips from 'wasm-vips'

let _vips: typeof Vips | null = null
let _ready = false
let _error: string | null = null
let _listeners: Array<(ready: boolean, error: string | null) => void> = []

export function onVipsReady(callback: (ready: boolean, error: string | null) => void): () => void {
  _listeners.push(callback)
  if (_ready || _error) callback(_ready, _error)
  return () => { _listeners = _listeners.filter(l => l !== callback) }
}

export async function initVips(): Promise<typeof Vips> {
  if (_vips) return _vips
  try {
    const mod = await import('wasm-vips')
    _vips = await mod.default()
    _ready = true
    _error = null
    _listeners.forEach(l => l(true, null))
    return _vips
  } catch (e: any) {
    _error = e.message ?? 'Failed to load wasm-vips'
    _ready = false
    _listeners.forEach(l => l(false, _error))
    throw e
  }
}

export function isVipsReady(): boolean {
  return _ready
}

export function getVipsError(): string | null {
  return _error
}
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/core/vips.ts
git commit -m "feat: add wasm-vips initialization wrapper"
```

---

### Task 4: Compress Parameters Module

**Files:**
- Create: `src/core/compress.ts`

- [ ] **Step 1: Create compress module**

```ts
import type { ImageFormat } from './formats'

export interface CompressOptions {
  quality: number      // 0-100
  lossless: boolean
  targetFormat: ImageFormat
  maxWidth?: number
}

export interface VipsEncodeOptions {
  format: string
  options: Record<string, any>
}

export function buildEncodeOptions(options: CompressOptions, originalFormat: ImageFormat): VipsEncodeOptions {
  const { quality, lossless, targetFormat, maxWidth } = options
  let format: string
  let encodeOptions: Record<string, any> = {}

  if (lossless && targetFormat === 'jpeg') {
    // JPEG doesn't support lossless; fall back to PNG
    format = 'png'
  } else if (lossless) {
    format = targetFormat
    encodeOptions.lossless = true
    encodeOptions.Q = quality
  } else {
    format = targetFormat
    encodeOptions.Q = quality
  }

  if (format === 'jpeg') {
    encodeOptions.Q = quality
  }

  if (maxWidth && maxWidth > 0) {
    encodeOptions.resize = maxWidth
  }

  return { format, options: encodeOptions }
}

export function losslessFormats(): ImageFormat[] {
  return ['png', 'webp', 'avif', 'tiff']
}
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/core/compress.ts
git commit -m "feat: add compress parameter mapping"
```

---

### Task 5: Processing Pipeline

**Files:**
- Create: `src/core/pipeline.ts`

- [ ] **Step 1: Create pipeline module**

```ts
import { initVips } from './vips'
import type { CompressOptions } from './compress'
import { buildEncodeOptions } from './compress'

export interface ProcessResult {
  data: Uint8Array
  format: string
  width: number
  height: number
}

export async function processImage(
  buffer: ArrayBuffer,
  originalFormat: string,
  options: CompressOptions,
): Promise<ProcessResult> {
  const v = await initVips()
  const image = v.Image.newFromBuffer(new Uint8Array(buffer))

  let img = image

  if (options.maxWidth && options.maxWidth > 0) {
    const width = img.width
    const height = img.height
    if (width > options.maxWidth) {
      const scale = options.maxWidth / width
      img = img.resize(scale)
    }
  }

  const encode = buildEncodeOptions(options, originalFormat as any)

  let result: Uint8Array
  switch (encode.format) {
    case 'jpeg':
      result = img.jpegsaveBuffer({ Q: encode.options.Q })
      break
    case 'png':
      result = img.pngsaveBuffer()
      break
    case 'webp':
      result = img.webpsaveBuffer({ Q: encode.options.Q, lossless: encode.options.lossless ?? false })
      break
    case 'avif':
      result = img.heifsaveBuffer({ Q: encode.options.Q, lossless: encode.options.lossless ?? false, compression: encode.options.lossless ? 'lossless' : 'av1' })
      break
    case 'bmp':
      result = img.bmpsaveBuffer()
      break
    case 'tiff':
      result = img.tiffsaveBuffer({ compression: encode.options.lossless ? 'deflate' : 'lzw' })
      break
    default:
      throw new Error(`Unsupported output format: ${encode.format}`)
  }

  return {
    data: result,
    format: encode.format,
    width: img.width,
    height: img.height,
  }
}

export async function getImageInfo(buffer: ArrayBuffer): Promise<{ width: number; height: number; pages?: number }> {
  const v = await initVips()
  const image = v.Image.newFromBuffer(new Uint8Array(buffer))
  return {
    width: image.width,
    height: image.height,
    pages: (image as any).pages,
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/core/pipeline.ts
git commit -m "feat: add image processing pipeline"
```

---

### Task 6: Pinia Image Store

**Files:**
- Create: `src/stores/imageStore.ts`

- [ ] **Step 1: Create Pinia store**

```ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ImageFormat } from '@/core/formats'
import { detectFormat } from '@/core/formats'

export interface ImageItem {
  id: string
  file: File
  name: string
  size: number
  format: ImageFormat | null
  status: 'pending' | 'processing' | 'done' | 'error'
  errorMessage?: string
  previewUrl?: string
  resultUrl?: string
  resultSize?: number
  config: {
    quality: number
    lossless: boolean
    targetFormat: ImageFormat
    maxWidth?: number
  }
}

export type AppMode = 'compress' | 'convert'

let idCounter = 0
function nextId(): string {
  return `img_${++idCounter}_${Date.now()}`
}

export const useImageStore = defineStore('images', () => {
  const images = ref<ImageItem[]>([])
  const activeMode = ref<AppMode>('compress')
  const processing = ref(false)
  const vipsReady = ref(false)

  const selectedFormats = computed(() => {
    const set = new Set<ImageFormat>()
    images.value.forEach(img => { if (img.format) set.add(img.format) })
    return Array.from(set)
  })

  function addImages(files: File[]) {
    const items: ImageItem[] = files.map(file => ({
      id: nextId(),
      file,
      name: file.name,
      size: file.size,
      format: detectFormat(file.name, file.type),
      status: 'pending' as const,
      previewUrl: URL.createObjectURL(file),
      config: {
        quality: 80,
        lossless: false,
        targetFormat: 'webp' as ImageFormat,
      },
    }))
    images.value.push(...items)
  }

  function removeImage(id: string) {
    const idx = images.value.findIndex(i => i.id === id)
    if (idx === -1) return
    const item = images.value[idx]
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    if (item.resultUrl) URL.revokeObjectURL(item.resultUrl)
    images.value.splice(idx, 1)
  }

  function clearAll() {
    images.value.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl)
    })
    images.value = []
  }

  function updateConfig(id: string, partial: Partial<ImageItem['config']>) {
    const item = images.value.find(i => i.id === id)
    if (item) Object.assign(item.config, partial)
  }

  function setResult(id: string, resultUrl: string, resultSize: number) {
    const item = images.value.find(i => i.id === id)
    if (!item) return
    if (item.resultUrl) URL.revokeObjectURL(item.resultUrl)
    item.resultUrl = resultUrl
    item.resultSize = resultSize
    item.status = 'done'
  }

  function setError(id: string, message: string) {
    const item = images.value.find(i => i.id === id)
    if (!item) return
    item.status = 'error'
    item.errorMessage = message
  }

  function setProcessing(val: boolean) {
    processing.value = val
  }

  function setVipsReady(val: boolean) {
    vipsReady.value = val
  }

  function setMode(mode: AppMode) {
    activeMode.value = mode
    images.value.forEach(item => {
      if (activeMode.value === 'compress') {
        item.config.targetFormat = item.format ?? 'webp'
      }
    })
  }

  return {
    images, activeMode, processing, vipsReady, selectedFormats,
    addImages, removeImage, clearAll, updateConfig,
    setResult, setError, setProcessing, setVipsReady, setMode,
  }
})
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/stores/imageStore.ts
git commit -m "feat: add Pinia image store"
```

---

### Task 7: useImageProcessor Composable

**Files:**
- Create: `src/composables/useImageProcessor.ts`

- [ ] **Step 1: Create image processor composable**

```ts
import { useImageStore, type ImageItem } from '@/stores/imageStore'
import { processImage } from '@/core/pipeline'

export function useImageProcessor() {
  const store = useImageStore()

  async function processSingle(item: ImageItem): Promise<void> {
    if (item.status === 'processing') return
    item.status = 'processing'
    try {
      const buffer = await item.file.arrayBuffer()
      const result = await processImage(buffer, item.format ?? 'png', item.config)
      const blob = new Blob([result.data], { type: `image/${result.format}` })
      const url = URL.createObjectURL(blob)
      store.setResult(item.id, url, blob.size)
    } catch (e: any) {
      store.setError(item.id, e.message ?? 'Processing failed')
    }
  }

  async function processAll(): Promise<void> {
    store.setProcessing(true)
    for (const item of store.images) {
      await processSingle(item)
    }
    store.setProcessing(false)
  }

  return { processSingle, processAll }
}
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/composables/useImageProcessor.ts
git commit -m "feat: add image processor composable"
```

---

### Task 8: useBatchExport Composable

**Files:**
- Create: `src/composables/useBatchExport.ts`

- [ ] **Step 1: Create batch export composable**

```ts
import { useImageStore } from '@/stores/imageStore'
import JSZip from 'jszip'

export function useBatchExport() {
  const store = useImageStore()

  function downloadSingle(id: string) {
    const item = store.images.find(i => i.id === id)
    if (!item?.resultUrl) return
    const a = document.createElement('a')
    a.href = item.resultUrl
    a.download = exportFileName(item)
    a.click()
  }

  async function downloadAllAsZip(): Promise<void> {
    const doneItems = store.images.filter(i => i.status === 'done' && i.resultUrl)
    if (doneItems.length === 0) return

    const zip = new JSZip()
    for (const item of doneItems) {
      if (!item.resultUrl) continue
      const response = await fetch(item.resultUrl)
      const blob = await response.blob()
      zip.file(exportFileName(item), blob)
    }

    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = 'img-tools-export.zip'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function downloadAllIndividual(): Promise<void> {
    const doneItems = store.images.filter(i => i.status === 'done' && i.resultUrl)
    for (const item of doneItems) {
      if (!item.resultUrl) continue
      const a = document.createElement('a')
      a.href = item.resultUrl
      a.download = exportFileName(item)
      a.click()
      await new Promise(r => setTimeout(r, 200))
    }
  }

  return { downloadSingle, downloadAllAsZip, downloadAllIndividual }
}

function exportFileName(item: { name: string; config: { targetFormat: string } }): string {
  const base = item.name.replace(/\.[^.]+$/, '')
  return `${base}.${item.config.targetFormat}`
}
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/composables/useBatchExport.ts
git commit -m "feat: add batch export composable"
```

---

### Task 9: DropZone Component

**Files:**
- Create: `src/components/DropZone.vue`

- [ ] **Step 1: Create DropZone component**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '@/stores/imageStore'

const store = useImageStore()
const dragging = ref(false)
const inputRef = ref<HTMLInputElement>()

function onDragOver(e: DragEvent) {
  e.preventDefault()
  dragging.value = true
}

function onDragLeave() {
  dragging.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragging.value = false
  if (e.dataTransfer?.files.length) {
    store.addImages(Array.from(e.dataTransfer.files))
  }
}

function onFilePick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) {
    store.addImages(Array.from(input.files))
    input.value = ''
  }
}

function selectFiles() {
  inputRef.value?.click()
}
</script>

<template>
  <div
    class="drop-zone"
    :class="{ dragging }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @click="selectFiles"
  >
    <input
      ref="inputRef"
      type="file"
      multiple
      accept="image/*"
      style="display:none"
      @change="onFilePick"
    />
    <div class="drop-zone-content">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <p>将图片拖拽到此处</p>
      <p class="hint">或点击选择文件</p>
    </div>
  </div>
</template>

<style scoped>
.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #fafafa;
}
.drop-zone:hover, .drop-zone.dragging {
  border-color: #409eff;
  background: #ecf5ff;
}
.drop-zone-content svg {
  color: #999;
  margin-bottom: 8px;
}
.drop-zone-content p {
  margin: 4px 0;
  font-size: 14px;
  color: #333;
}
.hint {
  font-size: 12px !important;
  color: #999 !important;
}
</style>
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/DropZone.vue
git commit -m "feat: add drop zone component"
```

---

### Task 10: Sidebar Component

**Files:**
- Create: `src/components/Sidebar.vue`

- [ ] **Step 1: Create Sidebar component**

```vue
<script setup lang="ts">
import { useImageStore } from '@/stores/imageStore'
import type { AppMode } from '@/stores/imageStore'

const store = useImageStore()

function switchMode(mode: AppMode) {
  store.setMode(mode)
}
</script>

<template>
  <aside class="sidebar">
    <div class="mode-section">
      <h3 class="section-title">模式</h3>
      <div
        class="mode-item"
        :class="{ active: store.activeMode === 'compress' }"
        @click="switchMode('compress')"
      >
        <span class="mode-icon">📦</span>
        <span>压缩</span>
      </div>
      <div
        class="mode-item"
        :class="{ active: store.activeMode === 'convert' }"
        @click="switchMode('convert')"
      >
        <span class="mode-icon">🔄</span>
        <span>转换</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 160px;
  background: #fff;
  border-right: 1px solid #eee;
  padding: 16px 0;
}
.section-title {
  font-size: 11px;
  text-transform: uppercase;
  color: #999;
  padding: 0 16px;
  margin-bottom: 8px;
  letter-spacing: 1px;
}
.mode-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all 0.15s;
}
.mode-item:hover {
  background: #f5f5f5;
}
.mode-item.active {
  background: #e8f4f8;
  color: #409eff;
  font-weight: 600;
}
.mode-icon {
  font-size: 16px;
}
</style>
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.vue
git commit -m "feat: add sidebar with mode switch"
```

---

### Task 11: ParamPanel Component

**Files:**
- Create: `src/components/ParamPanel.vue`

- [ ] **Step 1: Create ParamPanel component**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useImageStore } from '@/stores/imageStore'
import { getWritableFormats, type ImageFormat } from '@/core/formats'
import { losslessFormats } from '@/core/compress'

const store = useImageStore()
const writableFormats = computed(() => getWritableFormats())
const losslessFormatSet = computed(() => new Set(losslessFormats()))

function updateGlobalConfig(field: string, value: any) {
  store.images.forEach(item => {
    if (item.status === 'pending' || item.status === 'done' || item.status === 'error') {
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
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/ParamPanel.vue
git commit -m "feat: add parameter panel component"
```

---

### Task 12: ImagePreview Component

**Files:**
- Create: `src/components/ImagePreview.vue`

- [ ] **Step 1: Create ImagePreview component**

```vue
<script setup lang="ts">
import { useImageStore } from '@/stores/imageStore'

const store = useImageStore()

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
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
            <p v-if="item.status === 'done' && item.resultSize" class="preview-result">
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
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/ImagePreview.vue
git commit -m "feat: add image preview component"
```

---

### Task 13: BatchList Component

**Files:**
- Create: `src/components/BatchList.vue`

- [ ] **Step 1: Create BatchList component**

```vue
<script setup lang="ts">
import { useImageStore } from '@/stores/imageStore'
import { useImageProcessor } from '@/composables/useImageProcessor'
import { useBatchExport } from '@/composables/useBatchExport'

const store = useImageStore()
const { processAll } = useImageProcessor()
const { downloadSingle, downloadAllAsZip, downloadAllIndividual } = useBatchExport()

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const statusLabels: Record<string, string> = {
  pending: '等待处理',
  processing: '处理中',
  done: '已完成',
  error: '失败',
}

function hasResults(): boolean {
  return store.images.some(i => i.status === 'done')
}
</script>

<template>
  <div class="batch-list">
    <div class="batch-header">
      <h3>文件列表 ({{ store.images.length }})</h3>
      <div class="batch-actions">
        <button
          class="btn btn-primary"
          :disabled="store.processing"
          @click="processAll"
        >
          {{ store.processing ? '处理中...' : '开始处理' }}
        </button>
        <button
          class="btn"
          :disabled="!hasResults()"
          @click="downloadAllAsZip"
        >导出 ZIP</button>
        <button
          class="btn"
          :disabled="!hasResults()"
          @click="downloadAllIndividual"
        >逐个下载</button>
        <button
          class="btn btn-danger"
          :disabled="store.images.length === 0"
          @click="store.clearAll()"
        >清空</button>
      </div>
    </div>
    <div class="batch-table-wrap" v-if="store.images.length > 0">
      <table class="batch-table">
        <thead>
          <tr>
            <th>文件名</th>
            <th>原大小</th>
            <th>格式</th>
            <th>处理后</th>
            <th>压缩率</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in store.images" :key="item.id">
            <td :title="item.name">{{ item.name }}</td>
            <td>{{ formatSize(item.size) }}</td>
            <td>{{ item.format?.toUpperCase() ?? '-' }}</td>
            <td>{{ item.resultSize ? formatSize(item.resultSize) : '-' }}</td>
            <td>
              <span v-if="item.status === 'done' && item.resultSize" class="rate">
                {{ ((1 - item.resultSize / item.size) * 100).toFixed(1) }}%
              </span>
              <span v-else>-</span>
            </td>
            <td>
              <span class="status-tag" :class="item.status">
                {{ statusLabels[item.status] }}
              </span>
            </td>
            <td>
              <button
                v-if="item.status === 'done'"
                class="btn btn-sm"
                @click="downloadSingle(item.id)"
              >下载</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.batch-list {
  margin-top: 16px;
}
.batch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.batch-header h3 {
  font-size: 14px;
  font-weight: 600;
}
.batch-actions {
  display: flex;
  gap: 6px;
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
.btn-danger {
  color: #f56c6c;
  border-color: #f56c6c;
}
.btn-sm {
  padding: 2px 8px;
  font-size: 12px;
}
.batch-table-wrap {
  overflow-x: auto;
}
.batch-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.batch-table th {
  background: #f5f5f5;
  padding: 8px 10px;
  text-align: left;
  font-weight: 500;
  color: #666;
  white-space: nowrap;
}
.batch-table td {
  padding: 8px 10px;
  border-top: 1px solid #eee;
}
.status-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}
.status-tag.pending { background: #f0f0f0; color: #999; }
.status-tag.processing { background: #ecf5ff; color: #409eff; }
.status-tag.done { background: #f0f9eb; color: #67c23a; }
.status-tag.error { background: #fef0f0; color: #f56c6c; }
.rate {
  color: #67c23a;
  font-weight: 500;
}
</style>
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/BatchList.vue
git commit -m "feat: add batch list and action buttons"
```

---

### Task 14: StatusBar Component

**Files:**
- Create: `src/components/StatusBar.vue`

- [ ] **Step 1: Create StatusBar component**

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useImageStore } from '@/stores/imageStore'
import { initVips, isVipsReady, getVipsError, onVipsReady } from '@/core/vips'

const store = useImageStore()
const loading = ref(!isVipsReady())
const error = ref<string | null>(getVipsError())

const doneCount = computed(() => store.images.filter(i => i.status === 'done').length)
const totalCount = computed(() => store.images.length)

onMounted(() => {
  if (!isVipsReady()) {
    initVips()
      .then(() => {
        loading.value = false
        store.setVipsReady(true)
      })
      .catch((e: any) => {
        error.value = e.message ?? 'Failed to load image processor'
        loading.value = false
      })
  } else {
    loading.value = false
    store.setVipsReady(true)
  }

  onVipsReady((ready, err) => {
    loading.value = false
    if (err) error.value = err
    else store.setVipsReady(true)
  })
})
</script>

<template>
  <div class="status-bar">
    <div v-if="loading" class="status-item">
      <span class="spinner"></span>
      加载图像引擎...
    </div>
    <div v-else-if="error" class="status-item error">
      引擎加载失败: {{ error }}
    </div>
    <div v-else class="status-item">
      <span>引擎就绪</span>
      <span v-if="totalCount > 0" class="divider">|</span>
      <span v-if="totalCount > 0">{{ doneCount }}/{{ totalCount }} 已完成</span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: #fafafa;
  border-top: 1px solid #eee;
  font-size: 12px;
  color: #666;
}
.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-item.error {
  color: #f56c6c;
}
.divider {
  color: #ddd;
}
.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #ddd;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/StatusBar.vue
git commit -m "feat: add status bar with WASM loading indicator"
```

---

### Task 15: AppHeader Component

**Files:**
- Create: `src/components/AppHeader.vue`

- [ ] **Step 1: Create AppHeader**

```vue
<script setup lang="ts">
</script>

<template>
  <header class="app-header">
    <h1 class="logo">ImgTools</h1>
    <p class="tagline">浏览器端图片处理工具</p>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #eee;
}
.logo {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: #333;
}
.tagline {
  font-size: 12px;
  color: #999;
  margin: 0;
}
</style>
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/AppHeader.vue
git commit -m "feat: add app header"
```

---

### Task 16: Assemble App.vue — Final Integration

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Replace App.vue with full layout**

```vue
<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import Sidebar from '@/components/Sidebar.vue'
import DropZone from '@/components/DropZone.vue'
import ImagePreview from '@/components/ImagePreview.vue'
import ParamPanel from '@/components/ParamPanel.vue'
import BatchList from '@/components/BatchList.vue'
import StatusBar from '@/components/StatusBar.vue'
</script>

<template>
  <div class="app-layout">
    <AppHeader />
    <div class="app-body">
      <Sidebar />
      <main class="main-area">
        <div class="content-panels">
          <div class="left-panel">
            <DropZone />
            <ImagePreview />
          </div>
          <div class="right-panel">
            <ParamPanel />
          </div>
        </div>
        <BatchList />
      </main>
    </div>
    <StatusBar />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
}
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.app-body {
  display: flex;
  flex: 1;
}
.main-area {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}
.content-panels {
  display: flex;
  gap: 16px;
}
.left-panel {
  flex: 1;
}
.right-panel {
  width: 240px;
  flex-shrink: 0;
}
</style>
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/App.vue
git commit -m "feat: assemble final application layout"
```

---

### Task 17: Cleanup and Polish

**Files:**
- Modify: various

- [ ] **Step 1: Verify full build**

Run: `npx vite build`
Expected: Build succeeds without errors

- [ ] **Step 2: Install and add .gitignore**

```bash
cat > .gitignore << 'EOF'
node_modules/
dist/
.superpowers/
*.local
EOF
git add .gitignore
git commit -m "chore: add gitignore"
```

- [ ] **Step 3: Run dev server and verify**

Run: `npx vite --host`
Expected: Dev server starts. Open URL, verify all components render, drop zone works, etc.

- [ ] **Step 4: Final commit with any touch-ups**

```bash
git add -A
git commit -m "chore: final polish"
```
