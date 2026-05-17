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

export async function initVips(): Promise<typeof Vips> {
  if (_initPromise) return _initPromise
  _initPromise = (async () => {
    try {
      const mod = await import('wasm-vips')
      _vips = await mod.default({ workaroundCors: true })
      _ready = true
      _error = null
      _listeners.forEach(l => l(true, null))
      return _vips
    } catch (e: unknown) {
      _error = e instanceof Error ? e.message : String(e)
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
