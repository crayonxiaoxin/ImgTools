import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ImageFormat } from '@/core/formats'
import { detectFormat, FORMATS } from '@/core/formats'
import { extractMetadata, STRIP_UNSUPPORTED, type MetaField } from '@/core/strip'

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
  faviconResults?: FaviconResult[]
  faviconConfig?: FaviconConfig
  metaBefore?: MetaField[]
  metaAfter?: MetaField[]
}

export type AppMode = 'compress' | 'convert' | 'favicon' | 'pdf' | 'strip'

export interface FaviconResult {
  url: string
  size: number
}

export interface FaviconConfig {
  sizes: number[]
  cropX: number
  cropY: number
  cropSize: number
}

let idCounter = 0
function nextId(): string {
  return `img_${++idCounter}_${Date.now()}`
}

export const useImageStore = defineStore('images', () => {
  const images = ref<ImageItem[]>([])
  const activeMode = ref<AppMode>('compress')
  const processing = ref(false)
  const vipsReady = ref(false)
  const vipsLoading = ref(true)
  const stripConfig = ref({ removeIcc: false })

  const selectedFormats = computed(() => {
    const set = new Set<ImageFormat>()
    images.value.forEach(img => { if (img.format) set.add(img.format) })
    return Array.from(set)
  })

  function scanItemMetadata(item: ImageItem) {
    if (!item.format || STRIP_UNSUPPORTED.has(item.format) || !FORMATS[item.format].writable) return
    void item.file.arrayBuffer()
      .then(buf => extractMetadata(buf))
      .then(fields => {
        const current = images.value.find(i => i.id === item.id)
        if (current && !current.metaBefore) current.metaBefore = fields
      })
      .catch(() => {
        /* leave metaBefore undefined → UI shows unread */
      })
  }

  function addImages(files: File[]) {
    const items: ImageItem[] = files.map(file => {
      const fmt = detectFormat(file.name, file.type)
      return {
        id: nextId(),
        file,
        name: file.name,
        size: file.size,
        format: fmt,
        status: 'pending' as const,
        previewUrl: URL.createObjectURL(file),
        config: {
          quality: 80,
          lossless: false,
          targetFormat: (fmt && FORMATS[fmt].writable ? fmt : 'png') as ImageFormat,
        },
      }
    })
    images.value.push(...items)

    // Non-blocking metadata scan for strip UI (and cheap enough always-on)
    for (const item of items) {
      scanItemMetadata(item)
    }
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
    if (val) vipsLoading.value = false
  }

  function setVipsLoading(val: boolean) {
    vipsLoading.value = val
  }

  function setFaviconResults(id: string, results: FaviconResult[]) {
    const item = images.value.find(i => i.id === id)
    if (!item) return
    item.faviconResults?.forEach(r => URL.revokeObjectURL(r.url))
    item.faviconResults = results
    item.status = 'done'
  }

  function setStripConfig(partial: Partial<{ removeIcc: boolean }>) {
    Object.assign(stripConfig.value, partial)
  }

  function setMetaBefore(id: string, fields: MetaField[]) {
    const item = images.value.find(i => i.id === id)
    if (item) item.metaBefore = fields
  }

  function setMetaAfter(id: string, fields: MetaField[]) {
    const item = images.value.find(i => i.id === id)
    if (item) item.metaAfter = fields
  }

  function setMode(mode: AppMode) {
    activeMode.value = mode
    images.value.forEach(item => {
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl)
      item.resultUrl = undefined
      item.resultSize = undefined
      item.errorMessage = undefined
      item.status = 'pending'
      if (item.faviconResults) {
        item.faviconResults.forEach(r => URL.revokeObjectURL(r.url))
        item.faviconResults = undefined
      }
      item.metaBefore = undefined
      item.metaAfter = undefined
      item.config.quality = 80
      item.config.lossless = false
      item.config.maxWidth = undefined
      if (mode === 'compress') {
        item.config.targetFormat = (item.format && FORMATS[item.format].writable ? item.format : 'png')
      }
    })
    stripConfig.value = { removeIcc: false }

    // Re-scan metadata when entering strip so existing images show before-meta again
    if (mode === 'strip') {
      for (const item of images.value) {
        scanItemMetadata(item)
      }
    }
  }

  return {
    images, activeMode, processing, vipsReady, vipsLoading, selectedFormats, stripConfig,
    addImages, removeImage, clearAll, updateConfig,
    setResult, setError, setProcessing, setVipsReady, setVipsLoading, setMode,
    setFaviconResults, setStripConfig, setMetaBefore, setMetaAfter,
  }
})
