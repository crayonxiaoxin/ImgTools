# ImgTools

> 纯浏览器端图片处理工具 — 所有处理在本地完成，文件不上传服务器。

![wasm-vips](https://img.shields.io/badge/engine-wasm--vips-blue)
![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D)
![PWA](https://img.shields.io/badge/PWA-ready-purple)
![License](https://img.shields.io/badge/license-MIT-green)

<p align="center">
  <img src="screenshot.png" alt="ImgTools 截图" width="720">
</p>

## 功能

| | 特性 | 说明 |
|---|------|------|
| 🔒 | **隐私安全** | 基于 wasm-vips 引擎，所有计算在浏览器内执行，图片不会离开你的设备 |
| 📦 | **图片压缩** | JPEG / PNG / WebP / AVIF / TIFF，有损/无损可调 |
| ⭐ | **Favicon 制作** | 自由裁剪 → 多尺寸输出，支持 PNG / ICO / ZIP 打包 |
| 🔄 | **格式转换** | 支持 6 种输出格式，一键互转 |
| 📋 | **批量处理** | 拖拽多图，统一处理，ZIP 打包下载 |
| 🌙 | **跨平台** | 暗黑模式 · 多语言 · PWA 离线可用 · 响应式设计 |

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:5173 即可使用。

### 构建

```bash
npm run build     # 类型检查 + 生产构建
npx vite build    # 仅构建（跳过类型检查）
```

## 部署

本项目可部署到任何静态托管服务：

- **Vercel** — [一键部署](https://vercel.com/new) 或 `npx vercel --prod`

> ⚠️ 务必保留 COOP/COEP 头（配置见 `vercel.json`），否则 wasm-vips 无法运行。

## 技术栈

| | |
|---|---|
| **图像引擎** | [wasm-vips](https://github.com/kleisauke/wasm-vips) — libvips 的 WebAssembly 移植 |
| **前端框架** | Vue 3 + TypeScript + Vite |
| **状态管理** | Pinia |
| **PWA** | vite-plugin-pwa，预缓存 ~6MB 资源 |
| **多语言** | vue-i18n · 简体中文 / 繁體中文 / English |
| **路由** | vue-router（History 模式） |

## 项目结构

```
src/
├── core/         # 核心引擎
├── composables/  # 逻辑层
├── stores/       # 状态管理
├── components/   # UI 组件
└── utils/        # 工具函数
```

## 许可

MIT
