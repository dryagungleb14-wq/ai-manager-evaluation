import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Vercel serves the client from the root domain. Using a relative base path
  // like "./" breaks asset URLs (CSS/JS) on deep links because the browser
  // resolves them against the current route (e.g. "/dashboard/assets/...").
  // This caused the Tailwind bundle to 404 in production and the UI appeared
  // unstyled. Switching back to the default absolute base keeps asset URLs
  // rooted at "/" so they load correctly no matter which route is opened.
  base: "/",
  plugins: [react(), tsconfigPaths()],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
      "@shared": resolve(rootDir, "../shared"),
      "@assets": resolve(rootDir, "../attached_assets"),
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          radix: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-popover",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-slot",
          ],
          charts: ["recharts"],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  server: { port: 5173 },
});
