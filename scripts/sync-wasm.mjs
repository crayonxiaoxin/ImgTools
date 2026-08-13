#!/usr/bin/env node
/**
 * Copy wasm-vips binaries into public/assets so Vite serves them as
 * stable same-origin URLs (independent of hashed JS chunk location).
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'node_modules', 'wasm-vips', 'lib')
const destDir = join(root, 'public', 'assets')

const files = [
  'vips.wasm',
  'vips-heif.wasm',
  'vips-resvg.wasm',
]

if (!existsSync(srcDir)) {
  console.warn('[sync-wasm] wasm-vips not installed, skip')
  process.exit(0)
}

mkdirSync(destDir, { recursive: true })

for (const file of files) {
  const from = join(srcDir, file)
  const to = join(destDir, file)
  if (!existsSync(from)) {
    console.warn(`[sync-wasm] missing ${file}, skip`)
    continue
  }
  copyFileSync(from, to)
  console.log(`[sync-wasm] ${file}`)
}
