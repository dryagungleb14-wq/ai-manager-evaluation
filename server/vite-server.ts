import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";
import { nanoid } from "nanoid";
import type { InlineConfig } from "vite";

type ViteModule = typeof import("vite");

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

async function loadViteModule(): Promise<ViteModule> {
  const module = await import("vite");
  return module;
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const { createServer: createViteServer, createLogger } = await loadViteModule();
  const viteLogger = createLogger();
  const inlineConfig: InlineConfig = {
    root: path.resolve(import.meta.dirname, "..", "client"),
    appType: "custom",
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "..", "client", "src"),
        shared: path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "..", "attached_assets"),
      },
    },
  };

  const vite = await createViteServer({
    ...inlineConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Correct path to the built frontend
  // The build process puts the client build in the root dist directory
  const distPath = path.resolve(import.meta.dirname, "..", "dist");

  if (!fs.existsSync(path.resolve(distPath, "index.html"))) {
    log(
      `❌ Static client build not found at ${distPath}. Run 'npm run build' first.`,
      "express",
    );
    return;
  }

  log(`✅ Serving static files from ${distPath}`, "express");
  app.use(express.static(distPath));

  // SPA fallback - serve index.html for all unmatched routes
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
