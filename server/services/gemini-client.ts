const DEFAULT_TIMEOUT_MS = 30000;
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 500;
const DEFAULT_API_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_API_VERSION = "v1beta";

type GeminiRole = "user" | "model" | "system";

type GeminiContentPart =
  | { text: string }
  | { inlineData: { data: string; mimeType: string } };

type GeminiContent = {
  role: GeminiRole;
  parts: GeminiContentPart[];
};

interface GeminiContentRequestConfig {
  systemInstruction?: string | GeminiContent;
  responseMimeType?: string;
  responseSchema?: unknown;
}

interface GeminiGenerateContentRequest {
  model: string;
  contents: string | GeminiContent[];
  config?: GeminiContentRequestConfig;
}

interface GeminiApiErrorPayload {
  error?: {
    code?: number;
    status?: string;
    message?: string;
  };
}

export interface GeminiContentResponse {
  text?: string;
  raw?: unknown;
}

class GeminiModelsClient {
  constructor(private readonly apiKey: string) {}

  private resolveBaseUrl(): string {
    const baseUrl = process.env.GEMINI_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
    const version = process.env.GEMINI_API_VERSION?.trim() || DEFAULT_API_VERSION;
    return `${baseUrl.replace(/\/$/, "")}/${version}`;
  }

  private buildUrl(model: string): string {
    const encodedModel = encodeURIComponent(model);
    return `${this.resolveBaseUrl()}/models/${encodedModel}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
  }

  private normalizeContents(contents: string | GeminiContent[]): GeminiContent[] {
    if (Array.isArray(contents)) {
      return contents;
    }

    return [
      {
        role: "user",
        parts: [{ text: contents }],
      },
    ];
  }

  private normalizeSystemInstruction(
    instruction: GeminiContentRequestConfig["systemInstruction"],
  ): GeminiContent | undefined {
    if (!instruction) {
      return undefined;
    }

    if (typeof instruction === "string") {
      return {
        role: "system",
        parts: [{ text: instruction }],
      };
    }

    return instruction;
  }

  private buildGenerationConfig(config?: GeminiContentRequestConfig): Record<string, unknown> | undefined {
    if (!config) {
      return undefined;
    }

    const generationConfig: Record<string, unknown> = {};

    if (config.responseMimeType) {
      generationConfig.response_mime_type = config.responseMimeType;
    }

    if (config.responseSchema) {
      generationConfig.response_schema = config.responseSchema;
    }

    return Object.keys(generationConfig).length > 0 ? generationConfig : undefined;
  }

  private extractText(payload: any): string | undefined {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];

    const parts = candidates
      .flatMap((candidate: any) => candidate?.content?.parts ?? [])
      .filter((part: any) => typeof part?.text === "string")
      .map((part: any) => part.text as string);

    if (parts.length === 0) {
      return undefined;
    }

    return parts.join("\n");
  }

  async generateContent(request: GeminiGenerateContentRequest): Promise<GeminiContentResponse> {
    const body: Record<string, unknown> = {
      contents: this.normalizeContents(request.contents),
    };

    const systemInstruction = this.normalizeSystemInstruction(request.config?.systemInstruction);
    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    const generationConfig = this.buildGenerationConfig(request.config);
    if (generationConfig) {
      body.generationConfig = generationConfig;
    }

    const response = await fetch(this.buildUrl(request.model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorPayload: GeminiApiErrorPayload | undefined;
      try {
        errorPayload = (await response.json()) as GeminiApiErrorPayload;
      } catch {
        errorPayload = undefined;
      }

      const statusCode = response.status || errorPayload?.error?.code || 502;
      const statusText = errorPayload?.error?.status || response.statusText || "Unknown";
      const message = errorPayload?.error?.message || `Gemini API request failed with status ${statusCode}`;

      throw new GeminiServiceError(message, statusCode, statusText.toLowerCase());
    }

    const payload = await response.json();
    return {
      text: this.extractText(payload),
      raw: payload,
    };
  }
}

class GeminiClient {
  public readonly models: GeminiModelsClient;

  constructor(apiKey: string) {
    this.models = new GeminiModelsClient(apiKey);
  }

  generateContent(request: GeminiGenerateContentRequest): Promise<GeminiContentResponse> {
    return this.models.generateContent(request);
  }
}

type GeminiErrorOptions = {
  cause?: unknown;
};

export class GeminiServiceError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  public readonly cause?: unknown;

  constructor(message: string, statusCode: number = 502, code = "gemini_error", options?: GeminiErrorOptions) {
    super(message);
    this.name = "GeminiServiceError";
    this.statusCode = statusCode;
    this.code = code;
    if (options && "cause" in options) {
      this.cause = options.cause;
    }
  }
}

let cachedClient: GeminiClient | undefined;

export function getGeminiClient(): GeminiClient {
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

  cachedClient = new GeminiClient(apiKey);
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

  if (!error || typeof error !== "object") {
    return { message: typeof error === "string" ? error : "Неизвестная ошибка Gemini" };
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

  const message = typeof candidate.message === "string"
    ? candidate.message
    : typeof candidate.error_description === "string"
      ? candidate.error_description
      : "Неизвестная ошибка Gemini";

  return {
    statusCode: Number.isFinite(statusCode) ? statusCode : undefined,
    code,
    message,
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
