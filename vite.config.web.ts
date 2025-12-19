import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vite configuration for web-only build (Cloudflare Pages deployment)
 * This config excludes Tauri dependencies and optimizes for browser deployment
 */
export default defineConfig({
  plugins: [react()],

  // Define platform at build time
  define: {
    'import.meta.env.VITE_PLATFORM': JSON.stringify('web'),
  },

  // Build configuration for Cloudflare Pages
  build: {
    outDir: 'dist-web',
    sourcemap: true,

    // Optimize chunks for better loading performance
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['zustand', 'lucide-react'],
          'chart-vendor': ['recharts'],
        },
      },
    },

    // Target modern browsers (Cloudflare Pages supports modern browsers)
    target: 'es2015',

    // Optimize for production
    minify: 'esbuild',
    cssMinify: true,
  },

  // Development server configuration
  server: {
    port: 3000,
    host: true,
    strictPort: false,

    // CORS for local development with backend
    proxy: {
      // Optional: Proxy API calls during development
      // '/api': {
      //   target: 'https://stonepot-restaurant-def3r7eewq-uc.a.run.app',
      //   changeOrigin: true,
      // },
    },
  },

  // Preview server (for testing production build locally)
  preview: {
    port: 3000,
    host: true,
  },

  // Path aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Exclude Tauri-specific dependencies from web build
  optimizeDeps: {
    exclude: [
      '@tauri-apps/api',
      '@tauri-apps/plugin-sql',
      '@tauri-apps/plugin-opener',
    ],
  },

  // Clear screen on rebuild
  clearScreen: true,
});
