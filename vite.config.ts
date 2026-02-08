import path from "path"
import fs from "fs"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import legacy from "@vitejs/plugin-legacy"
import { defineConfig, type PluginOption } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { qrcode } from "vite-plugin-qrcode"
import { visualizer } from "rollup-plugin-visualizer"

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  const appName = isDev ? 'Warehouse (Dev)' : 'Warehouse Inventory Scanner';
  const appShortName = isDev ? 'Warehouse Dev' : 'Warehouse';
  const shouldAnalyze = process.env.ANALYZE === 'true';

  // Check for mkcert certificates
  const certPath = path.resolve(__dirname, 'localhost+3.pem');
  const keyPath = path.resolve(__dirname, 'localhost+3-key.pem');
  const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

  return {
  server: {
    host: true, // <- key: exposes to LAN + prints Network URL
    ...(isDev && hasCerts ? {
      https: {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    } : {}),
  },
  build: {
    chunkSizeWarningLimit: 1400, // Sets the limit to 1000 KiB (1 MB)
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          // Supabase - completely isolated
          if (id.includes('supabase') || id.includes('@supabase')) {
            return 'vendor-supabase';
          }
          
          // Leaflet - isolated map library
          if (id.includes('leaflet') || id.includes('react-leaflet')) {
            return 'vendor-leaflet';
          }
          
          // Recharts and d3 - chart libraries (isolated)
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts';
          }
          
          // Everything else (React, Radix, TanStack, etc.) stays together
          // This avoids circular dependencies
          return 'vendor';
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
    shouldAnalyze && (visualizer({
      filename: 'dist/bundle-stats.html',
      gzipSize: true,
      brotliSize: true,
      open: true,
    }) as PluginOption),
    // Only enable PWA in production to avoid console spam
    !isDev && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        id: '/?pwa=warehouse',
        name: appName,
        short_name: appShortName,
        description: 'Warehouse appliance inventory scanning and delivery management',
        theme_color: '#1A1A1A',
        background_color: '#1A1A1A',
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
        // Bump up the max file size to cache to 5mb
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallbackAllowlist: [/^\/.*/],
        runtimeCaching: [
          {
            // Only cache GET requests to Supabase REST/Storage; never cache auth POSTs.
            urlPattern: /^https:\/\/.*\.supabase\.co\/(rest|storage)\/.*/i,
            handler: 'NetworkFirst',
            method: 'GET',
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
      }
    })
  ].filter((plugin): plugin is NonNullable<typeof plugin> => Boolean(plugin)),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  }
})
