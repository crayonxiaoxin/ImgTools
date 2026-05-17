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
      const blob = new Blob([result.data as BlobPart], { type: `image/${result.format}` })
      const url = URL.createObjectURL(blob)
      store.setResult(item.id, url, blob.size)
    } catch (e: unknown) {
      store.setError(item.id, e instanceof Error ? e.message : String(e))
    }
  }

  async function processAll(): Promise<void> {
    store.setProcessing(true)
    try {
      for (const item of store.images) {
        await processSingle(item)
      }
    } finally {
      store.setProcessing(false)
    }
  }

  return { processSingle, processAll }
}
