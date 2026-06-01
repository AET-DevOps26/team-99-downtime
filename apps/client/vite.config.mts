/// <reference types='vitest' />
import * as path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";
import { nxCopyAssetsPlugin } from "@nx/vite/plugins/nx-copy-assets.plugin";

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: "../../node_modules/.vite/apps/client",
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    port: 4200,
    host: "localhost",
    proxy: {
      // Same-origin gateway for the auth-service: the browser calls
      // /api/auth/* on :4200 and Vite forwards to the auth-service, avoiding
      // cross-origin (CORS) issues with credentialed requests in dev.
      "/api/auth": {
        target: process.env.VITE_AUTH_URL ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4200,
    host: "localhost",
  },
  plugins: [react(), tailwindcss(), nxViteTsPaths(), nxCopyAssetsPlugin(["*.md"])],
  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: () => [ nxViteTsPaths() ],
  // },
  build: {
    outDir: "../../dist/apps/client",
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: "client",
    watch: false,
    globals: true,
    environment: "jsdom",
    include: ["{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    reporters: ["default", "junit"],
    outputFile: {
      junit: "../../reports/apps/client/junit.xml",
    },
    coverage: {
      reportsDirectory: "../../reports/apps/client",
      provider: "v8" as const,
    },
  },
}));
