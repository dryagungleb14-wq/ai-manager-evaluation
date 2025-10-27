import type { Request } from "express";
import type { Checklist } from "../shared/schema.js";

type UploadFile = Express.Multer.File | { originalname?: string; buffer?: Buffer };

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

/** Универсальный парсер чек-листа. */
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
  for (const it of data.items) {
    if (!it.id || !it.title) throw new Error("Checklist item must have id and title");
  }

  return {
    title: data.title ?? "Checklist",
    items: data.items.map((it: any) => ({
      id: String(it.id),
      title: String(it.title),
      type: it.type ?? "recommended",
      criteria: it.criteria ?? {},
      confidence_threshold: it.confidence_threshold ?? 0.5,
      llm_hint: it.llm_hint ?? undefined,
      positive_patterns: Array.isArray(it.positive_patterns) ? it.positive_patterns : undefined,
      negative_patterns: Array.isArray(it.negative_patterns) ? it.negative_patterns : undefined
    }))
  } as unknown as Checklist;
}

/** Хелпер для Express-роутов: берёт файл из req и парсит. */
export function parseChecklistFromRequest(req: Request): Checklist {
  const file = (req as any).file as UploadFile | undefined;
  const body = (req as any).body?.checklist as string | undefined;
  if (file) return parseChecklist(file);
  if (body) return parseChecklist(body);
  throw new Error("Checklist not provided (file or body.checklist)");
}
