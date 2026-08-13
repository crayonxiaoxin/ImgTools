import { describe, it, expect } from 'vitest'
import { mapVipsFieldsToMeta, cleanVipsExifString } from './strip'

describe('cleanVipsExifString', () => {
  it('strips libvips ASCII decoration', () => {
    expect(cleanVipsExifString('TestCam (TestCam, ASCII, 8 components, 8 bytes)')).toBe('TestCam')
    expect(cleanVipsExifString('plain')).toBe('plain')
  })
})

describe('mapVipsFieldsToMeta', () => {
  it('maps camera/datetime to exif and collapses gps', () => {
    const fields = mapVipsFieldsToMeta(
      [
        'exif-ifd0-Make',
        'exif-ifd0-Model',
        'exif-ifd0-DateTime',
        'exif-ifd3-GPSLatitude',
        'exif-ifd3-GPSLongitude',
        'icc-profile',
        'png-comment',
        'vips-loader',
      ],
      (name) => {
        const values: Record<string, string> = {
          'exif-ifd0-Make': 'Apple',
          'exif-ifd0-Model': 'iPhone',
          'exif-ifd0-DateTime': '2024:01:02 03:04:05',
          'exif-ifd3-GPSLatitude': '1/1',
          'exif-ifd3-GPSLongitude': '2/1',
          'png-comment': 'hello',
        }
        return values[name]
      },
    )

    expect(fields.find(f => f.key === 'exif:Make')?.value).toBe('Apple')
    expect(fields.find(f => f.key === 'exif:Model')?.value).toBe('iPhone')
    expect(fields.find(f => f.key === 'exif:DateTime')?.value).toContain('2024')
    const gps = fields.find(f => f.key === 'gps')
    expect(gps?.sensitive).toBe(true)
    expect(gps?.value).toMatch(/1|2/) // detail string available but UI collapses
    expect(fields.find(f => f.key === 'icc')?.group).toBe('icc')
    expect(fields.find(f => f.key === 'other:png-comment')?.value).toBe('hello')
    expect(fields.some(f => f.key.includes('vips-loader'))).toBe(false)
  })

  it('returns empty array when no user-facing metadata', () => {
    expect(mapVipsFieldsToMeta(['vips-loader', 'width'], () => undefined)).toEqual([])
  })
})
