import { describe, it, expect } from 'vitest'
import { stripJpegSegments } from './jpegStrip'

/** Minimal JPEG: SOI + APP1(fake EXIF) + APP0 + COM + SOS stub + EOI */
function buildFixture(): Uint8Array {
  const soi = [0xff, 0xd8]
  const app1 = [0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]
  const app0 = [0xff, 0xe0, 0x00, 0x07, 0x4a, 0x46, 0x49, 0x46, 0x00]
  const com = [0xff, 0xfe, 0x00, 0x05, 0x68, 0x69, 0x00]
  const sos = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xaa, 0xbb, 0xff, 0xd9]
  return Uint8Array.from([...soi, ...app1, ...app0, ...com, ...sos])
}

describe('stripJpegSegments', () => {
  it('removes APP1 and COM but keeps APP0 and scan data', () => {
    const input = buildFixture()
    const out = stripJpegSegments(input, { keepIcc: true })
    expect(out[0]).toBe(0xff)
    expect(out[1]).toBe(0xd8)
    const text = String.fromCharCode(...out)
    expect(text.includes('Exif')).toBe(false)
    expect(text.includes('hi')).toBe(false)
    expect(text.includes('JFIF')).toBe(true)
    expect([...out].includes(0xaa)).toBe(true)
    expect([...out].includes(0xbb)).toBe(true)
    expect(out.length).toBeLessThan(input.length)
  })

  it('throws on non-jpeg', () => {
    expect(() => stripJpegSegments(new Uint8Array([0, 1, 2]), { keepIcc: true })).toThrow(/Not a JPEG/)
  })
})