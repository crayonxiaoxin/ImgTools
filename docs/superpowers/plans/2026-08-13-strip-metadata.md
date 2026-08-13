# Strip Metadata Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/strip` mode that removes privacy-sensitive image metadata in-browser and shows before/after metadata in the batch list.

**Architecture:** Reuse compress/convert shell (DropZone + ParamPanel + BatchList). Add `src/core/strip.ts` for extract/strip via wasm-vips (`autorot` + encode with `ForeignKeep`). Store holds `stripConfig`, `metaBefore`/`metaAfter` per image; scan metadata async on add; process path writes cleaned files and refreshes after-meta.

**Tech Stack:** Vue 3 + Pinia + vue-i18n + vue-router + wasm-vips 0.0.17; Vitest for pure field-mapping unit tests.

## Global Constraints

- Client-only; keep COOP/COEP unchanged.
- No auto-process on drop.
- Default: strip EXIF/XMP/IPTC/other; **keep ICC** unless `removeIcc` is true.
- Always `autorot` before encode.
- Same output format when writable; else PNG.
- v1 unsupported: `svg`, `pdf`, `gif`.
- Update all three locales (`zh-CN`, `zh-TW`, `en`) for new UI strings.
- Revoke object URLs on replace/clear/mode switch as existing code does.

## File Structure

```
src/
├── core/
│   └── strip.ts                 — NEW: extractMetadata, stripMetadata, mapVipsFieldsToMeta
├── stores/
│   └── imageStore.ts            — AppMode += strip; MetaField; stripConfig; meta fields; setMode reset
├── composables/
│   └── useImageProcessor.ts     — strip branch + unsupported format errors
├── components/
│   ├── Sidebar.vue              — strip nav item
│   ├── ParamPanel.vue           — strip params (removeIcc toggle)
│   └── BatchList.vue            — expandable before/after meta panel
├── views/
│   └── ModePage.vue             — strip uses compress/convert layout (no change if already in v-else)
├── router.ts                    — /strip route
└── locales/{zh-CN,zh-TW,en}.ts  — strip + batch meta strings
```

Optional test:
```
src/core/stripFields.test.ts    — unit tests for mapVipsFieldsToMeta (no WASM)
```

---

### Task 1: Types + store scaffolding

**Files:**
- Modify: `src/stores/imageStore.ts`

**Interfaces:**
- Produces:
  - `export type AppMode = 'compress' | 'convert' | 'favicon' | 'pdf' | 'strip'`
  - `export type MetaGroup = 'exif' | 'xmp' | 'iptc' | 'icc' | 'other'`
  - `export interface MetaField { key: string; labelKey: string; value?: string; group: MetaGroup; sensitive?: boolean }`
  - `ImageItem.metaBefore?: MetaField[]`
  - `ImageItem.metaAfter?: MetaField[]`
  - `stripConfig: Ref<{ removeIcc: boolean }>` default `{ removeIcc: false }`
  - `setMetaBefore(id, fields)`, `setMetaAfter(id, fields)`, `setStripConfig(partial)`

- [ ] **Step 1: Add types and stripConfig to the store**

In `src/stores/imageStore.ts`, add exports and extend `ImageItem` / store API:

```ts
export type MetaGroup = 'exif' | 'xmp' | 'iptc' | 'icc' | 'other'

export interface MetaField {
  key: string
  /** i18n key under `strip.fields.*` or a literal fallback label key */
  labelKey: string
  value?: string
  group: MetaGroup
  sensitive?: boolean
}

export type AppMode = 'compress' | 'convert' | 'favicon' | 'pdf' | 'strip'

export interface ImageItem {
  // ...existing fields
  metaBefore?: MetaField[]
  metaAfter?: MetaField[]
}
```

Inside the store:

```ts
const stripConfig = ref({ removeIcc: false })

function setStripConfig(partial: Partial<{ removeIcc: boolean }>) {
  Object.assign(stripConfig.value, partial)
}

function setMetaBefore(id: string, fields: MetaField[]) {
  const item = images.value.find(i => i.id === id)
  if (item) item.metaBefore = fields
}

function setMetaAfter(id: string, fields: MetaField[]) {
  const item = images.value.find(i => i.id === id)
  if (item) item.metaAfter = fields
}
```

In `setMode`, clear meta and reset stripConfig when leaving/entering:

```ts
item.metaBefore = undefined
item.metaAfter = undefined
// ...existing result clears
stripConfig.value = { removeIcc: false }
```

Export the new state/functions from the store return object.

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc --noEmit`  
Expected: PASS (or only pre-existing unrelated errors).

- [ ] **Step 3: Commit**

```bash
git add src/stores/imageStore.ts
git commit -m "feat(strip): extend store with meta fields and stripConfig"
```

---

### Task 2: Core strip module + field mapper tests

**Files:**
- Create: `src/core/strip.ts`
- Create: `src/core/stripFields.test.ts`
- Modify: `package.json` (add `vitest` + `"test": "vitest run"`)

**Interfaces:**
- Consumes: `initVips` from `src/core/vips.ts`; `ImageFormat` from `src/core/formats.ts`; `MetaField` from store (prefer defining `MetaField` in `strip.ts` and re-exporting from store **or** define in `strip.ts` and import in store — pick one: **define `MetaField` in `src/core/strip.ts`, import into store** to avoid circular deps).
- Produces:
  - `export function mapVipsFieldsToMeta(fieldNames: string[], read: (name: string) => string | undefined): MetaField[]`
  - `export async function extractMetadata(buffer: ArrayBuffer): Promise<MetaField[]>`
  - `export async function stripMetadata(buffer: ArrayBuffer, options: { removeIcc: boolean; format: ImageFormat }): Promise<{ data: Uint8Array; format: string; width: number; height: number; metaAfter: MetaField[] }>`
  - `export const STRIP_UNSUPPORTED: ReadonlySet<ImageFormat>` = `svg|pdf|gif`

**Note:** If Task 1 already put `MetaField` in the store, move the type into `strip.ts` in this task and update the store import — do not leave duplicate type definitions.

- [ ] **Step 1: Add Vitest**

```bash
npm install -D vitest
```

Add to `package.json` scripts: `"test": "vitest run"`.

Add minimal `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 2: Write failing tests for `mapVipsFieldsToMeta`**

Create `src/core/stripFields.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mapVipsFieldsToMeta } from './strip'

describe('mapVipsFieldsToMeta', () => {
  it('groups exif, gps, icc and marks gps sensitive', () => {
    const fields = mapVipsFieldsToMeta(
      ['exif-data', 'exif-ifd0-Orientation', 'icc-profile', 'png-comment', 'vips-loader'],
      (name) => {
        if (name.includes('Orientation')) return '6'
        if (name === 'png-comment') return 'hello'
        return '1'
      },
    )
    const keys = fields.map(f => f.key)
    expect(keys).toContain('gps') // only if a gps-* field present — adjust fixture:
  })
})
```

Replace the first test with a concrete fixture that matches the mapper rules you will implement:

```ts
import { describe, it, expect } from 'vitest'
import { mapVipsFieldsToMeta } from './strip'

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
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `npm test`  
Expected: FAIL (module or function missing).

- [ ] **Step 4: Implement `src/core/strip.ts`**

```ts
import { initVips } from './vips'
import type { ImageFormat } from './formats'
import { FORMATS } from './formats'

export type MetaGroup = 'exif' | 'xmp' | 'iptc' | 'icc' | 'other'

export interface MetaField {
  key: string
  labelKey: string
  value?: string
  group: MetaGroup
  sensitive?: boolean
}

export const STRIP_UNSUPPORTED = new Set<ImageFormat>(['svg', 'pdf', 'gif'])

const IGNORE_FIELDS = new Set([
  'vips-loader', 'width', 'height', 'bands', 'format', 'coding',
  'interpretation', 'xoffset', 'yoffset', 'xres', 'yres',
])

function classify(name: string): MetaGroup | null {
  const n = name.toLowerCase()
  if (IGNORE_FIELDS.has(n) || n.startsWith('vips-')) return null
  if (n.includes('icc')) return 'icc'
  if (n.includes('gps')) return 'exif' // collapsed later into gps key
  if (n.includes('exif')) return 'exif'
  if (n.includes('xmp')) return 'xmp'
  if (n.includes('iptc')) return 'iptc'
  if (n.includes('comment') || n.includes('description')) return 'other'
  return null
}

export function mapVipsFieldsToMeta(
  fieldNames: string[],
  read: (name: string) => string | undefined,
): MetaField[] {
  const out: MetaField[] = []
  const gpsParts: string[] = []
  let hasIcc = false

  for (const name of fieldNames) {
    const group = classify(name)
    if (!group) continue
    const lower = name.toLowerCase()
    if (lower.includes('icc')) {
      hasIcc = true
      continue
    }
    if (lower.includes('gps')) {
      const v = read(name)
      if (v) gpsParts.push(`${name}=${v}`)
      else gpsParts.push(name)
      continue
    }
    // curated exif keys
    const short = name.replace(/^exif-ifd\d+-/i, '').replace(/^exif-/i, '')
    if (group === 'exif') {
      const interesting = ['Make', 'Model', 'DateTime', 'DateTimeOriginal', 'Software', 'Orientation', 'Artist', 'Copyright']
      if (!interesting.some(k => short === k || short.endsWith(k))) continue
      out.push({
        key: `exif:${short}`,
        labelKey: `strip.fields.${short}`,
        value: read(name),
        group: 'exif',
      })
      continue
    }
    if (group === 'xmp') {
      out.push({ key: 'xmp', labelKey: 'strip.fields.xmp', group: 'xmp' })
      continue
    }
    if (group === 'iptc') {
      out.push({ key: 'iptc', labelKey: 'strip.fields.iptc', group: 'iptc' })
      continue
    }
    if (group === 'other') {
      out.push({
        key: `other:${name}`,
        labelKey: 'strip.fields.comment',
        value: read(name),
        group: 'other',
      })
    }
  }

  if (gpsParts.length) {
    out.push({
      key: 'gps',
      labelKey: 'strip.fields.gps',
      value: gpsParts.join('; '),
      group: 'exif',
      sensitive: true,
    })
  }
  if (hasIcc) {
    out.push({ key: 'icc', labelKey: 'strip.fields.icc', group: 'icc' })
  }

  // dedupe by key
  const seen = new Set<string>()
  return out.filter(f => (seen.has(f.key) ? false : (seen.add(f.key), true)))
}

function fieldsFromImage(image: any): MetaField[] {
  const names: string[] = []
  const vector = image.getFields()
  const n = typeof vector.size === 'function' ? vector.size() : vector.length
  for (let i = 0; i < n; i++) {
    names.push(typeof vector.get === 'function' ? vector.get(i) : vector[i])
  }
  return mapVipsFieldsToMeta(names, (name) => {
    try {
      if (image.getType(name) === 0) return undefined
      return String(image.getString(name))
    } catch {
      return undefined
    }
  })
}

export async function extractMetadata(buffer: ArrayBuffer): Promise<MetaField[]> {
  const v = await initVips()
  const image = v.Image.newFromBuffer(new Uint8Array(buffer))
  try {
    return fieldsFromImage(image)
  } finally {
    image.delete?.()
  }
}

export async function stripMetadata(
  buffer: ArrayBuffer,
  options: { removeIcc: boolean; format: ImageFormat },
): Promise<{ data: Uint8Array; format: string; width: number; height: number; metaAfter: MetaField[] }> {
  if (STRIP_UNSUPPORTED.has(options.format) || !FORMATS[options.format]?.writable) {
    throw new Error(`Unsupported format for strip: ${options.format}`)
  }

  const v = await initVips()
  let image = v.Image.newFromBuffer(new Uint8Array(buffer))
  try {
    // Apply EXIF orientation into pixels, then strip orientation tag via re-encode keep flags
    image = image.autorot()

    const extMap: Record<string, string> = {
      jpeg: '.jpg',
      png: '.png',
      webp: '.webp',
      avif: '.avif',
      bmp: '.bmp',
      tiff: '.tiff',
    }
    const ext = extMap[options.format]
    const keep = options.removeIcc ? 'none' : 'icc'
    // High fidelity — not a compressor
    const qualityOpts =
      options.format === 'png' || options.format === 'bmp' || options.format === 'tiff'
        ? `keep=${keep}`
        : `Q=95,keep=${keep}`

    const data: Uint8Array = image.writeToBuffer(`${ext}[${qualityOpts}]`)
    const metaAfter = await extractMetadata(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
    return {
      data,
      format: options.format,
      width: image.width,
      height: image.height,
      metaAfter,
    }
  } finally {
    image.delete?.()
  }
}
```

Adjust `getFields` iteration if the Vector API differs at runtime (check with a quick console in browser if needed). Prefer copying buffer for `extractMetadata` on result:

```ts
const copy = new Uint8Array(data)
const metaAfter = await extractMetadata(copy.buffer)
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `npm test`  
Expected: all tests PASS. Update mapper/fixtures if real vips field names differ once you smoke-test one JPEG in the browser (document actual names in a comment in `strip.ts`).

- [ ] **Step 6: Update store to import `MetaField` from `@/core/strip`**

Remove duplicate interface from store if present; import type instead.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/core/strip.ts src/core/stripFields.test.ts src/stores/imageStore.ts
git commit -m "feat(strip): add metadata extract/strip core and field mapper tests"
```

---

### Task 3: Routing, sidebar, i18n

**Files:**
- Modify: `src/router.ts`
- Modify: `src/components/Sidebar.vue`
- Modify: `src/locales/zh-CN.ts`
- Modify: `src/locales/zh-TW.ts`
- Modify: `src/locales/en.ts`

**Interfaces:**
- Consumes: `AppMode` including `'strip'`
- Produces: route name `strip`; locale keys listed below

- [ ] **Step 1: Add route**

In `src/router.ts`:

```ts
{ path: '/strip', name: 'strip', component: () => import('@/views/ModePage.vue') },
```

- [ ] **Step 2: Add sidebar item after PDF**

Use a shield-style stroke icon consistent with neighbors:

```vue
<button
  type="button"
  class="mode-item"
  :class="{ active: store.activeMode === 'strip' }"
  @click="switchMode('strip')"
>
  <svg class="mode-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
  <span>{{ t('sidebar.strip') }}</span>
</button>
```

Also add the same button in the mobile bottom-nav section of `Sidebar.vue` if one exists (mirror compress/pdf entries).

- [ ] **Step 3: Add locale strings (all three files)**

`zh-CN`:

```ts
sidebar: {
  // existing...
  strip: '去元数据',
},
strip: {
  desc: '清除照片中的位置、拍摄设备与时间等隐私信息，全部在本地完成。',
  removeIcc: '同时移除 ICC 色彩配置',
  removeIccHint: '默认保留 ICC，避免颜色偏移；仅在需要彻底清理时开启。',
  meta: '元数据',
  before: '清理前',
  after: '清理后',
  none: '未检测到可清除的元数据',
  unread: '无法读取元数据',
  cleared: '已清除 {n} 项',
  gpsYes: '含 GPS',
  showGps: '显示坐标',
  hideGps: '隐藏坐标',
  unsupported: '该格式暂不支持去元数据',
  fields: {
    Make: '相机制造商',
    Model: '相机型号',
    DateTime: '时间',
    DateTimeOriginal: '拍摄时间',
    Software: '软件',
    Orientation: '方向',
    Artist: '作者',
    Copyright: '版权',
    gps: 'GPS',
    icc: 'ICC 色彩配置',
    xmp: 'XMP',
    iptc: 'IPTC',
    comment: '注释',
  },
},
```

`zh-TW`: `strip: '去除中繼資料'` + Traditional translations of the block.  
`en`: `strip: 'Strip metadata'` + English block (`Remove GPS, camera, and timestamps locally.` etc.).

- [ ] **Step 4: Smoke navigate**

Run: `npm run dev` → open `/strip` → sidebar highlights Strip.  
Expected: page shows DropZone + ParamPanel + BatchList (ParamPanel strip UI may still be empty until Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/router.ts src/components/Sidebar.vue src/locales/zh-CN.ts src/locales/zh-TW.ts src/locales/en.ts
git commit -m "feat(strip): add route, sidebar entry, and i18n strings"
```

---

### Task 4: ParamPanel strip controls

**Files:**
- Modify: `src/components/ParamPanel.vue`

**Interfaces:**
- Consumes: `store.stripConfig`, `store.setStripConfig`
- Produces: UI toggle bound to `removeIcc`

- [ ] **Step 1: Add strip template branch**

After the convert template block, add:

```vue
<template v-if="store.activeMode === 'strip'">
  <p class="hint">{{ t('strip.desc') }}</p>
  <label class="check-row">
    <input
      type="checkbox"
      :checked="store.stripConfig.removeIcc"
      @change="store.setStripConfig({ removeIcc: ($event.target as HTMLInputElement).checked })"
    />
    <span>{{ t('strip.removeIcc') }}</span>
  </label>
  <p class="hint muted">{{ t('strip.removeIccHint') }}</p>
</template>
```

Reuse existing ParamPanel class names (`hint`, checkbox row styles). If no checkbox row style exists, add minimal scoped CSS matching current toggle/checkbox patterns in the same file.

- [ ] **Step 2: Visual check**

On `/strip`, param panel shows description + ICC checkbox (unchecked by default). Compress/convert panels unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/components/ParamPanel.vue
git commit -m "feat(strip): add ParamPanel removeIcc control"
```

---

### Task 5: Processor + async meta scan on add

**Files:**
- Modify: `src/composables/useImageProcessor.ts`
- Modify: `src/stores/imageStore.ts` (`addImages`)

**Interfaces:**
- Consumes: `extractMetadata`, `stripMetadata`, `STRIP_UNSUPPORTED`
- Produces: processed results with `metaAfter`; `metaBefore` filled after add

- [ ] **Step 1: Scan metadata after add**

In `addImages`, after pushing items, kick off non-blocking scans:

```ts
for (const item of items) {
  if (!item.format || STRIP_UNSUPPORTED.has(item.format)) continue
  void item.file.arrayBuffer()
    .then(buf => extractMetadata(buf))
    .then(fields => {
      const current = images.value.find(i => i.id === item.id)
      if (current && !current.metaBefore) current.metaBefore = fields
    })
    .catch(() => {
      /* leave metaBefore undefined → UI shows unread */
    })
}
```

Import `extractMetadata` / `STRIP_UNSUPPORTED` from `@/core/strip`. Only necessary when mode is strip **or** always scan (cheap enough for typical EXIF). Spec: on add — scanning always is fine and simplifies code; keep it unconditional unless performance issues appear.

- [ ] **Step 2: Branch `processSingle` for strip**

```ts
import { extractMetadata, stripMetadata, STRIP_UNSUPPORTED } from '@/core/strip'
import { FORMATS } from '@/core/formats'

async function processSingle(item: ImageItem): Promise<void> {
  if (item.status === 'processing') return
  item.status = 'processing'
  try {
    const buffer = await item.file.arrayBuffer()

    if (store.activeMode === 'strip') {
      const format = item.format
      if (!format || STRIP_UNSUPPORTED.has(format) || !FORMATS[format].writable) {
        throw new Error('UNSUPPORTED_STRIP') // map to i18n in UI via known code or translate here with i18n if available
      }
      if (!item.metaBefore) {
        try { item.metaBefore = await extractMetadata(buffer) } catch { /* ignore */ }
      }
      const outFormat = FORMATS[format].writable ? format : 'png'
      const result = await stripMetadata(buffer, {
        removeIcc: store.stripConfig.removeIcc,
        format: outFormat,
      })
      const blob = new Blob([result.data as BlobPart], { type: `image/${result.format}` })
      const url = URL.createObjectURL(blob)
      store.setResult(item.id, url, blob.size)
      store.setMetaAfter(item.id, result.metaAfter)
      return
    }

    // existing compress/convert path...
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message === 'UNSUPPORTED_STRIP'
      ? 'unsupported' // BatchList/toast should use t('strip.unsupported') — prefer throwing Error with message from a small helper
      : (e instanceof Error ? e.message : String(e))
    store.setError(item.id, msg)
  }
}
```

Prefer setting the error message already localized by importing `i18n.global.t` **or** store a stable code `strip.unsupported` and let BatchList translate keys that start with `strip.`. Simplest: pass `strip.unsupported` as `errorMessage` and in BatchList `t(item.errorMessage)` when it includes a dot — **better:** resolve with i18n inside the composable:

```ts
import i18n from '@/i18n'
// ...
throw new Error(i18n.global.t('strip.unsupported'))
```

- [ ] **Step 3: Manual process smoke**

Drop a JPEG with EXIF on `/strip`, click Start.  
Expected: status done, downloadable file, `metaAfter` present in Vue devtools.

- [ ] **Step 4: Commit**

```bash
git add src/composables/useImageProcessor.ts src/stores/imageStore.ts
git commit -m "feat(strip): wire processor and async metadata scan on add"
```

---

### Task 6: BatchList before/after metadata UI

**Files:**
- Modify: `src/components/BatchList.vue`

**Interfaces:**
- Consumes: `item.metaBefore`, `item.metaAfter`, strip locale keys
- Produces: expandable meta comparison per row (desktop table + mobile cards)

- [ ] **Step 1: Track expanded rows**

```ts
const expandedMeta = ref<Record<string, boolean>>({})
const revealedGps = ref<Record<string, boolean>>({})

function toggleMeta(id: string) {
  expandedMeta.value[id] = !expandedMeta.value[id]
}
```

- [ ] **Step 2: Add meta toggle + panel in each row**

Only when `store.activeMode === 'strip'`:

```vue
<button type="button" class="link-btn" @click="toggleMeta(item.id)">
  {{ t('strip.meta') }}
</button>

<div v-if="expandedMeta[item.id]" class="meta-compare">
  <div class="meta-col">
    <h4>{{ t('strip.before') }}</h4>
    <MetaList :fields="item.metaBefore" :item-id="item.id" side="before" />
  </div>
  <div class="meta-col">
    <h4>
      {{ t('strip.after') }}
      <span v-if="item.metaAfter && item.metaBefore" class="badge">
        {{ t('strip.cleared', { n: Math.max(0, (item.metaBefore?.length ?? 0) - (item.metaAfter?.length ?? 0)) }) }}
      </span>
    </h4>
    <template v-if="item.status === 'done'">
      <MetaList :fields="item.metaAfter" :item-id="item.id" side="after" />
    </template>
    <p v-else class="hint">—</p>
  </div>
</div>
```

Implement `MetaList` as an inner component in the same file (or inline template) that:

- If `fields` is `undefined` → `t('strip.unread')`
- If `fields.length === 0` → `t('strip.none')`
- Else render rows: `t(field.labelKey)` + value
- For `field.sensitive` (GPS): show `t('strip.gpsYes')` until `revealedGps[itemId]` then show `field.value`
- Truncate long values with CSS + `title` attribute
- Optional: if `side==='before'` and after exists, mute fields whose keys are absent in after

Mirror the same block in the mobile card layout.

- [ ] **Step 3: Style**

Use existing CSS variables (`--border`, `--bg-surface`, `--text-muted`, `--radius-sm`). Two-column grid on desktop; stack on narrow widths. Keep dense but readable — no new card chrome beyond a light bordered panel.

- [ ] **Step 4: UI verify**

Expand meta before process → before list populated. After process → after list shows ICC-only or empty; GPS hidden until reveal.

- [ ] **Step 5: Commit**

```bash
git add src/components/BatchList.vue
git commit -m "feat(strip): show before/after metadata comparison in BatchList"
```

---

### Task 7: DropZone accept + ModePage sanity + docs touch-up

**Files:**
- Modify: `src/components/DropZone.vue` (if accept attribute is mode-specific)
- Modify: `AGENTS.md` only if it lists modes (keep brief: add Strip to four-mode → five-mode note)
- Modify: `docs/superpowers/specs/2026-08-13-strip-metadata-design.md` status → Accepted

**Interfaces:** none new

- [ ] **Step 1: DropZone**

If DropZone uses a fixed `accept=`, ensure strip allows the same raster images as compress (not PDF). If already image-wide, no code change — note that in the commit message.

- [ ] **Step 2: ModePage**

Confirm `v-else` branch already covers strip (favicon/pdf excluded). No structural change expected.

- [ ] **Step 3: Update AGENTS.md mode list**

In the “四模式架构” section, rename to five modes and add one bullet:

```
- **去元数据模式**: 清除 EXIF/GPS/XMP/IPTC（默认保留 ICC），批列表展示清理前后元数据
```

- [ ] **Step 4: Build**

Run: `npm test && npm run build`  
Expected: tests pass; production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/DropZone.vue AGENTS.md docs/superpowers/specs/2026-08-13-strip-metadata-design.md
git commit -m "docs: mark strip mode as fifth app mode"
```

---

### Task 8: Manual verification checklist

**Files:** none (qa only)

- [ ] **Step 1: Run through spec test plan**

1. JPEG with EXIF + GPS → before shows camera/time/GPS; after empty or ICC only.  
2. Enable remove ICC → after has no ICC.  
3. Phone photo Orientation ≠ 1 → upright after strip.  
4. Clean PNG → “未检测到可清除的元数据” + successful export.  
5. Switch mode away/back → results + meta cleared; `removeIcc` reset.  
6. Switch locale CN/TW/EN → sidebar + panel + meta labels translate.  
7. Drop GIF/SVG → row error with unsupported message.

- [ ] **Step 2: Fix any bugs found; commit fixes separately**

```bash
git commit -m "fix(strip): <short bug description>"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Route `/strip` + sidebar | Task 3 |
| ParamPanel removeIcc default off | Task 4 |
| autorot + keep ICC / none | Task 2 |
| Same-format high-fidelity encode | Task 2 |
| metaBefore on add | Task 5 |
| metaAfter on process | Task 5 |
| BatchList before/after + GPS collapse | Task 6 |
| Unsupported gif/svg/pdf | Task 2 + 5 |
| i18n three locales | Task 3 |
| setMode clears meta | Task 1 |
| Manual verification | Task 8 |

No TBD placeholders remain. Types (`MetaField`, `stripConfig`, `stripMetadata` return shape) are consistent across tasks.
