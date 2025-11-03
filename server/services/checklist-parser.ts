import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Checklist, ChecklistItemType, AdvancedChecklist, ChecklistStage, ChecklistCriterion, CriterionLevel } from "../shared/schema.js";
import { executeGeminiRequest, getGeminiClient } from "./gemini-client.js";

type UploadFile = Express.Multer.File | { originalname?: string; buffer?: Buffer };

type ChecklistLike = {
  id?: unknown;
  name?: unknown;
  title?: unknown;
  version?: unknown;
  items?: unknown;
};

type ChecklistItemLike = {
  id?: unknown;
  title?: unknown;
  type?: unknown;
  criteria?: {
    llm_hint?: unknown;
    positive_patterns?: unknown;
    negative_patterns?: unknown;
  };
  confidence_threshold?: unknown;
};

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

const TEXTUAL_EXTENSIONS = new Set([".txt", ".md"]);
const CSV_EXTENSIONS = new Set([".csv"]); 
const EXCEL_EXTENSIONS = new Set([".xlsx", ".xls"]);

function normalizeConfidenceThreshold(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_CONFIDENCE_THRESHOLD;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizePatterns(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function isUploadFile(x: unknown): x is UploadFile {
  return !!x && typeof x === "object" && ("buffer" in (x as any));
}

function toStringInput(input: unknown): string | null {
  if (typeof input === "string") return input;
  if (Buffer.isBuffer(input)) return input.toString("utf8");
  if (isUploadFile(input) && input.buffer) return input.buffer.toString("utf8");
  return null;
}

function safeParseJSON<T = unknown>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("Invalid checklist JSON");
  }
}

function normalizeType(value: unknown): ChecklistItemType {
  const allowed: ChecklistItemType[] = ["mandatory", "recommended", "prohibited"];
  if (typeof value === "string" && allowed.includes(value as ChecklistItemType)) {
    return value as ChecklistItemType;
  }
  return "recommended";
}

function normalizeChecklist(raw: ChecklistLike): Checklist {
  if (!raw.items || !Array.isArray(raw.items)) {
    throw new Error("Checklist JSON must contain items[]");
  }

  const items = raw.items.map((item, index) => {
    const candidate = item as ChecklistItemLike;
    const idCandidate = typeof candidate.id === "string" ? candidate.id.trim() : `item-${index + 1}`;
    const titleCandidate = typeof candidate.title === "string" ? candidate.title.trim() : "";

    if (!idCandidate) {
      throw new Error(`Checklist item at index ${index} has empty id after normalization`);
    }

    if (!titleCandidate) {
      throw new Error(`Checklist item ${idCandidate} has empty title after normalization`);
    }

    const criteria = candidate.criteria ?? {};
    const rawHint =
      typeof criteria.llm_hint === "string" && criteria.llm_hint.trim().length > 0
        ? criteria.llm_hint.trim()
        : undefined;
    const positivePatterns = normalizePatterns(criteria.positive_patterns);
    const negativePatterns = normalizePatterns(criteria.negative_patterns);

    const normalizedCriteria: Checklist["items"][number]["criteria"] = {
      llm_hint: rawHint ?? titleCandidate,
      ...(positivePatterns ? { positive_patterns: positivePatterns } : {}),
      ...(negativePatterns ? { negative_patterns: negativePatterns } : {}),
    };

    return {
      id: idCandidate,
      title: titleCandidate,
      type: normalizeType(candidate.type),
      criteria: normalizedCriteria,
      confidence_threshold: normalizeConfidenceThreshold(candidate.confidence_threshold),
    };
  });

  const nameCandidate = typeof raw.name === "string" ? raw.name.trim() : "";
  const versionCandidate = typeof raw.version === "string" ? raw.version.trim() : "";
  const idCandidate = typeof raw.id === "string" ? raw.id.trim() : "";

  return {
    id: idCandidate || randomUUID(),
    name: nameCandidate || "Checklist",
    version: versionCandidate || "1.0",
    items,
  };
}

async function parseTextWithAI(content: string, filename: string): Promise<Checklist> {
  const geminiClient = getGeminiClient();

  const prompt = `Ты эксперт по анализу чек-листов для оценки работы менеджеров.

Проанализируй следующий текст чек-листа и преобразуй его в структурированный JSON формат.

ПРАВИЛА ОПРЕДЕЛЕНИЯ ТИПОВ:
- "mandatory" (обязательный) - если пункт описывает что менеджер ДОЛЖЕН/ОБЯЗАН сделать
- "recommended" (рекомендуемый) - если пункт описывает что ЖЕЛАТЕЛЬНО/РЕКОМЕНДУЕТСЯ делать
- "prohibited" (запрещённый) - если пункт описывает что НЕЛЬЗЯ/ЗАПРЕЩЕНО делать

ПРАВИЛА СОЗДАНИЯ КРИТЕРИЕВ:
- llm_hint - краткое описание что искать (1-2 предложения)
- positive_patterns - ключевые фразы которые указывают на выполнение (опционально)
- negative_patterns - фразы которые указывают на нарушение (опционально)

ФОРМАТ ОТВЕТА (строгий JSON):
{
  "name": "Название чек-листа",
  "items": [
    {
      "title": "Краткое название пункта",
      "type": "mandatory|recommended|prohibited",
      "criteria": {
        "llm_hint": "Что искать в диалоге",
        "positive_patterns": ["ключевая фраза 1", "ключевая фраза 2"],
        "negative_patterns": ["запрещённая фраза 1"]
      }
    }
  ]
}

ТЕКСТ ЧЕК-ЛИСТА:
${content}

Верни ТОЛЬКО валидный JSON без дополнительных комментариев.`;

  const response = await executeGeminiRequest(() =>
    geminiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: { responseMimeType: "application/json" },
    }),
  );

  const responseText = response.text;
  if (!responseText) {
    throw new Error("Gemini вернул пустой ответ при парсинге чек-листа");
  }

  let parsed: ChecklistLike;
  try {
    parsed = safeParseJSON<ChecklistLike>(responseText);
  } catch (error) {
    throw new Error(
      `Ошибка AI-парсинга: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
    );
  }

  const fallbackName = filename.replace(/\.(txt|md)$/i, "");
  const checklistLike: ChecklistLike = {
    ...parsed,
    name:
      typeof parsed.name === "string" && parsed.name.trim().length > 0
        ? parsed.name.trim()
        : fallbackName || "Checklist",
    version:
      typeof parsed.version === "string" && parsed.version.trim().length > 0
        ? parsed.version.trim()
        : "1.0",
    items: Array.isArray(parsed.items)
      ? parsed.items.map((item, index) => ({
          id: (item as ChecklistItemLike)?.id ?? `item-${index + 1}`,
          title: (item as ChecklistItemLike)?.title,
          type: (item as ChecklistItemLike)?.type,
          criteria: (item as ChecklistItemLike)?.criteria,
          confidence_threshold:
            (item as ChecklistItemLike)?.confidence_threshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
        }))
      : [],
  };

  return normalizeChecklist(checklistLike);
}

function parseCSV(content: string, filename: string): Checklist {
  const result = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    throw new Error(`Ошибка парсинга CSV: ${result.errors[0].message}`);
  }

  const items = result.data.reduce<ChecklistItemLike[]>((acc, row, index) => {
    const rawTitle =
      (row["Пункт"] as string) ||
      (row["Название"] as string) ||
      (row["Title"] as string) ||
      (row["Item"] as string) ||
      (row["пункт"] as string) ||
      "";
    const title = typeof rawTitle === "string" ? rawTitle.trim() : "";

    if (!title) {
      return acc;
    }

    const typeRaw =
      ((row["Тип"] as string) || row["Type"] || row["тип"])?.toString().trim() ||
      "mandatory";

    const rawHint =
      (row["Описание"] as string) ||
      (row["Description"] as string) ||
      (row["LLM Hint"] as string) ||
      (row["описание"] as string) ||
      "";
    const hint = rawHint ? rawHint.toString().trim() : "";

    acc.push({
      id: `item-${index + 1}`,
      title,
      type: typeRaw,
      criteria: {
        llm_hint: hint || title,
        positive_patterns: [],
        negative_patterns: [],
      },
      confidence_threshold: DEFAULT_CONFIDENCE_THRESHOLD,
    });

    return acc;
  }, []);

  const checklistLike: ChecklistLike = {
    name: filename.replace(/\.csv$/i, ""),
    version: "1.0",
    items,
  };

  return normalizeChecklist(checklistLike);
}

function parseExcel(buffer: Buffer, filename: string): Checklist {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);

  const items = data.reduce<ChecklistItemLike[]>((acc, row, index) => {
    const rawTitle =
      (row["Пункт"] as string) ||
      (row["Название"] as string) ||
      (row["Title"] as string) ||
      (row["Item"] as string) ||
      "";
    const title = typeof rawTitle === "string" ? rawTitle.trim() : "";

    if (!title) {
      return acc;
    }

    const typeRaw = ((row["Тип"] as string) || row["Type"])?.toString().trim() || "mandatory";

    const rawHint =
      (row["Описание"] as string) ||
      (row["Description"] as string) ||
      (row["LLM Hint"] as string) ||
      "";
    const hint = rawHint ? rawHint.toString().trim() : "";

    acc.push({
      id: `item-${index + 1}`,
      title,
      type: typeRaw,
      criteria: {
        llm_hint: hint || title,
        positive_patterns: [],
        negative_patterns: [],
      },
      confidence_threshold: DEFAULT_CONFIDENCE_THRESHOLD,
    });

    return acc;
  }, []);

  const checklistLike: ChecklistLike = {
    name: filename.replace(/\.(xlsx?|xls)$/i, ""),
    version: "1.0",
    items,
  };

  return normalizeChecklist(checklistLike);
}

async function parseUploadFile(file: UploadFile): Promise<Checklist> {
  if (!file || !file.buffer) {
    throw new Error("Checklist file buffer is empty");
  }

  const filename = file.originalname ?? "checklist";
  const ext = path.extname(filename).toLowerCase();

  if (TEXTUAL_EXTENSIONS.has(ext)) {
    const content = file.buffer.toString("utf8");
    return parseTextWithAI(content, filename);
  }

  if (CSV_EXTENSIONS.has(ext)) {
    const content = file.buffer.toString("utf8");
    return parseCSV(content, filename);
  }

  if (EXCEL_EXTENSIONS.has(ext)) {
    return parseExcel(file.buffer, filename);
  }

  const stringContent = file.buffer.toString("utf8");
  const raw = safeParseJSON<ChecklistLike>(stringContent);
  return normalizeChecklist(raw);
}

export async function parseChecklist(input: unknown): Promise<Checklist> {
  if (isUploadFile(input)) {
    return parseUploadFile(input);
  }

  if (input && typeof input === "object") {
    return normalizeChecklist(input as ChecklistLike);
  }

  const str = toStringInput(input);
  if (!str) throw new Error("Checklist input is empty");

  const data = safeParseJSON<ChecklistLike>(str);
  return normalizeChecklist(data);
}

export async function parseChecklistFromRequest(req: Request): Promise<Checklist> {
  const file = (req as any).file as UploadFile | undefined;
  const body = (req as any).body?.checklist as string | undefined;
  if (file) return parseChecklist(file);
  if (body) return parseChecklist(body);
  throw new Error("Checklist not provided (file or body.checklist)");
}

// ============================================
// Advanced Checklist Parsing
// ============================================

export function detectChecklistType(headers: string[]): "simple" | "advanced" {
  const hasStages = headers.some(h => 
    h.toLowerCase().includes("этап") || 
    h.toLowerCase().includes("stage")
  );
  const hasLevels = headers.some(h => 
    h.includes("MAX") || 
    h.includes("MID") || 
    h.includes("MIN")
  );
  
  return (hasStages || hasLevels) ? "advanced" : "simple";
}

function parseAdvancedExcel(buffer: Buffer, filename: string): AdvancedChecklist {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
  
  if (rows.length === 0) {
    throw new Error("Excel file is empty");
  }
  
  const stages = new Map<string, ChecklistCriterion[]>();
  let totalScore = 0;
  
  for (const row of rows) {
    const stageName = row["Этап"] || row["Stage"] || "Общие";
    const criterionNumber = row["№"] || row[""] || "";
    const description = row["Описание этапа"] || row["Description"] || "";
    const weight = Number(row["Балл"]) || 0;
    
    const criterion: ChecklistCriterion = {
      id: `criterion-${criterionNumber || randomUUID()}`,
      number: String(criterionNumber),
      title: description.substring(0, 50) || criterionNumber,
      description,
      weight,
    };
    
    // Parse MAX/MID/MIN levels
    if (row["MAX Критерий"] || row["MAX"]) {
      const maxDesc = row["MAX Критерий"] || row["MAX"] || "";
      const maxScore = Number(row["Балл__1"]) || weight;
      if (maxDesc) {
        criterion.max = {
          description: maxDesc,
          score: maxScore,
        };
      }
    }
    
    if (row["MID Критерий"] || row["MID"]) {
      const midDesc = row["MID Критерий"] || row["MID"] || "";
      const midScore = Number(row["Балл__2"]) || Math.floor(weight / 2);
      if (midDesc) {
        criterion.mid = {
          description: midDesc,
          score: midScore,
        };
      }
    }
    
    if (row["MIN Критерий"] || row["MIN"]) {
      const minDesc = row["MIN Критерий"] || row["MIN"] || "";
      const minScore = Number(row["Балл__3"]) || 0;
      if (minDesc) {
        criterion.min = {
          description: minDesc,
          score: minScore,
        };
      }
    }
    
    // Group by stages
    if (!stages.has(stageName)) {
      stages.set(stageName, []);
    }
    stages.get(stageName)!.push(criterion);
    totalScore += weight;
  }
  
  // Form the structure
  const checklistStages: ChecklistStage[] = Array.from(stages.entries()).map(
    ([name, criteria], index) => ({
      id: `stage-${index}`,
      name,
      order: index,
      criteria,
    })
  );
  
  return {
    id: randomUUID(),
    name: filename.replace(/\.(xlsx?|csv)$/i, ""),
    version: "1.0",
    type: "advanced",
    totalScore,
    stages: checklistStages,
  };
}

async function parseAdvancedTextWithAI(content: string, filename: string): Promise<AdvancedChecklist> {
  const geminiClient = getGeminiClient();
  
  const prompt = `Ты эксперт по анализу чек-листов. Преобразуй этот чек-лист в JSON.

СТРУКТУРА:
{
  "name": "Название",
  "totalScore": 100,
  "stages": [
    {
      "name": "Этап 1",
      "criteria": [
        {
          "number": "1.1",
          "title": "Краткое название",
          "description": "Полное описание",
          "weight": 5,
          "max": { "description": "Идеально выполнено", "score": 5 },
          "mid": { "description": "Средне", "score": 2 },
          "min": { "description": "Плохо", "score": 0 }
        }
      ]
    }
  ]
}

ЧЕК-ЛИСТ:
${content}

Верни ТОЛЬКО валидный JSON без дополнительных комментариев.`;

  const response = await executeGeminiRequest(() =>
    geminiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: { responseMimeType: "application/json" },
    }),
  );
  
  const responseText = response.text;
  if (!responseText) {
    throw new Error("Gemini вернул пустой ответ при парсинге чек-листа");
  }
  
  const parsed = safeParseJSON<any>(responseText);
  return {
    id: randomUUID(),
    type: "advanced",
    name: parsed.name || filename.replace(/\.(txt|md)$/i, ""),
    version: parsed.version || "1.0",
    totalScore: parsed.totalScore || 100,
    stages: parsed.stages || [],
  };
}

export async function parseAdvancedChecklist(file: UploadFile): Promise<AdvancedChecklist> {
  if (!file || !file.buffer) {
    throw new Error("Advanced checklist file buffer is empty");
  }

  const filename = file.originalname ?? "checklist";
  const ext = path.extname(filename).toLowerCase();

  if (TEXTUAL_EXTENSIONS.has(ext)) {
    const content = file.buffer.toString("utf8");
    return parseAdvancedTextWithAI(content, filename);
  }

  if (EXCEL_EXTENSIONS.has(ext) || CSV_EXTENSIONS.has(ext)) {
    return parseAdvancedExcel(file.buffer, filename);
  }

  throw new Error("Unsupported file format for advanced checklist");
}

export function detectChecklistTypeFromFile(file: UploadFile): "simple" | "advanced" {
  if (!file || !file.buffer) {
    return "simple";
  }

  const filename = file.originalname ?? "checklist";
  const ext = path.extname(filename).toLowerCase();

  // Text files require AI analysis, default to simple unless we parse them
  if (TEXTUAL_EXTENSIONS.has(ext)) {
    return "simple"; // Will be determined after parsing
  }

  // For Excel/CSV, check headers
  if (EXCEL_EXTENSIONS.has(ext) || CSV_EXTENSIONS.has(ext)) {
    try {
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
      
      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        return detectChecklistType(headers);
      }
    } catch (error) {
      console.error("Error detecting checklist type:", error);
    }
  }

  return "simple";
}
