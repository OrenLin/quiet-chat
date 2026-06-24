import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 单文件模式：SINGLE_FILE=1 时构建为单个 HTML 文件（方便部署到任意静态服务器）
// 默认 PWA 模式：多文件 + Service Worker，支持完整离线缓存
const isSingleFile = process.env.SINGLE_FILE === '1';

// https://vite.dev/config/
export default defineConfig({
  // 相对路径：兼容 GitHub Pages 子路径部署（user.github.io/repo/）和根域名
  base: './',
  build: {
    sourcemap: 'hidden',
    target: 'esnext',
    chunkSizeWarningLimit: 1500,
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }),
    tsconfigPaths(),
    // 单文件模式：内联所有 JS/CSS 到一个 HTML；PWA 模式：生成 Service Worker
    ...(isSingleFile
      ? [viteSingleFile({ inlinePattern: ['**/*.{js,css}'] })]
      : [VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.svg'],
          manifest: {
            name: '静识 · 本地优先对话',
            short_name: '静识',
            description: '本地优先的大模型对话应用，支持 DeepSeek 云端与浏览器内本地推理，离线可用。',
            theme_color: '#0d0d0f',
            background_color: '#0d0d0f',
            display: 'standalone',
            orientation: 'portrait',
            // 相对路径：兼容 GitHub Pages 子路径部署
            start_url: './',
            scope: './',
            icons: [
              {
                src: './favicon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any maskable',
              },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,svg,woff2}'],
            // 仅缓存 Transformers.js 引擎库 CDN（jsdelivr/esm.sh/unpkg），支持离线加载引擎。
            // 模型权重不在此拦截：Workbox CacheFirst 对跨域请求会抛 no-response 错误，
            // 且 Transformers.js 自身通过 env.useBrowserCache 用 IndexedDB 缓存权重，更可靠。
            runtimeCaching: [
              {
                urlPattern: ({ url }) =>
                  url.origin === 'https://cdn.jsdelivr.net' ||
                  url.origin === 'https://esm.sh' ||
                  url.origin === 'https://unpkg.com',
                handler: 'CacheFirst',
                options: {
                  cacheName: 'transformers-cdn',
                  expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 30 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
            ],
          },
        })]),
  ],
})
