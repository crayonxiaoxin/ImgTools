import type Vips from 'wasm-vips'

let _vips: typeof Vips | null = null
let _ready = false
let _error: string | null = null
let _listeners: Array<(ready: boolean, error: string | null) => void> = []

export function onVipsReady(callback: (ready: boolean, error: string | null) => void): () => void {
  _listeners.push(callback)
  if (_ready || _error) callback(_ready, _error)
  return () => { _listeners = _listeners.filter(l => l !== callback) }
}

export async function initVips(): Promise<typeof Vips> {
  if (_vips) return _vips
  try {
    const mod = await import('wasm-vips')
    _vips = await mod.default()
    _ready = true
    _error = null
    _listeners.forEach(l => l(true, null))
    return _vips
  } catch (e: any) {
    _error = e.message ?? 'Failed to load wasm-vips'
    _ready = false
    _listeners.forEach(l => l(false, _error))
    throw e
  }
}

export function isVipsReady(): boolean {
  return _ready
}

export function getVipsError(): string | null {
  return _error
}
