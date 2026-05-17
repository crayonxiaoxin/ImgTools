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
      try {
        const response = await fetch(item.resultUrl)
        const blob = await response.blob()
        zip.file(exportFileName(item), blob)
      } catch {
        console.warn(`Failed to fetch result for ${item.name}, skipping`)
      }
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
    const items = store.images
      .filter(i => i.status === 'done' && i.resultUrl)
      .map(i => ({ name: i.name, url: i.resultUrl!, config: { ...i.config } }))
    for (const item of items) {
      if (!item.url) continue
      const a = document.createElement('a')
      a.href = item.url
      a.download = exportFileName(item)
      a.click()
      await new Promise(r => setTimeout(r, 200))
    }
  }

  return { downloadSingle, downloadAllAsZip, downloadAllIndividual }
}

function exportFileName(item: { name: string; config: { targetFormat: string } }): string {
  const base = item.name.replace(/\.[^.]+$/, '')
  const ext = item.config.targetFormat || 'png'
  return `${base}.${ext}`
}
