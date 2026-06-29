/// <reference types='vitest' />
import * as path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  plugins: [react(), tailwindcss(), nxViteTsPaths()],
  test: {
    name: 'client',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default', 'junit'],
    outputFile: {
      junit: '../../reports/apps/client/junit.xml',
    },
    coverage: {
      reportsDirectory: '../../reports/apps/client',
      provider: 'v8',
    },
  },
});
