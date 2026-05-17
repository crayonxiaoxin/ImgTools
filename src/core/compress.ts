import type { ImageFormat } from './formats'

export interface CompressOptions {
  quality: number
  lossless: boolean
  targetFormat: ImageFormat
  maxWidth?: number
}

export interface VipsEncodeOptions {
  format: string
  options: Record<string, any>
}

export function buildEncodeOptions(options: CompressOptions, _originalFormat: ImageFormat): VipsEncodeOptions {
  const { quality, lossless, targetFormat } = options
  let format: string = targetFormat
  let encodeOptions: Record<string, any> = {}

  // Lossless JPEG isn't possible — fallback to PNG
  if (lossless && targetFormat === 'jpeg') {
    format = 'png'
  }

  switch (format) {
    case 'png':
      if (lossless) {
        encodeOptions.compression = 9
      } else {
        // Lossy PNG via palette quantization
        encodeOptions.palette = true
        encodeOptions.Q = quality
        encodeOptions.compression = 9
        encodeOptions.dither = 1.0
      }
      break
    case 'jpeg':
      encodeOptions.Q = quality
      encodeOptions.optimize_coding = true
      break
    case 'webp':
      if (lossless) {
        encodeOptions.lossless = true
      }
      encodeOptions.Q = quality
      break
    case 'avif':
      if (lossless) {
        encodeOptions.lossless = true
      }
      encodeOptions.Q = quality
      break
    case 'tiff':
      encodeOptions.compression = lossless ? 'deflate' : 'jpeg'
      encodeOptions.Q = quality
      break
    case 'bmp':
      // BMP is uncompressed, no options needed
      break
  }

  return { format, options: encodeOptions }
}

export function losslessFormats(): ImageFormat[] {
  return ['png', 'webp', 'avif', 'tiff']
}
