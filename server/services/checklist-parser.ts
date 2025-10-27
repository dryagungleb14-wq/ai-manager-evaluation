// server/services/checklist-parser.ts
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import type { Checklist, ChecklistItem } from "../shared/schema.js";

type UploadFile = Express.Multer.File | { originalname?: string; buffer?: Buffer };

function isUploadFile(x: unknown): x is UploadFile {
  // достаточно признаков для Express upload
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

function normalizeChecklistItem(raw: any, index: number): ChecklistItem {
  if (!raw || (!raw.id && !raw.title)) {
    throw new Error("Checklist item must have id and title");
  }

  const id = raw.id ? String(raw.id) : `item-${index + 1}`;
  const title = raw.title ? String(raw.title) : `Item ${index + 1}`;
  const type = raw.type === "mandatory" || raw.type === "prohibited" ? raw.type : "recommended";
  const criteria = raw.criteria ?? {};
  const llmHint = typeof criteria.llm_hint === "string" ? criteria.llm_hint : title;

  return {
    id,
    title,
    type,
    criteria: {
      llm_hint: llmHint,
      positive_patterns: Array.isArray(criteria.positive_patterns) ? criteria.positive_patterns : undefined,
      negative_patterns: Array.isArray(criteria.negative_patterns) ? criteria.negative_patterns : undefined,
    },
    confidence_threshold:
      typeof raw.confidence_threshold === "number" ? raw.confidence_threshold : 0.5,
  } satisfies ChecklistItem;
}

/**
 * Универсальный парсер чек-листа.
 * Принимает строку/буфер/Express upload/объект и возвращает Checklist.
 */
export function parseChecklist(input: unknown): Checklist {
  if (input && typeof input === "object" && !isUploadFile(input)) {
    return input as Checklist;
  }

  const str = toStringInput(input);
  if (!str) throw new Error("Checklist input is empty");

  const data = safeParseJSON<any>(str);
  if (!data || !Array.isArray(data.items)) {
    throw new Error("Checklist JSON must contain items[]");
  }

  const name = data.name ?? data.title ?? "Checklist";
  const id = data.id ? String(data.id) : `upload-${randomUUID()}`;
  const version = data.version ? String(data.version) : "1.0";

  const items = data.items.map((item: any, index: number) => normalizeChecklistItem(item, index));

  return {
    id,
    name: String(name),
    version,
    items,
  } satisfies Checklist;
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
