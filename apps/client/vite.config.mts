/// <reference types='vitest' />
import * as path from "node:path";
import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
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
  },
  preview: {
    port: 4200,
    host: "localhost",
  },
  plugins: [reactRouter(), tailwindcss(), nxViteTsPaths(), nxCopyAssetsPlugin(["*.md"])],
  build: {
    outDir: "../../dist/apps/client",
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
