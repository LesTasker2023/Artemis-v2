import { defineConfig } from 'vite';
import path from 'node:path';

// Vite config for building Electron main/preload processes
export default defineConfig({
  build: {
    outDir: 'dist/electron',
    lib: {
      entry: {
        main: path.resolve(__dirname, 'electron/main.ts'),
        preload: path.resolve(__dirname, 'electron/preload.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['electron'],
    },
    minify: false, // Easier debugging
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
