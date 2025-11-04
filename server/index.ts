import express, { type Request, Response, NextFunction, type RequestHandler } from "express";
import session from "express-session";
import cors from "cors";
import { promises as fs } from "node:fs";
import path from "node:path";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite-server.js";
import { createAuthGuard } from "./auth-guard.js";
import {
  seedDefaultChecklists,
  seedDefaultAdvancedChecklists,
  seedDefaultManagers,
  seedDefaultUsers,
  storageInitializationError,
  storageUsesDatabase,
} from "./storage.js";
import { preTrialChecklist } from "./data/pre-trial-checklist.js";
import { forUlyanaChecklist } from "./data/for-ulyana-checklist.js";
import type { CorsOptions } from "./types/cors-options";
import { getDatabase } from "./db.js";

// Extend Express Session type to include user data
declare module "express-session" {
  interface SessionData {
    userId?: number;
    username?: string;
    role?: "admin" | "user";
  }
}

const app = express();

const hasGeminiKey =
  !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0;
console.log(`[env] GEMINI_API_KEY loaded: ${hasGeminiKey}`);
if (!hasGeminiKey) {
  console.warn(
    "[env] GEMINI_API_KEY is missing. The API will respond with a 503 on Gemini-dependent endpoints.",
  );
}

type OriginMatcher = string | RegExp;

const DEFAULT_ALLOWED_ORIGINS: OriginMatcher[] = [
  /^https:\/\/([a-z0-9-]+-)*[a-z0-9-]+\.vercel\.app$/i,
];

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

function originMatches(origin: string, matchers: OriginMatcher[]): boolean {
  return matchers.some((matcher) => {
    if (typeof matcher === "string") {
      return matcher === origin;
    }

    return matcher.test(origin);
  });
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

function resolveAllowedOrigins(): OriginMatcher[] {
  const explicitOrigins = [
    process.env.FRONTEND_ORIGIN?.trim(),
    process.env.FRONTEND_ORIGIN_ALT?.trim(),
  ].filter((value): value is string => Boolean(value && value.length > 0));

  if (explicitOrigins.length > 0) {
    return explicitOrigins;
  }

  return DEFAULT_ALLOWED_ORIGINS;
}

function createCorsMiddleware(): RequestHandler {
  const matchers = resolveAllowedOrigins();
  const baseOptions: CorsOptions = {
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  };

  return cors({
    ...baseOptions,
    origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (originMatches(origin, matchers)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  });
}

/**
 * Create session store with fallback strategy:
 * 1. Try PostgreSQL session store (connect-pg-simple) if DATABASE_URL is set
 * 2. Fall back to MemoryStore (for development only)
 * 
 * In production, a persistent session store is required to maintain sessions
 * across server restarts and multiple instances.
 */
async function createSessionStore(nodeEnv: string): Promise<session.Store | undefined> {
  // In production, we should use a persistent session store
  if (nodeEnv === "production" && process.env.DATABASE_URL) {
    try {
      const pgSession = (await import("connect-pg-simple")).default(session);
      const { Pool } = await import("@neondatabase/serverless");
      const ws = await import("ws");
      const { neonConfig } = await import("@neondatabase/serverless");
      
      neonConfig.webSocketConstructor = ws.default;
      
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      
      const store = new pgSession({
        pool,
        tableName: "session", // Will be created automatically
        createTableIfMissing: true,
      });
      
      log("Session store: PostgreSQL (connect-pg-simple)", "session");
      return store;
    } catch (error) {
      console.warn("[session] Failed to initialize PostgreSQL session store, falling back to MemoryStore");
      console.warn(`[session] Error: ${error instanceof Error ? error.message : String(error)}`);
      console.warn("[session] WARNING: Sessions will not persist across server restarts in DEGRADED MODE");
    }
  }
  
  // Development mode or fallback: use MemoryStore
  if (nodeEnv === "production") {
    console.warn("[session] WARNING: Using MemoryStore in production. Sessions will not persist!");
    console.warn("[session] For production, set DATABASE_URL or configure Redis for persistent sessions.");
  } else {
    log("Session store: MemoryStore (development only)", "session");
  }
  
  return undefined; // express-session will use default MemoryStore
}

app.get("/health", (_req, res) => {
  const health = {
    status: "ok",
    version: serviceVersion,
    uptime: process.uptime(),
    storage: storageUsesDatabase ? "database" : "in-memory",
    degraded: !storageUsesDatabase,
  };
  
  // Return 200 even in degraded mode - the service is still functional
  res.status(200).json(health);
});

app.get("/version", (_req, res) => {
  res.status(200).json({ version: serviceVersion });
});

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    geminiKey: !!process.env.GEMINI_API_KEY,
    version: process.env.npm_package_version ?? "unknown",
  });
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

  const corsMiddleware = createCorsMiddleware();
  app.use(corsMiddleware);

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Session middleware with persistent store
  const sessionStore = await createSessionStore(nodeEnv);
  
  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || (() => {
        if (nodeEnv === "production") {
          throw new Error("SESSION_SECRET must be set in production");
        }
        return "ai-manager-eval-secret-dev-only";
      })(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: nodeEnv === "production",
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        sameSite: nodeEnv === "production" ? "strict" : "lax",
      },
    })
  );

  const authGuard = createAuthGuard();
  log(`authentication guard ${authGuard.enabled ? "enabled" : "disabled"}`, "auth");
  app.use(authGuard);

  // Log degraded mode status
  if (!storageUsesDatabase) {
    const degradedModeMessage = storageInitializationError
      ? `⚠️  DEGRADED MODE: Database unavailable (${storageInitializationError.message})`
      : "⚠️  DEGRADED MODE: Database unavailable";
    
    log(degradedModeMessage, "storage");
    log("⚠️  Using in-memory storage - data will not persist across restarts", "storage");
    log("⚠️  All critical API endpoints will work but changes are temporary", "storage");
  } else {
    log("✓ Database connection successful - using persistent storage", "storage");
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
  await seedDefaultAdvancedChecklists([preTrialChecklist, forUlyanaChecklist]);
  await seedDefaultManagers();
  
  // Only seed users when using database storage (not in-memory)
  if (storageUsesDatabase) {
    await seedDefaultUsers();
  }
  
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
