import type { Request } from "express";
import type { Checklist, ChecklistItemType } from "../shared/schema.js";

type UploadFile = Express.Multer.File | { originalname?: string; buffer?: Buffer };

type RawChecklistItem = {
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

type RawChecklist = {
  id?: unknown;
  name?: unknown;
  title?: unknown;
  version?: unknown;
  items?: unknown;
};

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

function normalizeChecklist(raw: RawChecklist): Checklist {
  if (!raw.items || !Array.isArray(raw.items)) {
    throw new Error("Checklist JSON must contain items[]");
  }

  const items = raw.items.map((item) => {
    const rawItem = item as RawChecklistItem;
    if (!rawItem.id || !rawItem.title) {
      throw new Error("Checklist item must have id and title");
    }

    const rawCriteria = rawItem.criteria ?? {};
    const llmHint = typeof rawCriteria.llm_hint === "string" && rawCriteria.llm_hint.trim().length > 0
      ? rawCriteria.llm_hint
      : "";
    const positivePatterns = Array.isArray(rawCriteria.positive_patterns)
      ? rawCriteria.positive_patterns.filter((entry): entry is string => typeof entry === "string")
      : undefined;
    const negativePatterns = Array.isArray(rawCriteria.negative_patterns)
      ? rawCriteria.negative_patterns.filter((entry): entry is string => typeof entry === "string")
      : undefined;

    return {
      id: String(rawItem.id),
      title: String(rawItem.title),
      type: normalizeType(rawItem.type),
      criteria: {
        llm_hint: llmHint,
        ...(positivePatterns ? { positive_patterns: positivePatterns } : {}),
        ...(negativePatterns ? { negative_patterns: negativePatterns } : {}),
      },
      confidence_threshold:
        typeof rawItem.confidence_threshold === "number" && rawItem.confidence_threshold >= 0
          ? rawItem.confidence_threshold
          : 0.6,
    };
  });

  const checklistId = typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id : "temporary-checklist";
  const nameCandidate = typeof raw.name === "string" && raw.name.trim().length > 0 ? raw.name : undefined;
  const titleCandidate = typeof raw.title === "string" && raw.title.trim().length > 0 ? raw.title : undefined;

  return {
    id: checklistId,
    name: nameCandidate ?? titleCandidate ?? "Checklist",
    version: typeof raw.version === "string" && raw.version.trim().length > 0 ? raw.version : "1.0",
    items,
  };
}

/** Универсальный парсер чек-листа. */
export function parseChecklist(input: unknown): Checklist {
  if (input && typeof input === "object" && !isUploadFile(input)) {
    return normalizeChecklist(input as RawChecklist);
  }
  const str = toStringInput(input);
  if (!str) throw new Error("Checklist input is empty");

  const data = safeParseJSON<RawChecklist>(str);
  return normalizeChecklist(data);
}

/** Хелпер для Express-роутов: берёт файл из req и парсит. */
export function parseChecklistFromRequest(req: Request): Checklist {
  const file = (req as any).file as UploadFile | undefined;
  const body = (req as any).body?.checklist as string | undefined;
  if (file) return parseChecklist(file);
  if (body) return parseChecklist(body);
  throw new Error("Checklist not provided (file or body.checklist)");
}
