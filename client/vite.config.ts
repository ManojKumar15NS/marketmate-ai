import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        timeout: 300000,
        proxyTimeout: 300000
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'clsx', 'tailwind-merge', 'lucide-react', 'leaflet'],
    exclude: ['jspdf']
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          jspdf: ['jspdf'],
          charts: ['recharts'],
          markdown: ['react-markdown', 'remark-gfm'],
          icons: ['lucide-react'],
          leaflet: ['leaflet']
        }
      }
    }
  }
});
