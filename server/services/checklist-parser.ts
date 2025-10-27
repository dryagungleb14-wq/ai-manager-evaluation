import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { executeGeminiRequest, getGeminiClient, GeminiServiceError } from "./gemini-client.js";
import type { Checklist, ChecklistItemType } from "../shared/schema.js";

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;
const TEXT_EXTENSIONS = new Set([".txt", ".md"]);
const CSV_EXTENSIONS = new Set([".csv"]);
const EXCEL_EXTENSIONS = new Set([".xlsx", ".xls"]);
const JSON_EXTENSIONS = new Set([".json"]);

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

function isUploadFile(x: unknown): x is UploadFile {
  return !!x && typeof x === "object" && "buffer" in (x as any);
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
    const resolvedId = candidate.id ?? `item-${index + 1}`;

    if (!resolvedId || !candidate.title) {
      throw new Error("Checklist item must have id and title");
    }

    const criteria = candidate.criteria ?? {};
    const llmHint =
      typeof criteria.llm_hint === "string" && criteria.llm_hint.trim().length > 0
        ? criteria.llm_hint.trim()
        : "";
    const positivePatterns = Array.isArray(criteria.positive_patterns)
      ? criteria.positive_patterns.filter((entry): entry is string => typeof entry === "string")
      : undefined;
    const negativePatterns = Array.isArray(criteria.negative_patterns)
      ? criteria.negative_patterns.filter((entry): entry is string => typeof entry === "string")
      : undefined;

    const normalizedCriteria: Checklist["items"][number]["criteria"] = {
      llm_hint: llmHint,
      ...(positivePatterns ? { positive_patterns: positivePatterns } : {}),
      ...(negativePatterns ? { negative_patterns: negativePatterns } : {}),
    };

    return {
      id: String(resolvedId),
      title: String(candidate.title),
      type: normalizeType(candidate.type),
      criteria: normalizedCriteria,
      confidence_threshold:
        typeof candidate.confidence_threshold === "number" && candidate.confidence_threshold >= 0
          ? candidate.confidence_threshold
          : DEFAULT_CONFIDENCE_THRESHOLD,
    };
  });

  const checklistId =
    typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id : "temporary-checklist";
  const checklistName =
    typeof raw.name === "string" && raw.name.trim().length > 0
      ? raw.name
      : typeof raw.title === "string" && raw.title.trim().length > 0
        ? raw.title
        : "Checklist";
  const checklistVersion =
    typeof raw.version === "string" && raw.version.trim().length > 0 ? raw.version : "1.0";

  return {
    id: checklistId,
    name: checklistName,
    version: checklistVersion,
    items,
  };
}

function resolveFilename(file: UploadFile): string {
  if (typeof file.originalname === "string" && file.originalname.trim().length > 0) {
    return file.originalname.trim();
  }
  return "checklist";
}

function ensureBuffer(file: UploadFile): Buffer {
  if (file.buffer && Buffer.isBuffer(file.buffer)) {
    return file.buffer;
  }
  throw new Error("Checklist file has no buffer to read");
}

function buildChecklistFromRows(rows: Array<Record<string, unknown>>, name: string): Checklist {
  const items = rows
    .map((row, index) => {
      const titleCandidate =
        row["Пункт"] ??
        row["Название"] ??
        row["Title"] ??
        row["Item"] ??
        row["пункт"] ??
        row["название"] ??
        row["title"] ??
        row["item"] ??
        "";
      const title = typeof titleCandidate === "string" ? titleCandidate.trim() : "";
      if (!title) {
        return null;
      }

      const typeCandidate =
        row["Тип"] ?? row["Type"] ?? row["тип"] ?? row["type"] ?? row["Requirement"] ?? "recommended";
      const hintCandidate =
        row["Описание"] ??
        row["Description"] ??
        row["LLM Hint"] ??
        row["llm_hint"] ??
        row["описание"] ??
        row["description"] ??
        title;

      return {
        id: row["ID"] ?? row["Id"] ?? row["id"] ?? `item-${index + 1}`,
        title,
        type: typeof typeCandidate === "string" ? typeCandidate.toLowerCase() : typeCandidate,
        criteria: {
          llm_hint: typeof hintCandidate === "string" ? hintCandidate.trim() : String(hintCandidate ?? ""),
          positive_patterns: Array.isArray(row["positive_patterns"]) ? row["positive_patterns"] : [],
          negative_patterns: Array.isArray(row["negative_patterns"]) ? row["negative_patterns"] : [],
        },
        confidence_threshold: DEFAULT_CONFIDENCE_THRESHOLD,
      } satisfies ChecklistItemLike;
    })
    .filter((item): item is ChecklistItemLike => Boolean(item));

  if (items.length === 0) {
    throw new Error("Checklist file does not contain any valid items");
  }

  return normalizeChecklist({
    id: randomUUID(),
    name,
    version: "1.0",
    items,
  });
}

function parseCsvChecklist(content: string, filename: string): Checklist {
  const parsed = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(`Ошибка парсинга CSV: ${parsed.errors[0]?.message ?? "Неизвестная ошибка"}`);
  }

  const rows = Array.isArray(parsed.data) ? parsed.data : [];
  return buildChecklistFromRows(rows, filename.replace(/\.csv$/i, ""));
}

function parseExcelChecklist(buffer: Buffer, filename: string): Checklist {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const [firstSheetName] = workbook.SheetNames;
  if (!firstSheetName) {
    throw new Error("Excel файл не содержит листов");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
  return buildChecklistFromRows(rows, filename.replace(/\.(xlsx?|xls)$/i, ""));
}

async function parseTextChecklist(content: string, filename: string): Promise<Checklist> {
  const client = getGeminiClient();
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
      "id": "уникальный идентификатор",
      "title": "Краткое название пункта",
      "type": "mandatory|recommended|prohibited",
      "criteria": {
        "llm_hint": "Что искать в диалоге",
        "positive_patterns": ["ключевая фраза 1", "ключевая фраза 2"],
        "negative_patterns": ["запрещённая фраза 1"]
      },
      "confidence_threshold": 0.6
    }
  ]
}

ТЕКСТ ЧЕК-ЛИСТА:
${content}

Верни ТОЛЬКО валидный JSON без дополнительных комментариев.`;

  const response = await executeGeminiRequest(() =>
    client.models.generateContent({
      model: "gemini-2.0-flash-exp",
      config: {
        responseMimeType: "application/json",
      },
      contents: prompt,
    })
  );

  const responseText = response.text ?? "";
  if (!responseText) {
    throw new GeminiServiceError("Пустой ответ от Gemini API", 502, "gemini_empty_checklist_response");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(responseText);
  } catch (error) {
    throw new GeminiServiceError(
      "Не удалось обработать ответ от Gemini при разборе чек-листа",
      502,
      "gemini_checklist_parse_error",
      error instanceof Error ? { cause: error } : undefined,
    );
  }

  const normalized = normalizeChecklist({
    id:
      typeof parsed?.id === "string" && parsed.id.trim().length > 0
        ? parsed.id
        : randomUUID(),
    name:
      typeof parsed?.name === "string" && parsed.name.trim().length > 0
        ? parsed.name
        : filename.replace(/\.(txt|md)$/i, ""),
    version:
      typeof parsed?.version === "string" && parsed.version.trim().length > 0
        ? parsed.version
        : "1.0",
    items: Array.isArray(parsed?.items)
      ? parsed.items.map((item: any, index: number) => ({
          id: item?.id ?? `item-${index + 1}`,
          title: item?.title,
          type: item?.type,
          criteria: item?.criteria,
          confidence_threshold: item?.confidence_threshold,
        }))
      : [],
  });

  return normalized;
}

async function parseChecklistFile(file: UploadFile): Promise<Checklist> {
  const filename = resolveFilename(file);
  const extension = path.extname(filename).toLowerCase();
  const buffer = ensureBuffer(file);

  if (buffer.length === 0) {
    throw new Error("Checklist file is empty");
  }

  if (JSON_EXTENSIONS.has(extension) || extension === "") {
    const raw = buffer.toString("utf8");
    const data = safeParseJSON<ChecklistLike>(raw);
    return normalizeChecklist(data);
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return parseTextChecklist(buffer.toString("utf8"), filename);
  }

  if (CSV_EXTENSIONS.has(extension)) {
    return parseCsvChecklist(buffer.toString("utf8"), filename);
  }

  if (EXCEL_EXTENSIONS.has(extension)) {
    return parseExcelChecklist(buffer, filename);
  }

  throw new Error(
    `Неподдерживаемый формат файла: ${extension || "unknown"}. Используйте JSON, TXT, MD, CSV или XLSX`
  );
}

export async function parseChecklist(input: unknown): Promise<Checklist> {
  if (input && typeof input === "object" && !isUploadFile(input)) {
    return normalizeChecklist(input as ChecklistLike);
  }

  if (isUploadFile(input)) {
    return parseChecklistFile(input);
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
