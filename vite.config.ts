import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import legacy from "@vitejs/plugin-legacy"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { qrcode } from "vite-plugin-qrcode"

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  const appName = isDev ? 'Warehouse (Dev)' : 'Warehouse Inventory Scanner';
  const appShortName = isDev ? 'Warehouse Dev' : 'Warehouse';

  return {
  server: {
    host: true, // <- key: exposes to LAN + prints Network URL
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Keep supabase isolated; everything else in a single vendor chunk to avoid React cycles.
            if (id.includes('supabase') || id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            return 'vendor';
          }
          // Your src code stays in main chunks (or split later)
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    legacy({
      targets: ['defaults', 'not IE 11', 'chrome >= 50'], // Support Samsung TV browsers
    }),
    qrcode(), // <- prints QR code in terminal
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        id: '/?pwa=warehouse',
        name: appName,
        short_name: appShortName,
        description: 'Warehouse appliance inventory scanning and delivery management',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  }
})
