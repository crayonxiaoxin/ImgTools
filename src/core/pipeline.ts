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
