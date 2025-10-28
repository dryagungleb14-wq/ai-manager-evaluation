import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Checklist, ChecklistItemType } from "../shared/schema.js";
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

  const items = raw.items.map((item) => {
    const candidate = item as ChecklistItemLike;
    if (!candidate.id || !candidate.title) {
      throw new Error("Checklist item must have id and title");
    }

    const criteria = candidate.criteria ?? {};
    const rawHint =
      typeof criteria.llm_hint === "string" && criteria.llm_hint.trim().length > 0
        ? criteria.llm_hint.trim()
        : undefined;
    const positivePatterns = normalizePatterns(criteria.positive_patterns);
    const negativePatterns = normalizePatterns(criteria.negative_patterns);

    const normalizedCriteria: Checklist["items"][number]["criteria"] = {
      llm_hint: rawHint ?? "",
      ...(positivePatterns ? { positive_patterns: positivePatterns } : {}),
      ...(negativePatterns ? { negative_patterns: negativePatterns } : {}),
    };

    return {
      id: String(candidate.id),
      title: String(candidate.title),
      type: normalizeType(candidate.type),
      criteria: normalizedCriteria,
      confidence_threshold: normalizeConfidenceThreshold(candidate.confidence_threshold),
    };
  });

  const checklistId = typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id : randomUUID();
  const checklistName = typeof raw.name === "string" && raw.name.trim().length > 0
    ? raw.name
    : typeof raw.title === "string" && raw.title.trim().length > 0
      ? raw.title
      : "Checklist";
  const checklistVersion = typeof raw.version === "string" && raw.version.trim().length > 0 ? raw.version : "1.0";

  return {
    id: checklistId,
    name: checklistName,
    version: checklistVersion,
    items,
  };
}

/**
 * Универсальный парсер чек-листа.
 * Принимает строку/буфер/Express upload/объект и возвращает Checklist.
 */
async function parseTextWithAI(content: string, filename: string): Promise<Checklist> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY не настроен. Для парсинга TXT/MD файлов требуется Gemini API. Используйте CSV или Excel формат, или настройте API ключ.",
    );
  }

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

  const client = getGeminiClient();
  const response = await executeGeminiRequest(() =>
    client.models.generateContent({
      model: "gemini-2.0-flash-exp",
      config: {
        responseMimeType: "application/json",
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
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
        ? parsed.name
        : fallbackName || "Checklist",
    items: Array.isArray(parsed.items)
      ? parsed.items.map((item, index) => ({
          id: (item as ChecklistItemLike)?.id ?? `item-${index + 1}`,
          title: (item as ChecklistItemLike)?.title,
          type: (item as ChecklistItemLike)?.type,
          criteria: (item as ChecklistItemLike)?.criteria,
          confidence_threshold: (item as ChecklistItemLike)?.confidence_threshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
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
