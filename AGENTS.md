# ImgTools — 项目开发指南

## 项目概述

纯浏览器端图片处理工具，基于 `wasm-vips`（libvips 的 WASM 移植）实现图片压缩和格式转换，无需服务端。

## 技术栈

- **框架**: Vue 3 + Vite + TypeScript
- **状态管理**: Pinia (Composition API)
- **图像引擎**: [wasm-vips](https://github.com/kleisauke/wasm-vips) ^0.0.17
- **打包**: JSZip（批量导出）
- **CSS**: 手写 Scoped CSS（无 UI 库）

## 目录结构

```
src/
├── core/           # 核心处理层
│   ├── formats.ts  # 格式支持矩阵 + 检测工具
│   ├── vips.ts     # wasm-vips 单例初始化
│   ├── compress.ts # 压缩参数 → vips 编码选项
│   ├── pipeline.ts # 解码→变换→编码流水线
│   └── pdf.ts      # PDF → 图片 (PDF.js + wasm-vips)
├── composables/    # 逻辑层
│   ├── useImageProcessor.ts  # 单图/批量处理
│   └── useBatchExport.ts     # 导出/ZIP 下载
├── stores/
│   └── imageStore.ts  # Pinia 全局状态
├── components/     # UI 组件
│   ├── AppHeader.vue  # 头部（Logo + 版本号 + 语言/主题切换）
│   ├── Sidebar.vue    # 侧边栏（桌面）/ 底部导航（移动端）
│   ├── DropZone.vue   # 拖拽/选择文件区
│   ├── ParamPanel.vue # 参数面板（压缩/转换配置）
│   ├── BatchList.vue  # 批处理表格（含缩略图、结果、下载）
│   ├── FaviconPanel.vue # Favicon 制作（裁剪 + 多尺寸输出）
│   ├── PdfPanel.vue    # PDF 转图片
│   └── StatusBar.vue  # 底部状态栏（WASM 加载 + 处理进度）
├── views/
│   └── ModePage.vue  # 路由页面（按模式分发）
├── locales/        # i18n 语言文件
│   ├── zh-CN.ts
│   ├── zh-TW.ts
│   └── en.ts
├── utils/
│   ├── format.ts  # 文件大小格式化
│   └── ico.ts     # ICO 格式打包
├── App.vue        # 根组件（router-view）
├── router.ts      # 路由定义（History 模式）
├── i18n.ts        # 国际化配置
└── main.ts        # 入口
public/
├── logo.svg          # SVG Logo
├── favicon.svg       # SVG 网站图标
├── icon-192x192.png  # PWA 图标
├── icon-512x512.png  # PWA 图标（maskable）
├── assets/           # wasm-vips 动态模块（jxl/heif/resvg）
└── pdf.worker.min.mjs # PDF.js worker
```

## 关键架构决策

### 跨域隔离（COOP/COEP）
wasm-vips 使用 SharedArrayBuffer，页面必须返回以下头：
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```
配置在 `vite.config.ts`（开发）和 `vercel.json`（生产）。

### WASM 初始化
`core/vips.ts` 使用 promise 守卫防止并发初始化，30 秒超时，支持事件监听器（`onVipsReady`）。

### 跨域隔离（COOP/COEP）
wasm-vips 使用 SharedArrayBuffer，页面必须返回以下头：
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```
配置在 `vite.config.ts`（开发）和 `vercel.json`（生产）。

### WASM 初始化
`core/vips.ts` 使用 promise 守卫防止并发初始化，30 秒超时，支持事件监听器（`onVipsReady`）。

### 四模式架构
- **压缩模式**: 质量滑块 + 有损/无损 + 输出格式 + 自动降质（确保文件真正变小）
- **转换模式**: 格式网格按钮，使用 quality=100 最大质量编码
- **Favicon 模式**: 交互裁剪 + 多尺寸 PNG 输出 + ICO 打包
- **PDF 模式**: PDF.js 逐页渲染 → wasm-vips 编码，支持长图/逐页 + 精度可调

### 响应式布局
桌面端三栏（侧边栏 + 主区域 + 参数面板），移动端 (<768px) 侧边栏变为底部导航栏，内容垂直堆叠。

### PWA
使用 `vite-plugin-pwa` 实现可安装性。SW 预缓存所有静态资源（含 WASM，约 6MB），支持离线使用。
自动更新策略（`registerType: 'autoUpdate'`）。图标为 192x192 和 512x512 PNG。

### 编码方式
使用 `writeToBuffer('.jpg[Q=80,optimize_coding=true]')` 内联格式字符串，而非各格式的独立 save 方法。

### 格式支持
JPEG/PNG/WebP/AVIF/BMP/TIFF 可读写，GIF/SVG/PDF 只读。
PNG 有损压缩通过调色板量化（palette quantization）实现。

### 自动降质
同格式压缩时，如果编码结果比原图大，自动逐级降低 quality（步长 10，最低 Q=10）直到文件真正变小。

### 多语言 (i18n)
使用 `vue-i18n` v11，支持简体中文/繁体中文/英文。语言文件在 `src/locales/`。
自动检测浏览器语言，也可在页面右上角手动切换（偏好存入 localStorage）。
新增 UI 文本时，需同步更新三个 locale 文件。

### URL 路由
使用 `vue-router`（history 模式）。路由定义在 `src/router.ts`，页面组件在 `src/views/`。
- `/compress` — 压缩模式
- `/convert` — 转换模式
- `/favicon` — Favicon 模式
- `/pdf` — PDF 模式

## 常用命令

```bash
npm run dev      # 开发服务器
npm run build    # 类型检查 + 生产构建
npx vite build   # 仅构建（跳过类型检查）
```

## 部署

Vercel 部署配置见 `vercel.json`。务必保持 COOP/COEP 头以及 SPA fallback rewrite 规则。

## 注意事项

1. 添加新的图像格式时，需同时更新 `formats.ts` 的矩阵和 `pipeline.ts` 的编码映射
2. `wasm-vips` 在 `optimizeDeps.exclude` 中排除，禁止预构建
3. 所有 blob URL 必须配对 `revokeObjectURL`，防止内存泄漏
4. 跨模式切换时，`setMode` 会重置所有处理结果和配置参数
5. PDF 模式使用 PDF.js 渲染，大量页面时建议降低精度（1×），默认逐页输出以避免 OOM
