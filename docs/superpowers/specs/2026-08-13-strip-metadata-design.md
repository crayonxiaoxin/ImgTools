# Strip Metadata Mode — Design Spec

**Date:** 2026-08-13  
**Status:** Draft for user review (design verbally approved; implement only after this doc is accepted)  
**Mode id / route:** `strip` / `/strip`

## Goal

Add a fifth ImgTools mode that removes privacy-sensitive image metadata (EXIF/GPS/XMP/IPTC, optionally ICC) entirely in the browser via wasm-vips, and shows a **before / after metadata comparison** in the batch list.

## Non-goals

- Full EXIF editor / field-by-field keep lists
- Metadata viewing as a standalone “inspector-only” mode without export
- SVG / PDF / GIF-as-animation specialized pipelines
- Server-side processing

## Product summary

| Item | Decision |
|------|----------|
| Placement | New sidebar mode, after PDF |
| Route | `/strip` |
| UX pattern | Same as compress/convert: DropZone + ParamPanel + BatchList |
| Default strip | EXIF, XMP, IPTC, other non-ICC tags |
| ICC | **Keep by default**; optional “also remove ICC” |
| Orientation | Always `autorot` before write so removing Orientation tag does not leave a sideways image |
| Output format | Same as input when writable; otherwise fall back to PNG |
| Encode quality | Prefer fidelity: lossless when format supports it; otherwise quality ≈ 95–100 (not a compressor) |

## User flow

1. User opens `/strip`.
2. Drops/selects images (writable raster formats; reject or skip unsupported with clear error).
3. Optionally toggles “also remove ICC”.
4. Clicks process (same primary action pattern as compress).
5. Each row shows status, size delta, download, and an expandable **Metadata** section:
   - Before: summarized fields detected on the original
   - After: summarized fields remaining on the result (empty / ICC-only when successful)
6. Batch download / ZIP works like compress mode.

## UI

### Sidebar

- New item: icon (simple “shield” or “tag-off” style SVG, consistent with existing stroke icons) + i18n label (`strip` / 去元数据 / 去除中繼資料).

### ParamPanel (`activeMode === 'strip'`)

- Short description: removes location/camera/time and other embedded metadata locally.
- Toggle: **保留 ICC 色彩配置** (default ON) / or inverse wording **同时移除 ICC** (default OFF). Spec choice: use **“同时移除 ICC”** default **off** so the safe path is zero clicks.
- No quality slider, no format grid.
- Process button reuses existing batch process control.

### BatchList

- Reuse existing columns (preview, name, size, result size, status, download).
- Add expandable row detail (or a “元数据” button/chevron):
  - Two columns: **清理前** | **清理后**
  - Present as grouped chips / short key-value rows, not a raw dump of dozens of EXIF keys.
  - Sensitive values:
    - GPS: show `GPS: yes` plus optional expand for lat/lon **only after user expands that row** (default collapsed).
    - Other long strings: truncate with title tooltip.
  - Diff hint: cleared items can be visually muted/struck in the before list, or a small “已清除 N 项” badge on the after side.
- Before process: only “清理前” populated (scan on add or on first expand — see Data).
- After process: both sides filled.

### Empty / edge copy

- No metadata found: show “未检测到可清除的元数据” but still allow re-encode/export.
- Unsupported format: status `error` with i18n message.

## Data model

Extend `ImageItem` (or a strip-specific optional blob) with:

```ts
interface MetaField {
  key: string          // stable id, e.g. 'exif:DateTime', 'gps', 'icc'
  label: string        // i18n-ready label key or resolved string
  value?: string       // display value; omit for presence-only
  group: 'exif' | 'xmp' | 'iptc' | 'icc' | 'other'
  sensitive?: boolean  // GPS etc. — collapsed by default
}

interface ImageItem {
  // ...existing fields
  metaBefore?: MetaField[]
  metaAfter?: MetaField[]
}
```

`setMode('strip')` must clear `metaBefore` / `metaAfter` along with results (same reset policy as other modes).

Global strip options live on the store (like compress defaults) or a small `stripConfig` ref:

```ts
stripConfig: { removeIcc: boolean } // default false
```

## Core pipeline

New module: `src/core/strip.ts` (keep `pipeline.ts` focused).

### `extractMetadata(buffer): MetaField[]`

1. `Image.newFromBuffer`.
2. `getFields()` (or equivalent) and map known privacy-relevant names into `MetaField`s.
3. Normalize groups:
   - Anything EXIF / orientation / camera / datetime → `exif`
   - GPS-related → one sensitive `gps` field (plus optional detail children or expand payload)
   - XMP / IPTC / ICC / other comments → respective groups
4. Do not surface every internal libvips field if noisy; prefer a curated allowlist + “其他 N 项” bucket for leftovers that look user-facing (e.g. `png-comment`).

### `stripMetadata(buffer, { removeIcc, format }): ProcessResult`

1. Decode.
2. `autorot()` (and reset orientation metadata as libvips docs recommend).
3. Encode with `keep`:
   - Default: `ForeignKeep.icc` only (strip exif/xmp/iptc/other/gainmap).
   - If `removeIcc`: `ForeignKeep.none`.
4. Use existing writeToBuffer style with format suffix; pass `keep` via options string or save options API supported by wasm-vips 0.0.17.
5. Re-extract metadata from output → caller stores as `metaAfter`.

### When to extract `metaBefore`

- **On file add** (async, non-blocking): best UX so expand works before process.
- Failures in scan must not block adding the file; leave `metaBefore` empty and show “无法读取元数据” when expanded.

## Routing & mode wiring

- `AppMode` += `'strip'`
- `router.ts`: `/strip`
- `Sidebar.vue`: nav item
- `ModePage.vue`: treat like compress/convert (DropZone + ParamPanel + BatchList); accept image types from DropZone (exclude pdf-only flows)
- `useImageProcessor.ts`: branch for strip → call `stripMetadata`, set result + `metaAfter` (and ensure `metaBefore` exists)
- Locales: `zh-CN` / `zh-TW` / `en` keys for mode name, params, list headers, empty states, errors

## Accept types

Supported inputs: jpeg, png, webp, avif, tiff, bmp (writable rasters).  
Reject/skip: svg, pdf, gif (decode-only / animation ambiguity) with explicit error — GIF may be allowed later if still-frame strip proves reliable; **v1 = unsupported**.

## Error handling

- Decode failure → row error toast pattern already used in batch.
- Encode failure → row error.
- Partial batch success → existing summary toast.
- WASM not ready → existing engine hint / status bar.

## Testing / verification

Manual:

1. JPEG with EXIF + GPS: before shows camera/time/GPS; after empty (or ICC only).
2. Toggle remove ICC: after has no ICC field.
3. Phone photo with Orientation≠1: visual upright after strip.
4. PNG without metadata: message + successful export.
5. Mode switch away and back: results and meta cleared.
6. i18n: all three locales show mode + panel + list strings.

## Implementation notes (constraints)

- Preserve COOP/COEP and client-only architecture.
- Revoke object URLs as today.
- Do not auto-process on drop.
- Keep ParamPanel visually aligned with compress (surface card, same tokens).
- Prefer extending BatchList with a mode-conditional meta panel over a new page component.

## Open decisions (resolved in this spec)

| Topic | Resolution |
|-------|------------|
| ICC default | Keep ICC unless user enables remove |
| GPS display | Presence by default; coordinates behind expand |
| Format change | Same format when writable |
| Pre-scan timing | On add, async |
| GIF/SVG/PDF | Unsupported in v1 |
