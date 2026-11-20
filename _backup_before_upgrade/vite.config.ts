import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks — cached separately by the browser
          'react-vendor':   ['react', 'react-dom', 'react-router-dom'],
          'query-vendor':   ['@tanstack/react-query'],
          'supabase-vendor':['@supabase/supabase-js'],
          'charts-vendor':  ['recharts'],
          'form-vendor':    ['react-hook-form', '@hookform/resolvers', 'zod'],
          'store-vendor':   ['zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
