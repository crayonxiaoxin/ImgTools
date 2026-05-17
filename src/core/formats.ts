export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'bmp' | 'tiff' | 'svg'

export interface FormatInfo {
  format: ImageFormat
  label: string
  extensions: string[]
  mime: string
  readable: boolean
  writable: boolean
  lossyCompress: boolean
  losslessCompress: boolean
}

export const FORMATS: Record<ImageFormat, FormatInfo> = {
  jpeg: { format: 'jpeg', label: 'JPEG', extensions: ['.jpg', '.jpeg', '.jpe'], mime: 'image/jpeg', readable: true, writable: true, lossyCompress: true, losslessCompress: false },
  png:  { format: 'png',  label: 'PNG',  extensions: ['.png'],           mime: 'image/png',  readable: true, writable: true, lossyCompress: true, losslessCompress: true },
  webp: { format: 'webp', label: 'WebP', extensions: ['.webp'],          mime: 'image/webp', readable: true, writable: true, lossyCompress: true,  losslessCompress: true },
  avif: { format: 'avif', label: 'AVIF', extensions: ['.avif'],          mime: 'image/avif', readable: true, writable: true, lossyCompress: true,  losslessCompress: true },
  gif:  { format: 'gif',  label: 'GIF',  extensions: ['.gif'],           mime: 'image/gif',  readable: true, writable: false, lossyCompress: false, losslessCompress: false },
  bmp:  { format: 'bmp',  label: 'BMP',  extensions: ['.bmp'],           mime: 'image/bmp',  readable: true, writable: true, lossyCompress: false, losslessCompress: false },
  tiff: { format: 'tiff', label: 'TIFF', extensions: ['.tif', '.tiff'],  mime: 'image/tiff', readable: true, writable: true, lossyCompress: false, losslessCompress: true },
  svg:  { format: 'svg',  label: 'SVG',  extensions: ['.svg', '.svgz'],  mime: 'image/svg+xml', readable: true, writable: false, lossyCompress: false, losslessCompress: false },
}

export function detectFormat(filename: string, mime?: string): ImageFormat | null {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  for (const info of Object.values(FORMATS)) {
    if (info.extensions.includes(ext)) return info.format
    if (mime && info.mime === mime) return info.format
  }
  return null
}

export function getWritableFormats(): ImageFormat[] {
  return Object.values(FORMATS)
    .filter(f => f.writable)
    .map(f => f.format)
}

export function isFormatSupported(format: ImageFormat): boolean {
  return Object.hasOwn(FORMATS, format)
}
