import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
  plugins: [solidPlugin()],
  base: './', // Use relative paths for Electron
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@infra': path.resolve(__dirname, './src/infra'),
      '@ui': path.resolve(__dirname, './src/ui'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
  },
});
