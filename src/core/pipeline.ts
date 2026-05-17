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

export async function processImage(
  buffer: ArrayBuffer,
  originalFormat: ImageFormat,
  options: CompressOptions,
): Promise<ProcessResult> {
  const v = await initVips()
  let image
  try {
    image = v.Image.newFromBuffer(new Uint8Array(buffer))
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

  const optionsForSave: Record<string, any> = { ...encode.options }
  delete optionsForSave.resize

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

  let result: Uint8Array
  try {
    result = img.writeToBuffer(ext, optionsForSave)
  } catch (e) {
    throw new Error(`Failed to encode image as ${encode.format}: ${e instanceof Error ? e.message : String(e)}`)
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
