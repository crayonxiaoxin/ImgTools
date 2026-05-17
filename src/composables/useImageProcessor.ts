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
