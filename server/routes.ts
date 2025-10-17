import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { transcribeAudio } from "./services/whisper";
import { analyzeConversation } from "./services/gemini-analyzer";
import { generateMarkdownReport } from "./services/markdown-generator";
import { generatePDFReport } from "./services/pdf-generator";
import { parseChecklistFile } from "./services/checklist-parser";
import { checklistSchema, analyzeRequestSchema } from "@shared/schema";

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

export async function registerRoutes(app: Express): Promise<Server> {
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

      console.error("Transcription error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка транскрипции",
      });
    }
  });

  // POST /api/analyze - Анализ диалога
  app.post("/api/analyze", async (req, res) => {
    try {
      // Validate entire request body with Zod
      const validatedRequest = analyzeRequestSchema.parse(req.body);
      
      const { transcript, checklist, language = "ru" } = validatedRequest;
      const source = (req.body.source as "call" | "correspondence") || "call";

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

      // Save analysis to database
      const analysisId = await storage.saveAnalysis(
        result,
        checklist.id,
        textToAnalyze
      );

      // Return result with analysis ID
      res.json({
        ...result,
        id: analysisId,
      });
    } catch (error) {
      console.error("Analysis error:", error);
      
      // Return 400 for validation errors, 500 for others
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({
          error: "Некорректные данные запроса",
          details: error.message,
        });
      }
      
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка анализа",
      });
    }
  });

  // GET /api/checklists - Получить все чек-листы
  app.get("/api/checklists", async (req, res) => {
    try {
      const checklists = await storage.getChecklists();
      res.json(checklists);
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
      res.json(checklist);
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

      // Parse checklist from file
      const result = await parseChecklistFile(req.file);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      if (!result.checklist) {
        return res.status(500).json({ error: "Не удалось создать чек-лист" });
      }

      // Save parsed checklist to database
      const created = await storage.createChecklist(result.checklist);
      
      res.status(201).json(created);
    } catch (error) {
      console.error("Upload checklist error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка загрузки чек-листа",
      });
    }
  });

  // GET /api/analyses - Получить все анализы
  app.get("/api/analyses", async (req, res) => {
    try {
      const analyses = await storage.getAllAnalyses();
      res.json(analyses);
    } catch (error) {
      console.error("Get analyses error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Ошибка получения анализов",
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

  const httpServer = createServer(app);

  return httpServer;
}
