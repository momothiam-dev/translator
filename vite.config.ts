import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['parlotte.svg'],
      manifest: {
        name: 'Parlotte — Traducteur hors ligne',
        short_name: 'Parlotte',
        description: 'Traduisez vos textes en privé, même sans connexion.',
        theme_color: '#f6f5f0',
        background_color: '#f6f5f0',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/parlotte.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
})