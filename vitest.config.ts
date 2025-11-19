import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@infra': path.resolve(__dirname, './src/infra'),
      '@ui': path.resolve(__dirname, './src/ui'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', '**/*.test.ts', '**/*.spec.ts'],
    },
  },
});
