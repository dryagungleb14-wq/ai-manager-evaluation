import { GoogleGenAI } from "@google/genai";

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 500;

export class GeminiServiceError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 502, code = "gemini_error", options?: ErrorOptions) {
    super(message, options);
    this.name = "GeminiServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

let cachedClient: GoogleGenAI | undefined;

export function getGeminiClient(): GoogleGenAI {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new GeminiServiceError(
      "GEMINI_API_KEY не настроен. Добавьте ключ Gemini в переменные окружения.",
      503,
      "gemini_missing_api_key",
    );
  }

  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

interface NormalizedGeminiError {
  statusCode?: number;
  code?: string;
  message: string;
}

function resolveTimeoutMs(): number {
  const raw = process.env.GEMINI_TIMEOUT_MS?.trim();
  if (!raw) {
    return DEFAULT_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function normalizeGeminiError(error: unknown): NormalizedGeminiError {
  if (error instanceof GeminiServiceError) {
    return { statusCode: error.statusCode, code: error.code, message: error.message };
  }

  const fallbackMessage =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Неизвестная ошибка Gemini";

  if (!error || typeof error !== "object") {
    return { message: fallbackMessage };
  }

  const candidate = error as Record<string, unknown>;
  const statusCandidate = candidate.status ?? candidate.statusCode;
  const statusCode = typeof statusCandidate === "number"
    ? statusCandidate
    : typeof statusCandidate === "string"
      ? Number.parseInt(statusCandidate, 10)
      : undefined;
  const code = typeof candidate.code === "string"
    ? candidate.code
    : typeof candidate.error === "string"
      ? candidate.error
      : undefined;

  return {
    statusCode: Number.isFinite(statusCode) ? statusCode : undefined,
    code,
    message: fallbackMessage,
  };
}

function isRetryableStatus(statusCode?: number): boolean {
  if (!statusCode) {
    return false;
  }

  return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

function mapRetryableStatus(statusCode?: number): number {
  if (!statusCode) {
    return 503;
  }

  if (statusCode === 429 || statusCode === 503) {
    return 503;
  }

  if (statusCode >= 500) {
    return 502;
  }

  return statusCode;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new GeminiServiceError("Превышено время ожидания ответа от Gemini", 503, "gemini_timeout"));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function executeGeminiRequest<T>(operation: () => Promise<T>): Promise<T> {
  const timeoutMs = resolveTimeoutMs();
  let attempt = 0;
  let lastError: unknown;

  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;

    try {
      return await withTimeout(operation(), timeoutMs);
    } catch (error) {
      lastError = error;
      const details = normalizeGeminiError(error);
      const { statusCode, code, message } = details;
      const shouldRetry = isRetryableStatus(statusCode);
      const logMessage = `[Gemini] попытка ${attempt} не удалась${statusCode ? ` (${statusCode})` : ""}: ${message}`;

      if (shouldRetry) {
        console.warn(logMessage);
      } else {
        console.error(logMessage);
      }

      if (shouldRetry && attempt < MAX_ATTEMPTS) {
        const backoffMs = Math.pow(2, attempt - 1) * BACKOFF_BASE_MS;
        await delay(backoffMs);
        continue;
      }

      if (error instanceof GeminiServiceError) {
        throw error;
      }

      if (shouldRetry) {
        throw new GeminiServiceError(
          "Сервис Gemini временно недоступен. Попробуйте позже.",
          mapRetryableStatus(statusCode),
          code ?? "gemini_unavailable",
          error instanceof Error ? { cause: error } : undefined,
        );
      }

      throw new GeminiServiceError(
        message || "Не удалось выполнить запрос к Gemini",
        statusCode ?? 502,
        code ?? "gemini_error",
        error instanceof Error ? { cause: error } : undefined,
      );
    }
  }

  throw new GeminiServiceError(
    "Сервис Gemini временно недоступен. Попробуйте позже.",
    503,
    "gemini_unavailable",
    lastError instanceof Error ? { cause: lastError } : undefined,
  );
}
