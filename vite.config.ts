import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

/** Ensure public/assets WASM binaries stay in sync with node_modules. */
function syncWasmPlugin(): Plugin {
  const run = () => {
    execFileSync(process.execPath, ['scripts/sync-wasm.mjs'], { stdio: 'inherit' })
  }
  return {
    name: 'sync-wasm-vips',
    buildStart: run,
    configureServer() {
      run()
    },
  }
}

/** Inject package version into index.html placeholders. */
function htmlVersionPlugin(): Plugin {
  return {
    name: 'html-app-version',
    transformIndexHtml(html) {
      return html.replaceAll('%APP_VERSION%', pkg.version)
    },
  }
}

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/img-tools/' : '/',
  plugins: [
    vue(),
    syncWasmPlugin(),
    htmlVersionPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg', 'favicon.svg'],
      manifest: {
        name: 'ImgTools',
        short_name: 'ImgTools',
        description: '浏览器端图片压缩与格式转换工具',
        theme_color: '#409eff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,svg,png,ico}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['wasm-vips'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
