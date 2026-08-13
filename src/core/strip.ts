import { initVips } from './vips'
import type { ImageFormat } from './formats'
import { FORMATS } from './formats'

export type MetaGroup = 'exif' | 'xmp' | 'iptc' | 'icc' | 'other'

export interface MetaField {
  key: string
  labelKey: string
  value?: string
  group: MetaGroup
  sensitive?: boolean
}

export const STRIP_UNSUPPORTED: ReadonlySet<ImageFormat> = new Set(['svg', 'pdf', 'gif'])

const IGNORE_FIELDS = new Set([
  'vips-loader', 'width', 'height', 'bands', 'format', 'coding',
  'interpretation', 'xoffset', 'yoffset', 'xres', 'yres',
])

function classify(name: string): MetaGroup | null {
  const n = name.toLowerCase()
  if (IGNORE_FIELDS.has(n) || n.startsWith('vips-')) return null
  if (n.includes('icc')) return 'icc'
  if (n.includes('gps')) return 'exif' // collapsed later into gps key
  if (n.includes('exif')) return 'exif'
  if (n.includes('xmp')) return 'xmp'
  if (n.includes('iptc')) return 'iptc'
  if (n.includes('comment') || n.includes('description')) return 'other'
  return null
}

export function mapVipsFieldsToMeta(
  fieldNames: string[],
  read: (name: string) => string | undefined,
): MetaField[] {
  const out: MetaField[] = []
  const gpsParts: string[] = []
  let hasIcc = false

  for (const name of fieldNames) {
    const group = classify(name)
    if (!group) continue
    const lower = name.toLowerCase()
    if (lower.includes('icc')) {
      hasIcc = true
      continue
    }
    if (lower.includes('gps')) {
      const v = read(name)
      if (v) gpsParts.push(`${name}=${v}`)
      else gpsParts.push(name)
      continue
    }
    // curated exif keys (exact short names only — avoid LensMake matching Make)
    const short = name.replace(/^exif-ifd\d+-/i, '').replace(/^exif-/i, '')
    if (group === 'exif') {
      const interesting = ['Make', 'Model', 'DateTime', 'DateTimeOriginal', 'Software', 'Orientation', 'Artist', 'Copyright']
      if (!interesting.includes(short)) continue
      out.push({
        key: `exif:${short}`,
        labelKey: `strip.fields.${short}`,
        value: read(name),
        group: 'exif',
      })
      continue
    }
    if (group === 'xmp') {
      out.push({ key: 'xmp', labelKey: 'strip.fields.xmp', group: 'xmp' })
      continue
    }
    if (group === 'iptc') {
      out.push({ key: 'iptc', labelKey: 'strip.fields.iptc', group: 'iptc' })
      continue
    }
    if (group === 'other') {
      out.push({
        key: `other:${name}`,
        labelKey: 'strip.fields.comment',
        value: read(name),
        group: 'other',
      })
    }
  }

  if (gpsParts.length) {
    out.push({
      key: 'gps',
      labelKey: 'strip.fields.gps',
      value: gpsParts.join('; '),
      group: 'exif',
      sensitive: true,
    })
  }
  if (hasIcc) {
    out.push({ key: 'icc', labelKey: 'strip.fields.icc', group: 'icc' })
  }

  // dedupe by key
  const seen = new Set<string>()
  return out.filter(f => (seen.has(f.key) ? false : (seen.add(f.key), true)))
}

/** libvips EXIF get_string often looks like: "TestCam (TestCam, ASCII, 8 components, 8 bytes)" */
export function cleanVipsExifString(raw: string): string {
  if (!/, \d+ components, \d+ bytes\)$/.test(raw)) return raw
  const idx = raw.indexOf(' (')
  return idx > 0 ? raw.slice(0, idx) : raw
}

function readImageField(image: any, name: string): string | undefined {
  try {
    // wasm-vips Image may not expose getType; avoid calling it when missing
    if (typeof image.getType === 'function' && image.getType(name) === 0) {
      return undefined
    }
    const raw = image.getString(name)
    if (raw == null || raw === '') return undefined
    return cleanVipsExifString(String(raw))
  } catch {
    return undefined
  }
}

function fieldsFromImage(image: any): MetaField[] {
  const names: string[] = []
  const vector = image.getFields()
  const n = typeof vector.size === 'function' ? vector.size() : vector.length
  for (let i = 0; i < n; i++) {
    names.push(typeof vector.get === 'function' ? vector.get(i) : vector[i])
  }
  return mapVipsFieldsToMeta(names, (name) => readImageField(image, name))
}

export async function extractMetadata(buffer: ArrayBuffer): Promise<MetaField[]> {
  const v = await initVips()
  const image = v.Image.newFromBuffer(new Uint8Array(buffer))
  try {
    return fieldsFromImage(image)
  } finally {
    image.delete?.()
  }
}

export async function stripMetadata(
  buffer: ArrayBuffer,
  options: { removeIcc: boolean; format: ImageFormat },
): Promise<{ data: Uint8Array; format: string; width: number; height: number; metaAfter: MetaField[] }> {
  if (STRIP_UNSUPPORTED.has(options.format) || !FORMATS[options.format]?.writable) {
    throw new Error(`Unsupported format for strip: ${options.format}`)
  }

  const v = await initVips()
  const decoded = v.Image.newFromBuffer(new Uint8Array(buffer))
  let image = decoded
  try {
    // Apply EXIF orientation into pixels, then strip orientation tag via re-encode keep flags
    image = decoded.autorot()

    const extMap: Record<string, string> = {
      jpeg: '.jpg',
      png: '.png',
      webp: '.webp',
      avif: '.avif',
      bmp: '.bmp',
      tiff: '.tiff',
    }
    const ext = extMap[options.format]
    if (!ext) throw new Error(`Unsupported output format: ${options.format}`)
    const keep = options.removeIcc ? 'none' : 'icc'
    // Maximize fidelity: this mode strips metadata, it is not a compressor.
    // JPEG has no lossless path while staying JPEG → Q=100.
    // WebP/AVIF/TIFF support true lossless re-encode.
    const opts: string[] = [`keep=${keep}`]
    switch (options.format) {
      case 'jpeg':
        opts.push('Q=100')
        break
      case 'webp':
      case 'avif':
        opts.push('lossless=true')
        break
      case 'tiff':
        opts.push('compression=deflate')
        break
      // png/bmp: no quality knobs; re-encode without palette/quantization
      default:
        break
    }

    const data: Uint8Array = image.writeToBuffer(`${ext}[${opts.join(',')}]`)
    const copy = new Uint8Array(data)
    const metaAfter = await extractMetadata(copy.buffer)
    return {
      data,
      format: options.format,
      width: image.width,
      height: image.height,
      metaAfter,
    }
  } finally {
    if (image !== decoded) image.delete?.()
    decoded.delete?.()
  }
}
