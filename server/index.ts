import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDefaultChecklists, seedDefaultManagers } from "./storage";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
