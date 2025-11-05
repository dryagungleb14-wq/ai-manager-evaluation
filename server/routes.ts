import type { Express } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage, type StoredAnalysis } from "./storage.js";
import { transcribeAudio } from "./services/whisper.js";
import { analyzeConversation } from "./services/gemini-analyzer.js";
import { analyzeAdvancedChecklist } from "./services/advanced-gemini-analyzer.js";
import { generateMarkdownReport } from "./services/markdown-generator.js";
import { generatePDFReport } from "./services/pdf-generator.js";
import { parseChecklist, parseAdvancedChecklist, detectChecklistTypeFromFile } from "./services/checklist-parser.js";
import { checklistSchema, analyzeRequestSchema, insertManagerSchema } from "./shared/schema.js";
import { GeminiServiceError } from "./services/gemini-client.js";

// Configure multer for audio uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/m4a",
      "audio/ogg",
      "audio/flac",
    ];
    const allowedExts = [".mp3", ".wav", ".m4a", ".ogg", ".flac"];
    
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();
    
    if (allowedExts.includes(ext) || allowedTypes.includes(mimeType)) {
      cb(null, true);
    } else {
      cb(new Error("Неподдерживаемый формат файла. Используйте MP3, WAV, M4A, OGG или FLAC"));
    }
  },
});

// Configure multer for checklist file uploads
const uploadChecklist = multer({
  storage: multer.memoryStorage(), // Use memory storage for easier file processing
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedExts = [".txt", ".md", ".csv", ".xlsx", ".xls"];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Неподдерживаемый формат файла. Используйте TXT, MD, CSV или XLSX"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<void> {
  // Authentication routes
  
  // POST /api/auth/login - User login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ 
          success: false, 
          message: "Username and password are required" 
        });
      }

      const { authenticateUser } = await import("./services/auth.js");
      const user = await authenticateUser(username, password);

      if (!user) {
        console.log(`[auth] Failed login attempt for username: ${username}`);
        return res.status(401).json({ 
          success: false, 
          message: "Invalid username or password" 
        });
      }

      // Store user info in session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;

      console.log(`[auth] User logged in: ${user.username} (role: ${user.role}, id: ${user.id})`);

      res.json({
        success: true,
        user: {
          id: user.id.toString(),
          username: user.username,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });

  // POST /api/auth/logout - User logout
  app.post("/api/auth/logout", (req, res) => {
    const username = req.session.username;
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ 
          success: false, 
          message: "Logout failed" 
        });
      }
      
      console.log(`[auth] User logged out: ${username}`);
      res.json({ success: true });
    });
  });

  // GET /api/auth/me - Get current user
  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ 
        authenticated: false 
      });
    }

    res.json({
      authenticated: true,
      user: {
        id: req.session.userId.toString(),
        username: req.session.username,
        role: req.session.role,
      },
    });
  });

  // POST /api/transcribe - Транскрибация аудио
  app.post("/api/transcribe", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Файл не загружен" });
      }

      const language = req.body.language || "ru";

      // Transcribe audio
      const result = await transcribeAudio(req.file.path, language);

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      // Format response
      const segments = result.segments || [
        {
          start: 0,
          end: result.duration || 0,
          text: result.text,
        },
      ];

      res.json({
        transcript: {
          segments,
          language: result.language,
          duration: result.duration,
        },
        language: result.language,
      });
    } catch (error) {
      // Clean up file on error
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error("Error deleting file:", e);
        }
      }

      const message = error instanceof Error ? error.message : "Ошибка транскрипции";
      console.error("Transcription error:", message);

      if (error instanceof GeminiServiceError) {
        return res.status(error.statusCode).json({
          error: message,
          code: error.code,
        });
      }

      res.status(500).json({
        error: message,
      });
    }
  });

  // POST /api/analyze - Анализ диалога
  app.post("/api/analyze", async (req, res) => {
    try {
      // Validate entire request body with Zod
      const validatedRequest = analyzeRequestSchema.parse(req.body);
      
      const { transcript, checklist, language = "ru", managerId } = validatedRequest;
      const source = (req.body.source as "call" | "correspondence") || "call";
      const userId = req.session.userId?.toString();

      // Log analysis start with user info
      console.log(`[analysis] User ${req.session.username} (id: ${userId}) starting analysis with checklist: ${checklist.name}`);

      // Extract text from transcript if it's an object
      let textToAnalyze = transcript;
      if (typeof transcript === "object" && "segments" in transcript) {
        textToAnalyze = transcript.segments.map((s) => s.text).join(" ");
      }

      if (!textToAnalyze || typeof textToAnalyze !== "string") {
        return res.status(400).json({ error: "Некорректный формат текста" });
      }

      // Checklist is already validated by analyzeRequestSchema
      const validatedChecklist = checklist;

      // Analyze conversation
      const result = await analyzeConversation(
        textToAnalyze,
        validatedChecklist,
        source,
        language
      );

      // Save analysis to database with managerId and userId
      const analysisId = await storage.saveAnalysis(
        result,
        checklist.id,
        textToAnalyze,
        managerId ?? undefined,
        userId
      );

      console.log(`[analysis] Analysis completed for user ${req.session.username}, saved with ID: ${analysisId}`);

      // Return result with analysis ID
      res.json({
        ...result,
        id: analysisId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка анализа";
      console.error("Analysis error:", message);

      // Return 400 for validation errors, 500 for others
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({
          error: "Некорректные данные запроса",
          details: error.message,
        });
      }

      if (error instanceof GeminiServiceError) {
        return res.status(error.statusCode).json({
          error: message,
          code: error.code,
        });
      }

      res.status(500).json({
        error: message,
      });
    }
  });

  // GET /api/checklists - Получить все чек-листы
  app.get("/api/checklists", async (req, res) => {
    try {
      const checklists = await storage.getChecklists();
      // Add type field for consistency
      const checklistsWithType = checklists.map(c => ({ ...c, type: "simple" as const }));
      res.json(checklistsWithType);
    } catch (error) {
      console.error("Get checklists error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка получения чек-листов",
      });
    }
  });

  // GET /api/checklists/:id - Получить чек-лист по ID
  app.get("/api/checklists/:id", async (req, res) => {
    try {
      const checklist = await storage.getChecklist(req.params.id);
      if (!checklist) {
        return res.status(404).json({ error: "Чек-лист не найден" });
      }
      // Add type field for consistency
      res.json({ ...checklist, type: "simple" as const });
    } catch (error) {
      console.error("Get checklist error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка получения чек-листа",
      });
    }
  });

  // POST /api/checklists - Создать чек-лист
  app.post("/api/checklists", async (req, res) => {
    try {
      const validatedChecklist = checklistSchema.parse(req.body);
      const created = await storage.createChecklist(validatedChecklist);
      res.status(201).json(created);
    } catch (error) {
      console.error("Create checklist error:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Ошибка создания чек-листа",
      });
    }
  });

  // PUT /api/checklists/:id - Обновить чек-лист
  app.put("/api/checklists/:id", async (req, res) => {
    try {
      const validatedChecklist = checklistSchema.parse(req.body);
      const updated = await storage.updateChecklist(req.params.id, validatedChecklist);
      if (!updated) {
        return res.status(404).json({ error: "Чек-лист не найден" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update checklist error:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Ошибка обновления чек-листа",
      });
    }
  });

  // DELETE /api/checklists/:id - Удалить чек-лист
  app.delete("/api/checklists/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteChecklist(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Чек-лист не найден" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete checklist error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка удаления чек-листа",
      });
    }
  });

  // POST /api/checklists/upload - Загрузить и распарсить чек-лист из файла
  app.post("/api/checklists/upload", uploadChecklist.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Файл не загружен" });
      }

      // Detect checklist type
      const checklistType = detectChecklistTypeFromFile(req.file);

      if (checklistType === "advanced") {
        // Parse as advanced checklist
        const checklist = await parseAdvancedChecklist(req.file);
        const created = await storage.createAdvancedChecklist(checklist);
        
        return res.status(201).json({ ...created, type: "advanced" });
      } else {
        // Parse as simple checklist
        const checklist = await parseChecklist(req.file);
        const created = await storage.createChecklist(checklist);
        
        return res.status(201).json({ ...created, type: "simple" });
      }
    } catch (error) {
      console.error("Upload checklist error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка загрузки чек-листа",
      });
    }
  });

  // ============================================
  // Advanced Checklist Routes
  // ============================================

  // GET /api/advanced-checklists - Получить все продвинутые чек-листы
  app.get("/api/advanced-checklists", async (req, res) => {
    try {
      const checklists = await storage.getAdvancedChecklists();
      res.json(checklists);
    } catch (error) {
      console.error("Get advanced checklists error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка получения чек-листов",
      });
    }
  });

  // GET /api/advanced-checklists/:id - Получить продвинутый чек-лист по ID
  app.get("/api/advanced-checklists/:id", async (req, res) => {
    try {
      const checklist = await storage.getAdvancedChecklistWithStages(req.params.id);
      if (!checklist) {
        return res.status(404).json({ error: "Чек-лист не найден" });
      }
      res.json(checklist);
    } catch (error) {
      console.error("Get advanced checklist error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка получения чек-листа",
      });
    }
  });

  // POST /api/advanced-checklists/analyze - Анализ с использованием продвинутого чек-листа
  app.post("/api/advanced-checklists/analyze", async (req, res) => {
    try {
      const { transcript, checklistId, language = "ru", managerId, source = "call" } = req.body;
      const userId = req.session.userId?.toString();

      if (!transcript || !checklistId) {
        return res.status(400).json({ error: "Требуются transcript и checklistId" });
      }

      // Get checklist
      const checklist = await storage.getAdvancedChecklistWithStages(checklistId);
      if (!checklist) {
        return res.status(404).json({ error: "Чек-лист не найден" });
      }

      // Log analysis start with user info
      console.log(`[analysis] User ${req.session.username} (id: ${userId}) starting advanced analysis with checklist: ${checklist.name}`);

      // Extract text from transcript if it's an object
      let textToAnalyze = transcript;
      if (typeof transcript === "object" && "segments" in transcript) {
        textToAnalyze = transcript.segments.map((s: any) => s.text).join(" ");
      }

      // Analyze with advanced checklist
      const result = await analyzeAdvancedChecklist(
        textToAnalyze,
        checklist,
        source,
        language
      );

      // Save analysis with userId
      const analysisId = await storage.saveAdvancedAnalysis(
        result,
        checklistId,
        textToAnalyze,
        managerId,
        source,
        language,
        userId
      );

      console.log(`[analysis] Advanced analysis completed for user ${req.session.username}, saved with ID: ${analysisId}`);

      res.json({
        ...result,
        id: analysisId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка анализа";
      console.error("Advanced analysis error:", message);

      if (error instanceof GeminiServiceError) {
        return res.status(error.statusCode).json({
          error: message,
          code: error.code,
        });
      }

      res.status(500).json({
        error: message,
      });
    }
  });

  // GET /api/advanced-analyses - Получить историю продвинутых анализов (с фильтрацией для обычных пользователей)
  app.get("/api/advanced-analyses", async (req, res) => {
    try {
      const userRole = req.session.role;
      const userId = req.session.userId?.toString();
      
      // Admin can see all analyses, users can only see their own
      const filterUserId = userRole === "admin" ? undefined : userId;
      
      const analyses = await storage.getAllAdvancedAnalyses(filterUserId);
      res.json(analyses);
    } catch (error) {
      console.error("Get advanced analyses error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка получения анализов",
      });
    }
  });

  // GET /api/advanced-analyses/:id - Получить продвинутый анализ по ID
  app.get("/api/advanced-analyses/:id", async (req, res) => {
    try {
      const analysis = await storage.getAdvancedAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Анализ не найден" });
      }
      res.json(analysis);
    } catch (error) {
      console.error("Get advanced analysis error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка получения анализа",
      });
    }
  });

  // GET /api/managers - Получить всех менеджеров
  app.get("/api/managers", async (req, res) => {
    try {
      const managers = await storage.getManagers();
      res.json(managers);
    } catch (error) {
      console.error("Get managers error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка получения менеджеров",
      });
    }
  });

  // GET /api/managers/:id - Получить менеджера по ID
  app.get("/api/managers/:id", async (req, res) => {
    try {
      const manager = await storage.getManager(req.params.id);
      if (!manager) {
        return res.status(404).json({ error: "Менеджер не найден" });
      }
      res.json(manager);
    } catch (error) {
      console.error("Get manager error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка получения менеджера",
      });
    }
  });

  // POST /api/managers - Создать менеджера
  app.post("/api/managers", async (req, res) => {
    try {
      const validatedManager = insertManagerSchema.parse(req.body);
      const created = await storage.createManager(validatedManager);
      res.status(201).json(created);
    } catch (error) {
      console.error("Create manager error:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Ошибка создания менеджера",
      });
    }
  });

  // PUT /api/managers/:id - Обновить менеджера
  app.put("/api/managers/:id", async (req, res) => {
    try {
      const validatedManager = insertManagerSchema.parse(req.body);
      const updated = await storage.updateManager(req.params.id, validatedManager);
      if (!updated) {
        return res.status(404).json({ error: "Менеджер не найден" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update manager error:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Ошибка обновления менеджера",
      });
    }
  });

  // DELETE /api/managers/:id - Удалить менеджера
  app.delete("/api/managers/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteManager(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Менеджер не найден" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete manager error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка удаления менеджера",
      });
    }
  });

  // GET /api/analyses - Получить все анализы (с фильтрацией для обычных пользователей)
  app.get("/api/analyses", async (req, res) => {
    try {
      const userRole = req.session.role;
      const userId = req.session.userId?.toString();
      
      // Admin can see all analyses, users can only see their own
      const filterUserId = userRole === "admin" ? undefined : userId;
      
      const analyses = await storage.getAllAnalyses(filterUserId);
      res.json(analyses);
    } catch (error) {
      console.error("Get analyses error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка получения анализов",
      });
    }
  });

  // DELETE /api/analyses/:id - Удалить анализ
  app.delete("/api/analyses/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAnalysis(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Анализ не найден" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete analysis error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка удаления анализа",
      });
    }
  });

  // GET /api/analyses/:id - Получить анализ по ID
  app.get("/api/analyses/:id", async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Анализ не найден" });
      }
      res.json(analysis);
    } catch (error) {
      console.error("Get analysis error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка получения анализа",
      });
    }
  });

  // GET /api/analyses/:id/markdown - Скачать отчёт в Markdown
  app.get("/api/analyses/:id/markdown", async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Анализ не найден" });
      }

      const markdown = generateMarkdownReport(analysis);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `analysis-${req.params.id}-${timestamp}.md`;

      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(markdown);
    } catch (error) {
      console.error("Download markdown error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка скачивания отчёта",
      });
    }
  });

  // GET /api/analyses/:id/pdf - Скачать отчёт в PDF
  app.get("/api/analyses/:id/pdf", async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Анализ не найден" });
      }

      const doc = generatePDFReport(analysis);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `analysis-${req.params.id}-${timestamp}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      // Pipe PDF document to response, then finalize
      doc.pipe(res);
      doc.end();
    } catch (error) {
      console.error("Download PDF error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка скачивания PDF",
      });
    }
  });

  // GET /api/stats - Получить статистику по анализам
  app.get("/api/stats", async (req, res) => {
    try {
      const analyses = await storage.getAllAnalyses();

      // Подсчитываем статистику
      const totalAnalyses = analyses.length;
      const callAnalyses = analyses.filter((analysis: StoredAnalysis) => analysis.source === "call").length;
      const correspondenceAnalyses = analyses.filter(
        (analysis: StoredAnalysis) => analysis.source === "correspondence",
      ).length;

      // Статистика по языкам
      const languageStats = analyses.reduce<Record<string, number>>((acc, analysis) => {
        const lang = analysis.language || "ru";
        acc[lang] = (acc[lang] ?? 0) + 1;
        return acc;
      }, {});

      // Статистика по менеджерам
      const managerStats = analyses.reduce<Record<string, number>>((acc, analysis) => {
        const managerId = analysis.managerId || "unknown";
        acc[managerId] = (acc[managerId] ?? 0) + 1;
        return acc;
      }, {});

      // Средние показатели по чек-листам
      const avgScores = analyses.reduce<number[]>((acc, analysis) => {
        const { checklistReport } = analysis;
        if (checklistReport?.items?.length) {
          const totalScore = checklistReport.items.reduce((sum: number, item: any) => sum + item.score, 0);
          const avgScore = totalScore / checklistReport.items.length;
          acc.push(avgScore);
        }
        return acc;
      }, []);

      const overallAvgScore = avgScores.length > 0
        ? avgScores.reduce((sum, score) => sum + score, 0) / avgScores.length
        : 0;
      
      // Статистика по датам (последние 30 дней)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentAnalyses = analyses.filter((analysis) =>
        new Date(analysis.analyzedAt) >= thirtyDaysAgo
      ).length;
      
      const stats = {
        totalAnalyses,
        callAnalyses,
        correspondenceAnalyses,
        languageStats,
        managerStats,
        overallAvgScore: Math.round(overallAvgScore * 100) / 100,
        recentAnalyses,
        lastUpdated: new Date().toISOString()
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка получения статистики",
      });
    }
  });

}
