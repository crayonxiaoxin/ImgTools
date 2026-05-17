export function createIco(pngs: Uint8Array[], sizes: number[]): Uint8Array {
  const count = pngs.length
  const headerSize = 6
  const entrySize = 16
  const dirSize = headerSize + count * entrySize

  let offset = dirSize
  const offsets: number[] = []
  for (const png of pngs) {
    offsets.push(offset)
    offset += png.length
  }

  const buf = new Uint8Array(offset)
  const dv = new DataView(buf.buffer)

  // ICO header
  dv.setUint16(0, 0, true)
  dv.setUint16(2, 1, true)
  dv.setUint16(4, count, true)

  for (let i = 0; i < count; i++) {
    const s = sizes[i]
    const base = headerSize + i * entrySize

    dv.setUint8(base + 0, s > 255 ? 0 : s)  // width (0 = 256)
    dv.setUint8(base + 1, s > 255 ? 0 : s)  // height
    dv.setUint8(base + 2, 0)                 // color count
    dv.setUint8(base + 3, 0)                 // reserved
    dv.setUint16(base + 4, 1, true)          // planes
    dv.setUint16(base + 6, 32, true)         // bit count
    dv.setUint32(base + 8, pngs[i].length, true)
    dv.setUint32(base + 12, offsets[i], true)

    buf.set(pngs[i], offsets[i])
  }

  return buf
}
