import { initVips } from './vips'
import type { ImageFormat } from './formats'
import type { CompressOptions } from './compress'
import { buildEncodeOptions } from './compress'

export interface ProcessResult {
  data: Uint8Array
  format: string
  width: number
  height: number
}

async function renderSvgToRgba(buffer: ArrayBuffer, scale: number): Promise<{ data: Uint8Array; width: number; height: number }> {
  const blob = new Blob([buffer], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Failed to load SVG'))
      el.src = url
    })
    const width = Math.round(img.naturalWidth * scale)
    const height = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, width, height)
    return { data: new Uint8Array(imageData.data.buffer), width, height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function processImage(
  buffer: ArrayBuffer,
  originalFormat: ImageFormat,
  options: CompressOptions,
): Promise<ProcessResult> {
  const v = await initVips()
  let image
  try {
    if (originalFormat === 'svg') {
      const scale = 2
      const { data, width, height } = await renderSvgToRgba(buffer, scale)
      image = v.Image.newFromMemory(data, width, height, 4, v.BandFormat.uchar)
        .copy({ interpretation: v.Interpretation.srgb })
    } else {
      image = v.Image.newFromBuffer(new Uint8Array(buffer))
    }
  } catch (e) {
    throw new Error(`Failed to decode image: ${e instanceof Error ? e.message : String(e)}`)
  }

  let img = image

  if (options.maxWidth) {
    const width = img.width
    if (width > options.maxWidth) {
      const scale = options.maxWidth / width
      img = img.resize(scale)
    }
  }

  const encode = buildEncodeOptions(options, originalFormat)

  const extMap: Record<string, string> = {
    jpeg: '.jpg',
    png: '.png',
    webp: '.webp',
    avif: '.avif',
    bmp: '.bmp',
    tiff: '.tiff',
  }

  const ext = extMap[encode.format]
  if (!ext) throw new Error(`Unsupported output format: ${encode.format}`)

  function encodeWithQuality(quality: number): string {
    const opts: string[] = []
    for (const [k, v] of Object.entries(encode.options)) {
      if (k === 'Q') opts.push(`Q=${quality}`)
      else if (k === 'resize') continue
      else if (typeof v === 'boolean') opts.push(`${k}=${v}`)
      else opts.push(`${k}=${v}`)
    }
    return opts.length > 0 ? `${ext}[${opts.join(',')}]` : ext
  }

  let result: Uint8Array
  let currentQ: number | null = 'Q' in encode.options ? encode.options.Q : null

  try {
    result = img.writeToBuffer(encodeWithQuality(currentQ ?? 80))
  } catch (e) {
    throw new Error(`Failed to encode image as ${encode.format}: ${e instanceof Error ? e.message : String(e)}`)
  }

  // For same-format compression, auto-reduce quality until file is actually smaller
  if (currentQ !== null && encode.format === originalFormat && result.length > buffer.byteLength) {
    let q = currentQ - 10
    while (q >= 10 && result.length > buffer.byteLength) {
      try {
        result = img.writeToBuffer(encodeWithQuality(q))
      } catch {
        break
      }
      q -= 10
    }
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
    // Vips type definition doesn't expose the pages property, but it exists at runtime
    pages: (image as any).pages,
  }
}
