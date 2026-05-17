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
  }

  return {
    images, activeMode, processing, vipsReady, selectedFormats,
    addImages, removeImage, clearAll, updateConfig,
    setResult, setError, setProcessing, setVipsReady, setMode,
  }
})
