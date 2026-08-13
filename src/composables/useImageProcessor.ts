import { useImageStore, type ImageItem } from '@/stores/imageStore'
import { processImage } from '@/core/pipeline'
import { extractMetadata, stripMetadata, STRIP_UNSUPPORTED } from '@/core/strip'
import { FORMATS } from '@/core/formats'
import i18n from '@/i18n'

export interface ProcessAllSummary {
  total: number
  done: number
  failed: number
}

export function useImageProcessor() {
  const store = useImageStore()

  async function processSingle(item: ImageItem): Promise<void> {
    if (item.status === 'processing') return
    item.status = 'processing'
    try {
      const buffer = await item.file.arrayBuffer()

      if (store.activeMode === 'strip') {
        const format = item.format
        if (!format || STRIP_UNSUPPORTED.has(format) || !FORMATS[format].writable) {
          throw new Error(i18n.global.t('strip.unsupported'))
        }
        if (!item.metaBefore) {
          try { item.metaBefore = await extractMetadata(buffer) } catch { /* ignore */ }
        }
        const result = await stripMetadata(buffer, {
          removeIcc: store.stripConfig.removeIcc,
          format,
        })
        const blob = new Blob([result.data as BlobPart], { type: `image/${result.format}` })
        const url = URL.createObjectURL(blob)
        store.setResult(item.id, url, blob.size)
        store.setMetaAfter(item.id, result.metaAfter)
        return
      }

      // In convert mode, use max quality — don't apply compression
      const config = store.activeMode === 'convert'
        ? { ...item.config, quality: 100, lossless: false }
        : item.config
      const result = await processImage(buffer, item.format ?? 'png', config)
      const blob = new Blob([result.data as BlobPart], { type: `image/${result.format}` })
      const url = URL.createObjectURL(blob)
      store.setResult(item.id, url, blob.size)
    } catch (e: unknown) {
      store.setError(item.id, e instanceof Error ? e.message : String(e))
    }
  }

  async function processAll(): Promise<ProcessAllSummary> {
    store.setProcessing(true)
    try {
      for (const item of store.images) {
        await processSingle(item)
      }
    } finally {
      store.setProcessing(false)
    }
    const done = store.images.filter(i => i.status === 'done').length
    const failed = store.images.filter(i => i.status === 'error').length
    return { total: store.images.length, done, failed }
  }

  return { processSingle, processAll }
}
