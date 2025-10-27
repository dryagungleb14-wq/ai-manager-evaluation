import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
      "@shared": resolve(rootDir, "../shared"),
      "@assets": resolve(rootDir, "../attached_assets"),
    }
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("recharts")) {
            return "charts";
          }

          if (id.includes("@radix-ui")) {
            return "radix";
          }

          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)/.test(
              id
            ) || id.includes("react/jsx-runtime")
          ) {
            return "react";
          }
        },
      },
    },
  },
  server: { port: 5173 }
});
