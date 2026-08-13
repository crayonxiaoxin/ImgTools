/**
 * Lossless-ish JPEG metadata strip: drop APP/COM segments, keep compressed scan data.
 * Does not decode/re-encode pixels (no quality loss, no Q=100 bloat).
 */
export interface JpegStripOptions {
  keepIcc: boolean
}

function asciiAt(data: Uint8Array, offset: number, text: string): boolean {
  if (offset + text.length > data.length) return false
  for (let i = 0; i < text.length; i++) {
    if (data[offset + i] !== text.charCodeAt(i)) return false
  }
  return true
}

function shouldKeepSegment(marker: number, data: Uint8Array, payloadStart: number, keepIcc: boolean): boolean {
  // COM
  if (marker === 0xfe) return false
  // APP0 JFIF / JFXX — keep
  if (marker === 0xe0) return true
  // APP14 Adobe — keep (YCbCr/RGB transform)
  if (marker === 0xee) return true
  // APP1 EXIF / XMP — drop
  if (marker === 0xe1) return false
  // APP13 Photoshop / IPTC — drop
  if (marker === 0xed) return false
  // APP2: keep only ICC when requested; drop MPF / other
  if (marker === 0xe2) {
    return keepIcc && asciiAt(data, payloadStart, 'ICC_PROFILE\u0000')
  }
  // Other APPn — drop
  if (marker >= 0xe0 && marker <= 0xef) return false
  // DHT, DQT, SOF, DRI, etc. — keep
  return true
}

/**
 * Strip privacy/metadata segments from a JPEG without touching entropy-coded image data.
 * @throws if buffer is not a JPEG or is truncated
 */
export function stripJpegSegments(input: Uint8Array, options: JpegStripOptions): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) {
    throw new Error('Not a JPEG')
  }

  const parts: Uint8Array[] = [input.subarray(0, 2)]
  let i = 2

  while (i < input.length) {
    if (input[i] !== 0xff) {
      // Entropy-coded region without SOS (malformed) — copy remainder
      parts.push(input.subarray(i))
      break
    }

    // Skip fill bytes 0xFF
    while (i + 1 < input.length && input[i] === 0xff && input[i + 1] === 0xff) i++

    if (i + 1 >= input.length) break
    const marker = input[i + 1]

    // SOS: copy rest of file (scan + EOI) verbatim
    if (marker === 0xda) {
      parts.push(input.subarray(i))
      break
    }
    // EOI alone
    if (marker === 0xd9) {
      parts.push(input.subarray(i, i + 2))
      break
    }
    // Standalone markers (RST0–7, TEM)
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      parts.push(input.subarray(i, i + 2))
      i += 2
      continue
    }

    if (i + 3 >= input.length) throw new Error('Truncated JPEG segment header')
    const len = (input[i + 2] << 8) | input[i + 3]
    if (len < 2) throw new Error('Invalid JPEG segment length')
    const segEnd = i + 2 + len
    if (segEnd > input.length) throw new Error('Truncated JPEG segment')

    const payloadStart = i + 4
    if (shouldKeepSegment(marker, input, payloadStart, options.keepIcc)) {
      parts.push(input.subarray(i, segEnd))
    }
    i = segEnd
  }

  let total = 0
  for (const p of parts) total += p.length
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
