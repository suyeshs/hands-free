import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  // @ts-expect-error process is a nodejs global
  const host = process.env.TAURI_DEV_HOST;

  const isDev = mode === 'development';
  const isProd = mode === 'production';

  return {
    plugins: [
      react({
        // Reduce memory usage in dev mode
        ...(isDev ? {
          babel: {
            plugins: [],
            compact: true,
          },
        } : {}),
      }),
    ],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,

    // Optimize for development AND production
    build: isDev ? {
      // Development optimizations
      sourcemap: false, // Disable source maps in dev to save memory
      minify: false, // Skip minification in dev
      rollupOptions: {
        output: {
          manualChunks: undefined, // Disable code splitting in dev
        },
      },
      chunkSizeWarningLimit: 2000, // Increase to avoid warnings
    } : {
      // Production build security hardening
      sourcemap: false, // Never expose source maps
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.debug', 'console.info'],
        },
        mangle: {
          properties: {
            regex: /^_private_/, // Mangle properties starting with _private_
          },
        },
      },
    },

    // Optimize dev server
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        // Tell Vite to ignore watching unnecessary directories
        ignored: [
          "**/src-tauri/**",
          "**/node_modules/**",
          "**/dist/**",
          "**/dist-web/**",
          "**/.git/**",
          "**/target/**",
          "**/handsfree-pos-windows-x86-nsis/**",
          "**/apps/**",
          "**/docs/**",
          "**/mockups/**",
          "**/*.db",
          "**/*.db-*",
        ],
        // Use polling only if needed (reduces CPU/memory usage)
        usePolling: false,
      },
      // Optimize server performance
      fs: {
        // Limit file system access to project root
        strict: true,
        allow: ['.'],
      },
    },

    // Optimize dependency pre-bundling
    optimizeDeps: {
      // Pre-bundle these dependencies to reduce memory usage
      include: [
        'react',
        'react-dom',
        'react-hook-form',
        'zustand',
        'lucide-react',
        'date-fns',
        'clsx',
        'framer-motion',
      ],
      // Exclude large dependencies that don't need pre-bundling
      exclude: [
        '@tauri-apps/api',
        '@tauri-apps/plugin-sql',
        '@tauri-apps/plugin-fs',
      ],
    },

    // Limit memory usage
    esbuild: {
      logOverride: {
        'this-is-undefined-in-esm': 'silent',
      },
    },
  };
});
