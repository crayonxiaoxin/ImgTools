type VipsNamespace = any

let _vips: VipsNamespace | null = null
let _ready = false
let _error: string | null = null
let _listeners: Array<(ready: boolean, error: string | null) => void> = []
let _initPromise: Promise<VipsNamespace> | null = null

/** Stable same-origin URLs under public/assets (synced from node_modules/wasm-vips). */
const WASM_ASSET_BASE = `${import.meta.env.BASE_URL}assets/`

/**
 * Dynamic modules actually needed by supported formats:
 * - heif → AVIF (and HEIF)
 * - resvg → SVG
 * JXL is omitted (~2.2MB) — not in the app format matrix.
 */
const DYNAMIC_LIBRARIES = ['vips-heif.wasm', 'vips-resvg.wasm'] as const

function locateVipsFile(fileName: string): string {
  return `${WASM_ASSET_BASE}${fileName}`
}

/** Kick off parallel browser fetches before Emscripten starts sequential loads. */
function preloadWasmAssets(): void {
  if (typeof document === 'undefined') return
  const files = ['vips.wasm', ...DYNAMIC_LIBRARIES]
  for (const file of files) {
    const href = locateVipsFile(file)
    if (document.querySelector(`link[data-vips-preload="${file}"]`)) continue
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'fetch'
    link.href = href
    link.crossOrigin = 'anonymous'
    link.dataset.vipsPreload = file
    document.head.appendChild(link)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function onVipsReady(callback: (ready: boolean, error: string | null) => void): () => void {
  _listeners.push(callback)
  if (_ready || _error) callback(_ready, _error)
  return () => { _listeners = _listeners.filter(l => l !== callback) }
}

export async function initVips(timeoutMs = 60000): Promise<VipsNamespace> {
  if (_vips && _ready) return _vips
  if (_initPromise) return _initPromise

  _error = null
  _initPromise = (async () => {
    console.log('[vips] Starting WASM init...', { assetBase: WASM_ASSET_BASE })
    preloadWasmAssets()
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`WASM engine load timeout (${Math.round(timeoutMs / 1000)}s)`)), timeoutMs)
    })
    try {
      console.log('[vips] Importing wasm-vips module...')
      const result = await Promise.race([
        import('wasm-vips').then(m => (m as any).default({
          // Force all binaries (main + dynamic) onto local /assets paths
          locateFile: locateVipsFile,
          dynamicLibraries: [...DYNAMIC_LIBRARIES],
        })),
        timeoutPromise,
      ])
      console.log('[vips] WASM engine ready!')
      _vips = result
      _ready = true
      _error = null
      _listeners.forEach(l => l(true, null))
      return _vips
    } catch (e: unknown) {
      _error = e instanceof Error ? e.message : String(e)
      console.error('[vips] Init failed:', _error)
      _ready = false
      _vips = null
      // Allow subsequent initVips() / retries to start a fresh attempt
      _initPromise = null
      _listeners.forEach(l => l(false, _error))
      throw e
    }
  })()

  return _initPromise
}

export interface VipsRetryOptions {
  timeoutMs?: number
  maxAttempts?: number
  /** Base delay between attempts; grows linearly with attempt index */
  delayMs?: number
  onAttempt?: (info: { attempt: number; maxAttempts: number; error?: string | null }) => void
}

/**
 * Initialize wasm-vips with automatic retries after timeout/failure.
 */
export async function initVipsWithRetry(options: VipsRetryOptions = {}): Promise<VipsNamespace> {
  const timeoutMs = options.timeoutMs ?? 60000
  const maxAttempts = options.maxAttempts ?? 3
  const delayMs = options.delayMs ?? 2000

  if (_vips && _ready) return _vips

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    options.onAttempt?.({ attempt, maxAttempts, error: null })
    try {
      return await initVips(timeoutMs)
    } catch (e: unknown) {
      lastError = e
      const message = e instanceof Error ? e.message : String(e)
      options.onAttempt?.({ attempt, maxAttempts, error: message })
      if (attempt < maxAttempts) {
        await sleep(delayMs * attempt)
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export function isVipsReady(): boolean {
  return _ready
}

export function getVipsError(): string | null {
  return _error
}

export function resetVips(): void {
  _vips = null
  _ready = false
  _error = null
  _initPromise = null
}
