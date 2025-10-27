import type { Request } from "express";
import type { Checklist, ChecklistItemType } from "../shared/schema.js";

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
    const llmHint = typeof criteria.llm_hint === "string" && criteria.llm_hint.trim().length > 0 ? criteria.llm_hint : "";
    const positivePatterns = Array.isArray(criteria.positive_patterns)
      ? criteria.positive_patterns.filter((entry): entry is string => typeof entry === "string")
      : undefined;
    const negativePatterns = Array.isArray(criteria.negative_patterns)
      ? criteria.negative_patterns.filter((entry): entry is string => typeof entry === "string")
      : undefined;

    return {
      id: String(candidate.id),
      title: String(candidate.title),
      type: normalizeType(candidate.type),
      criteria: {
        llm_hint: llmHint,
        ...(positivePatterns ? { positive_patterns: positivePatterns } : {}),
        ...(negativePatterns ? { negative_patterns: negativePatterns } : {}),
      },
      confidence_threshold:
        typeof candidate.confidence_threshold === "number" && candidate.confidence_threshold >= 0
          ? candidate.confidence_threshold
          : 0.6,
    };
  });

  const checklistId = typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id : "temporary-checklist";
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
export function parseChecklist(input: unknown): Checklist {
  if (input && typeof input === "object" && !isUploadFile(input)) {
    return normalizeChecklist(input as ChecklistLike);
  }
  const str = toStringInput(input);
  if (!str) throw new Error("Checklist input is empty");

  const data = safeParseJSON<ChecklistLike>(str);
  return normalizeChecklist(data);
}

/**
 * Хелпер для Express-роутов: берёт файл из req и парсит.
 */
export function parseChecklistFromRequest(req: Request): Checklist {
  const file = (req as any).file as UploadFile | undefined;
  const body = (req as any).body?.checklist as string | undefined;
  if (file) return parseChecklist(file);
  if (body) return parseChecklist(body);
  throw new Error("Checklist not provided (file or body.checklist)");
}
