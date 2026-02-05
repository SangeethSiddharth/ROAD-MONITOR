import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
      manifest: {
        name: 'RoadWatch - Civic Road Reporting',
        short_name: 'RoadWatch',
        description: 'AI-powered road damage detection for civic reporting',
        theme_color: '#1976d2',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'mapbox-cache', expiration: { maxEntries: 50 } }
          }
        ]
      }
    })
  ],
  server: {
    allowedHosts: [
      'oviparously-pseudomultilocular-fidelia.ngrok-free.dev'
    ]
  }
});
