import express, { type Request, Response, NextFunction, type RequestHandler } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite-server.js";
import {
  seedDefaultChecklists,
  seedDefaultManagers,
  storageInitializationError,
  storageUsesDatabase,
} from "./storage.js";
import type { CorsOptions } from "./types/cors-options";

const app = express();

type OriginMatcher = string | RegExp;

const DEFAULT_ALLOWED_ORIGINS: OriginMatcher[] = [
  /^https:\/\/([a-z0-9-]+-)*[a-z0-9-]+\.vercel\.app$/i,
];

let corsFactoryPromise: Promise<(options?: CorsOptions) => RequestHandler> | null = null;

let serviceVersion =
  process.env.APP_VERSION?.trim()
    ?? process.env.npm_package_version?.trim()
    ?? "unknown";

async function loadEnvConfig(): Promise<void> {
  try {
    const dotenvModule = await import("dotenv");
    const configFn =
      typeof dotenvModule.default?.config === "function"
        ? dotenvModule.default.config
        : typeof dotenvModule.config === "function"
          ? dotenvModule.config
          : null;

    if (configFn) {
      configFn();
      return;
    }
  } catch {
    // ignore and fall back to manual loader
  }

  const envPath = path.resolve(import.meta.dirname, ".env");

  try {
    await fs.access(envPath);
  } catch {
    return;
  }

  const contents = await fs.readFile(envPath, "utf-8");
  const lines = contents.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = line.split("=");
    const value = valueParts.join("=").trim().replace(/^['"]|['"]$/g, "");

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function buildOriginConfig(originSetting: string | undefined): { allowAll: boolean; matchers: OriginMatcher[] } {
  if (originSetting?.trim() === "*") {
    return { allowAll: true, matchers: [] };
  }

  if (!originSetting || originSetting.trim().length === 0) {
    return { allowAll: false, matchers: DEFAULT_ALLOWED_ORIGINS };
  }

  const tokens = originSetting
    .split(",")
    .map(entry => entry.trim())
    .filter((entry): entry is string => entry.length > 0);

  const matchers: OriginMatcher[] = tokens.map((entry) => {
    if (entry.includes("*")) {
      const escaped = entry
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\\\*/g, ".*");
      return new RegExp(`^${escaped}$`, "i");
    }

    return entry;
  });

  return { allowAll: false, matchers: matchers.length > 0 ? matchers : DEFAULT_ALLOWED_ORIGINS };
}

function originMatches(origin: string, matchers: OriginMatcher[]): boolean {
  return matchers.some((matcher) => {
    if (typeof matcher === "string") {
      return matcher === origin;
    }

    return matcher.test(origin);
  });
}

async function loadCorsFactory(): Promise<(options?: CorsOptions) => RequestHandler> {
  if (!corsFactoryPromise) {
    corsFactoryPromise = (async () => {
      const corsModule = await import("cors");
      const factory = (corsModule as { default?: (options?: CorsOptions) => RequestHandler }).default
        ?? (corsModule as unknown as (options?: CorsOptions) => RequestHandler);

      return factory;
    })();
  }

  try {
    return await corsFactoryPromise;
  } catch (error) {
    corsFactoryPromise = null;
    throw error;
  }
}

function buildFallbackCorsMiddleware(matchers: OriginMatcher[], allowAll: boolean): RequestHandler {
  return (req, res, next) => {
    const requestOrigin = req.headers.origin;

    if (allowAll) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (requestOrigin && originMatches(requestOrigin, matchers)) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Vary", "Origin");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  };
}

async function ensureServiceVersionLoaded(): Promise<void> {
  if (serviceVersion && serviceVersion !== "unknown") {
    return;
  }

  const packageJsonPath = path.resolve(import.meta.dirname, "package.json");

  try {
    const contents = await fs.readFile(packageJsonPath, "utf-8");
    const parsed = JSON.parse(contents) as { version?: string };

    if (parsed.version) {
      serviceVersion = parsed.version;
    }
  } catch {
    // ignore, fall back to default version placeholder
  }
}

async function createCorsMiddleware(originSetting: string | undefined): Promise<RequestHandler> {
  const { allowAll, matchers } = buildOriginConfig(originSetting);

  try {
    const corsFactory = await loadCorsFactory();
    const baseOptions: CorsOptions = {
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      optionsSuccessStatus: 204,
    };

    if (allowAll) {
      return corsFactory({
        ...baseOptions,
        origin: true,
      });
    }

    return corsFactory({
      ...baseOptions,
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (originMatches(origin, matchers)) {
          callback(null, true);
          return;
        }

        callback(new Error("Not allowed by CORS"));
      },
    });
  } catch (error) {
    log(
      `cors package unavailable (${error instanceof Error ? error.message : String(error)}); falling back to manual headers`,
    );
    return buildFallbackCorsMiddleware(matchers, allowAll);
  }
}

app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok", version: serviceVersion });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", version: serviceVersion, uptime: process.uptime() });
});

app.get("/version", (_req, res) => {
  res.status(200).json({ version: serviceVersion });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await loadEnvConfig();
  await ensureServiceVersionLoaded();

  const nodeEnv = process.env.NODE_ENV ?? "production";
  app.set("env", nodeEnv);

  const corsOrigin = process.env.CORS_ORIGIN;
  const corsMiddleware = await createCorsMiddleware(corsOrigin);
  app.use(corsMiddleware);

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  if (!storageUsesDatabase) {
    const fallbackMessage = storageInitializationError
      ? `Database unavailable (${storageInitializationError.message}). Falling back to in-memory storage.`
      : "Database unavailable. Falling back to in-memory storage.";
    log(fallbackMessage, "storage");
  }

  // Seed default checklists on startup (only if database is empty)
  const defaultChecklists = [
    {
      id: "b2b-sales-basic",
      name: "Продажи B2B — базовый",
      version: "1.0",
      items: [
        {
          id: "greeting",
          title: "Приветствие и представление",
          type: "mandatory" as const,
          criteria: {
            positive_patterns: ["добрый день", "здравствуйте", "меня зовут", "компания"],
            negative_patterns: [],
            llm_hint: "Оценить наличие корректного приветствия и представления компании/менеджера.",
          },
          confidence_threshold: 0.6,
        },
        {
          id: "needs",
          title: "Выявление потребностей",
          type: "mandatory" as const,
          criteria: {
            positive_patterns: ["какие задачи", "что важно", "какие цели", "расскажите о"],
            llm_hint: "Проверить, задавались ли вопросы для понимания задач клиента.",
          },
          confidence_threshold: 0.65,
        },
        {
          id: "presentation",
          title: "Презентация решения",
          type: "mandatory" as const,
          criteria: {
            positive_patterns: ["мы можем предложить", "наше решение", "это поможет вам"],
            llm_hint: "Проверить, представил ли менеджер решение с привязкой к потребностям клиента.",
          },
          confidence_threshold: 0.6,
        },
        {
          id: "objections",
          title: "Работа с возражениями",
          type: "recommended" as const,
          criteria: {
            llm_hint: "Оценить, как менеджер обрабатывал возражения клиента (если были).",
          },
          confidence_threshold: 0.65,
        },
        {
          id: "next-steps",
          title: "Договорённости о следующих шагах",
          type: "mandatory" as const,
          criteria: {
            positive_patterns: ["следующий шаг", "когда встретимся", "пришлю", "свяжемся"],
            llm_hint: "Проверить, были ли зафиксированы конкретные следующие шаги.",
          },
          confidence_threshold: 0.7,
        },
        {
          id: "promises-without-basis",
          title: "Обещания без оснований",
          type: "prohibited" as const,
          criteria: {
            negative_patterns: ["гарантирую", "точно получится", "обещаю", "100%"],
            llm_hint: "Выявить необоснованные обещания или гарантии без подтверждения.",
          },
          confidence_threshold: 0.7,
        },
      ],
    },
    {
      id: "support-quality",
      name: "Качество поддержки клиентов",
      version: "1.0",
      items: [
        {
          id: "greeting-support",
          title: "Вежливое приветствие",
          type: "mandatory" as const,
          criteria: {
            positive_patterns: ["добрый день", "здравствуйте", "чем могу помочь"],
            llm_hint: "Проверить вежливость и профессионализм приветствия.",
          },
          confidence_threshold: 0.6,
        },
        {
          id: "problem-understanding",
          title: "Понимание проблемы",
          type: "mandatory" as const,
          criteria: {
            positive_patterns: ["правильно понимаю", "уточните", "объясните"],
            llm_hint: "Оценить, задавал ли менеджер уточняющие вопросы для понимания проблемы.",
          },
          confidence_threshold: 0.65,
        },
        {
          id: "solution",
          title: "Предложение решения",
          type: "mandatory" as const,
          criteria: {
            llm_hint: "Проверить, было ли предложено конкретное решение проблемы.",
          },
          confidence_threshold: 0.7,
        },
        {
          id: "empathy",
          title: "Эмпатия и понимание",
          type: "recommended" as const,
          criteria: {
            positive_patterns: ["понимаю", "сожалею", "поможем разобраться"],
            llm_hint: "Оценить проявление эмпатии к проблеме клиента.",
          },
          confidence_threshold: 0.6,
        },
        {
          id: "rude-language",
          title: "Грубость или непрофессионализм",
          type: "prohibited" as const,
          criteria: {
            negative_patterns: ["это не моя проблема", "сами виноваты", "не знаю"],
            llm_hint: "Выявить грубые или непрофессиональные высказывания.",
          },
          confidence_threshold: 0.8,
        },
      ],
    },
  ];

  await seedDefaultChecklists(defaultChecklists);
  await seedDefaultManagers();
  
  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
})();
