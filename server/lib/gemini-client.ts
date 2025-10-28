import { URLSearchParams } from "node:url";

type GeminiRole = "user" | "model" | "assistant" | "system";

type GeminiContentPart = {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
};

type GeminiContent = {
  role?: GeminiRole;
  parts?: GeminiContentPart[];
};

type GeminiContentsInput = string | GeminiContent | Array<string | GeminiContent>;

type GeminiSafetySetting = {
  category: string;
  threshold: string;
};

type GeminiGenerationConfig = Record<string, unknown> & {
  responseMimeType?: string;
};

type GeminiResponseSchema = Record<string, unknown>;

type GeminiGenerateContentOptions = {
  model: string;
  contents: GeminiContentsInput;
  systemInstruction?: string | GeminiContent;
  generationConfig?: GeminiGenerationConfig;
  responseMimeType?: string;
  responseSchema?: GeminiResponseSchema;
  safetySettings?: GeminiSafetySetting[];
};

type GeminiCandidate = {
  content?: GeminiContent & { parts?: GeminiContentPart[] };
};

type GeminiResponsePayload = {
  candidates?: GeminiCandidate[];
};

export type GeminiGenerateContentResult = {
  text: string;
  raw: GeminiResponsePayload;
};

function normaliseContent(value: string | GeminiContent): GeminiContent {
  if (typeof value === "string") {
    return {
      role: "user",
      parts: [{ text: value }],
    };
  }

  if (!value.parts || value.parts.length === 0) {
    return {
      role: value.role ?? "user",
      parts: [{ text: "" }],
    };
  }

  return {
    role: value.role ?? "user",
    parts: value.parts,
  };
}

function normaliseContents(contents: GeminiContentsInput): GeminiContent[] {
  if (Array.isArray(contents)) {
    return contents.map((item) => normaliseContent(item));
  }

  return [normaliseContent(contents)];
}

function buildRequestBody(options: GeminiGenerateContentOptions) {
  const contents = normaliseContents(options.contents);

  const body: Record<string, unknown> = {
    contents,
  };

  if (options.systemInstruction) {
    body.systemInstruction = normaliseContent(options.systemInstruction);
  }

  const generationConfig: GeminiGenerationConfig = {
    ...(options.generationConfig ?? {}),
  };

  if (options.responseMimeType) {
    generationConfig.responseMimeType = options.responseMimeType;
  }

  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig;
  }

  if (options.responseSchema) {
    body.responseSchema = options.responseSchema;
  }

  if (options.safetySettings) {
    body.safetySettings = options.safetySettings;
  }

  return body;
}

function extractTextFromResponse(payload: GeminiResponsePayload): string {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];

  const parts = candidates.flatMap((candidate) => {
    const candidateParts = candidate.content?.parts;
    if (!candidateParts) {
      return [] as string[];
    }

    return candidateParts
      .map((part) => part?.text ?? "")
      .filter((value): value is string => Boolean(value && value.trim().length > 0));
  });

  return parts.join("\n").trim();
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.clone().json();
    return JSON.stringify(data);
  } catch {
    try {
      return await response.clone().text();
    } catch {
      return "Unknown error";
    }
  }
}

export class GeminiClient {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(apiKey: string | undefined, fetchImpl: typeof fetch = fetch) {
    this.apiKey = apiKey?.trim() ?? "";
    this.fetchImpl = fetchImpl;
  }

  async generateContent(options: GeminiGenerateContentOptions): Promise<GeminiGenerateContentResult> {
    if (!this.apiKey) {
      throw new Error(
        "GEMINI_API_KEY не настроен. Укажите ключ в переменной окружения GEMINI_API_KEY, чтобы использовать функции Gemini.",
      );
    }

    const body = buildRequestBody(options);

    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`,
    );
    url.search = new URLSearchParams({ key: this.apiKey }).toString();

    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(`Gemini API request failed with status ${response.status}: ${message}`);
    }

    const payload = (await response.json()) as GeminiResponsePayload;
    const text = extractTextFromResponse(payload);

    return { text, raw: payload };
  }
}

let sharedClient: GeminiClient | null = null;

export function getGeminiClient(): GeminiClient {
  if (!sharedClient) {
    sharedClient = new GeminiClient(process.env.GEMINI_API_KEY);
  }

  return sharedClient;
}
