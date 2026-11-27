import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Fixed port so the Tauri shell (src-tauri/tauri.conf.json → devUrl) can find it.
export default defineConfig({
  base: '/InkForge/',  //
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'], // اگه آیکون داری
      manifest: {
        name: 'InkForge',
        short_name: 'InkForge',
        description: 'Your handwriting. Your typeface. Your identity.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone', // این باعث میشه مثل اپ واقعی باز بشه (بدون نوار آدرس مرورگر)
        icons: [
          {
            src: 'icons/128x128.png', // از پوشه src-tauri/icons استفاده می‌کنیم
            sizes: '128x128',
            type: 'image/png'
          },
          {
            src: 'icons/128x128@2x.png',
            sizes: '256x256',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // این خطوط حیاتی‌ان: به مرورگر میگن فایل‌های WASM و Worker ها رو هم کش کن
        globPatterns: ['**/*.{js,css,html,wasm,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 // 5MB (چون فایل WASM تو ۱.۸ مگابایته)
      }
    })
  ],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
});