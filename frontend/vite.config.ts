import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    legacy({
      targets: ['chrome >= 69', 'edge >= 79', 'safari >= 13'],
      renderLegacyChunks: true,
    }),
  ],
  define: {
    __BUILD_TIME__: JSON.stringify(Date.now()),
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4533',
        changeOrigin: true,
      },
      '/rest': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4533',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: '../backend/frontend_dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  }
});
