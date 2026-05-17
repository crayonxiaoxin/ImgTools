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
  let format: string
  let encodeOptions: Record<string, any> = {}

  if (lossless && targetFormat === 'jpeg') {
    format = 'png'
    encodeOptions.Q = quality
  } else if (lossless) {
    format = targetFormat
    encodeOptions.lossless = true
    encodeOptions.Q = quality
  } else {
    format = targetFormat
    encodeOptions.Q = quality
  }

  return { format, options: encodeOptions }
}

export function losslessFormats(): ImageFormat[] {
  return ['png', 'webp', 'avif', 'tiff']
}
