import type Vips from 'wasm-vips'

let _vips: typeof Vips | null = null
let _ready = false
let _error: string | null = null
let _listeners: Array<(ready: boolean, error: string | null) => void> = []
let _initPromise: Promise<typeof Vips> | null = null

export function onVipsReady(callback: (ready: boolean, error: string | null) => void): () => void {
  _listeners.push(callback)
  if (_ready || _error) callback(_ready, _error)
  return () => { _listeners = _listeners.filter(l => l !== callback) }
}

export async function initVips(timeoutMs = 30000): Promise<typeof Vips> {
  if (_initPromise) return _initPromise

  _initPromise = (async () => {
    console.log('[vips] Starting WASM init...')
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('WASM engine load timeout (30s)')), timeoutMs)
    })
    try {
      console.log('[vips] Importing wasm-vips module...')
      const mod = await Promise.race([
        import('wasm-vips'),
        timeoutPromise,
      ]) as typeof import('wasm-vips')
      console.log('[vips] Module loaded, calling default()...')
      _vips = await mod.default()
      console.log('[vips] WASM engine ready!')
      _ready = true
      _error = null
      _listeners.forEach(l => l(true, null))
      return _vips
    } catch (e: unknown) {
      _error = e instanceof Error ? e.message : String(e)
      console.error('[vips] Init failed:', _error)
      _ready = false
      _listeners.forEach(l => l(false, _error))
      throw e
    }
  })()
  return _initPromise
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
  _listeners = []
  _initPromise = null
}
