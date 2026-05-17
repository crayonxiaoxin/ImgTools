import { initVips } from './vips'

let pdfjs: any = null

async function getPdfJs() {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = ''
  }
  return pdfjs
}

export interface PdfPageResult {
  data: Uint8Array
  width: number
  height: number
  pageIndex: number
}

export interface PdfOutput {
  pages: PdfPageResult[]
  totalPages: number
}

/**
 * Render PDF pages at given scale, return raw RGBA pixel data per page.
 */
async function renderPages(
  arrayBuffer: ArrayBuffer,
  scale: number,
  pageRange?: [number, number],
): Promise<{ width: number; height: number; pixels: Uint8ClampedArray }[]> {
  const pdfjs = await getPdfJs()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer.slice(0) }).promise
  const totalPages = pdf.numPages
  const range: [number, number] = pageRange ?? [1, totalPages]
  const start = Math.max(1, range[0])
  const end = Math.min(totalPages, range[1])

  const results: { width: number; height: number; pixels: Uint8ClampedArray }[] = []

  for (let i = start; i <= end; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = new OffscreenCanvas(viewport.width, viewport.height)
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    const imageData = ctx.getImageData(0, 0, viewport.width, viewport.height)
    results.push({ width: viewport.width, height: viewport.height, pixels: imageData.data })
    page.cleanup()
  }

  return results
}

/**
 * Convert a rendered page to image via wasm-vips.
 */
async function pageToImage(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  format: 'png' | 'jpeg' | 'webp',
  quality: number,
): Promise<Uint8Array> {
  const v = await initVips()
  const img = v.Image.newFromMemory(new Uint8Array(pixels), width, height, 4, 'uchar')

  const flatten = img.flatten ? img.flatten({ background: [255, 255, 255] }) : img

  switch (format) {
    case 'png':
      return flatten.pngsaveBuffer()
    case 'jpeg':
      return flatten.jpegsaveBuffer({ Q: quality })
    case 'webp':
      return flatten.webpsaveBuffer({ Q: quality })
  }
}

/**
 * Generate long image by vertically concatenating all pages.
 */
async function generateLongImage(
  renderedPages: { width: number; height: number; pixels: Uint8ClampedArray }[],
  format: 'png' | 'jpeg' | 'webp',
  quality: number,
): Promise<Uint8Array> {
  const v = await initVips()
  const images = await Promise.all(
    renderedPages.map(async (p) => {
      const img = v.Image.newFromMemory(new Uint8Array(p.pixels), p.width, p.height, 4, 'uchar')
      return img.flatten ? img.flatten({ background: [255, 255, 255] }) : img
    }),
  )

  // Find max width and pad narrower pages
  const maxW = Math.max(...images.map((img: any) => img.width))
  const padded = images.map((img: any) => {
    if (img.width < maxW) {
      const bg = v.Image.black(maxW, img.height)
        .cast('uchar')
        .bandjoin(255)
      return bg.insert(img, Math.round((maxW - img.width) / 2), 0)
    }
    return img
  })

  const joined = padded.reduce((acc: any, img: any) => {
    if (!acc) return img
    return acc.join(img, 'vertical')
  }, null)

  switch (format) {
    case 'png':
      return joined.pngsaveBuffer()
    case 'jpeg':
      return joined.jpegsaveBuffer({ Q: quality })
    case 'webp':
      return joined.webpsaveBuffer({ Q: quality })
  }
}

export interface PdfProcessOptions {
  scale: number
  format: 'png' | 'jpeg' | 'webp'
  quality: number
  mode: 'long' | 'pages'
  pageRange?: [number, number]
}

export interface PdfProcessResult {
  pages: PdfPageResult[]
  totalPages: number
}

export async function processPdf(
  arrayBuffer: ArrayBuffer,
  options: PdfProcessOptions,
): Promise<PdfProcessResult> {
  const rendered = await renderPages(arrayBuffer, options.scale, options.pageRange)

  if (options.mode === 'long') {
    const data = await generateLongImage(rendered, options.format, options.quality)
    return {
      pages: [{ data, width: rendered[0].width, height: data.length, pageIndex: 0 }],
      totalPages: rendered.length,
    }
  }

  const pages = await Promise.all(
    rendered.map(async (r, i) => {
      const data = await pageToImage(r.pixels, r.width, r.height, options.format, options.quality)
      return { data, width: r.width, height: r.height, pageIndex: i + 1 }
    }),
  )

  return { pages, totalPages: rendered.length }
}
