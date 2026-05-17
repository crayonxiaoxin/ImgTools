# ImgTools — 在线图片处理工具设计文档

## 概述

纯浏览器端图片处理工具，无需服务端支持。核心功能：多格式图片压缩（可调有损/无损等级）和格式互相转换。

## 技术栈

- **框架：** Vue 3 + Vite + TypeScript
- **图像引擎：** [wasm-vips](https://github.com/kleisauke/wasm-vips) — libvips 的 WASM 移植
- **状态管理：** Pinia
- **UI 样式：** 自建 CSS（不引入重型组件库）
- **打包：** JSZip（批量导出）

## 架构

### 应用结构

单页面应用，两种模式切换：压缩、转换。

```
┌─────────────────────────────────────────────────┐
│  Header: Logo + 模式切换 (压缩 / 转换)            │
├──────────┬──────────────────────────────────────┤
│ 侧边栏   │              主区域                    │
│ 当前模式  │  【拖拽/选择区域】                    │
│ 参数设置  │  ┌─────────┐ ┌─────────┐            │
│ 偏好设置  │  │ 原图预览 │ │ 结果预览 │            │
│          │  └─────────┘ └─────────┘            │
│          │  [开始处理]  [导出全部]                │
│          │  ──── 批处理列表 ────                │
│          │  | 文件 | 原大小 | 格式 | 处理后 | 状态│
├──────────┴──────────────────────────────────────┤
│  状态栏: wasm 加载状态 / 处理进度 / 错误提示      │
└─────────────────────────────────────────────────┘
```

### 模块划分

```
src/
├── core/
│   ├── vips.ts              — wasm-vips 初始化封装
│   ├── pipeline.ts          — 处理流水线（解码→变换→编码）
│   ├── compress.ts          — 压缩参数映射
│   └── formats.ts           — 格式支持矩阵
├── composables/
│   ├── useImageProcessor.ts — 单图处理逻辑
│   ├── useBatchExport.ts    — 批量导出逻辑
│   └── useDropZone.ts       — 拖拽上传
├── stores/
│   └── imageStore.ts        — Pinia 状态（图片列表 + 配置）
├── components/
│   ├── AppHeader.vue
│   ├── DropZone.vue
│   ├── ImagePreview.vue
│   ├── Sidebar.vue
│   ├── ParamPanel.vue       — 压缩/转换参数面板
│   ├── BatchList.vue
│   ├── StatusBar.vue
│   └── ...
```

## 格式支持

| 操作 | JPEG | PNG | WebP | AVIF | GIF | BMP | TIFF | SVG |
|------|------|-----|------|------|-----|-----|------|-----|
| 读取 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 写入 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| 压缩-有损 | ✅ | — | ✅ | ✅ | — | — | — | — |
| 压缩-无损 | — | ✅ | ✅ | ✅ | — | — | ✅ | — |

- GIF 只读不写（wasm-vips 限制）
- SVG 栅格化输出为 PNG/JPEG 等

## 核心处理流水线

```
File (Blob) → readAsArrayBuffer → vips.Image.newFromBuffer → 解码
  → 应用变换 (resize, quality, format) → vips.Image.writeToBuffer → 编码
  → Uint8Array → Blob → 预览 / 下载
```

### 压缩参数
- **有损：** quality 0-100（JPEG / WebP / AVIF）
- **无损：** lossless: true（PNG / WebP / AVIF / TIFF）
- **缩放：** resize + 最大宽高限制

### 转换流程
- 解码原图 → 按目标格式编码输出
- 格式兼容矩阵自动过滤不可选项

## 数据流与状态管理

### Pinia Store (`useImageStore`)

```ts
interface ImageItem {
  id: string
  file: File
  name: string
  size: number
  format: string
  status: 'pending' | 'processing' | 'done' | 'error'
  previewUrl?: string   // 原图缩略图
  resultUrl?: string    // 处理后结果
  resultSize?: number
  config: {
    quality: number      // 0-100
    lossless: boolean
    targetFormat: string
    maxWidth?: number
  }
}

interface ImageStoreState {
  images: ImageItem[]
  activeMode: 'compress' | 'convert'
  processing: boolean
  vipsReady: boolean
}
```

### 数据流

1. 拖拽/选择 → ArrayBuffer → 缩略图 → images[]
2. 用户调参 → 更新对应 image.config
3. 点击处理 → 逐个遍历 → vips 处理 → 更新 resultUrl
4. 批量导出 → 单图下载或 ZIP 打包

## 边界情况与错误处理

- **WASM 不支持：** 检测并提示
- **格式不支持/文件损坏：** 友好提示，不阻塞
- **大文件（>50MB）：** 给出警告
- **内存不足：** 捕获错误，建议分批处理
- **单图失败：** 不阻塞批量任务
- **ZIP 打包失败：** 降级为逐个下载
- **SVG 输出：** 需指定栅格化尺寸
