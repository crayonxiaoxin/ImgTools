type VipsNamespace = Awaited<ReturnType<typeof importVips>>

async function importVips(config?: { workaroundCors?: boolean }): Promise<any> {
  const mod: any = await import('wasm-vips')
  return await mod.default(config)
}

let _vips: VipsNamespace | null = null
let _ready = false
let _error: string | null = null
let _listeners: Array<(ready: boolean, error: string | null) => void> = []
let _initPromise: Promise<VipsNamespace> | null = null

export function onVipsReady(callback: (ready: boolean, error: string | null) => void): () => void {
  _listeners.push(callback)
  if (_ready || _error) callback(_ready, _error)
  return () => { _listeners = _listeners.filter(l => l !== callback) }
}

export async function initVips(timeoutMs = 30000): Promise<VipsNamespace> {
  if (_initPromise) return _initPromise

  _initPromise = (async () => {
    console.log('[vips] Starting WASM init...')
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('WASM engine load timeout (30s)')), timeoutMs)
    })
    try {
      console.log('[vips] Importing wasm-vips module...')
      const result = await Promise.race([
        import('wasm-vips').then(m => (m as any).default()),
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
