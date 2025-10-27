import fs from "fs";
import path from "path";
import { executeGeminiRequest, getGeminiClient, GeminiServiceError } from "./gemini-client.js";

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{ start: number; end: number; text: string }>;
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".mp3": "audio/mp3",
    ".wav": "audio/wav",
    ".m4a": "audio/m4a",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".webm": "audio/webm",
    ".opus": "audio/opus"
  };
  return mimeTypes[ext] || "audio/mpeg";
}

export async function transcribeAudio(
  audioFilePath: string,
  language?: string
): Promise<TranscriptionResult> {
  try {
    const audioBytes = fs.readFileSync(audioFilePath);
    const mimeType = getMimeType(audioFilePath);

    let prompt =
      `Transcribe this audio file accurately. Return ONLY the transcription text, without any additional comments.\n` +
      `If multiple speakers are audible, indicate them as "Manager:" and "Client:" or "Speaker 1:", "Speaker 2:", etc.`;
    if (language) prompt = `Transcribe this audio in ${language} language. ` + prompt;

    const client = getGeminiClient();
    const response = await executeGeminiRequest(() =>
      client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: audioBytes.toString("base64"),
                  mimeType
                }
              },
              { text: prompt }
            ]
          }
        ]
      })
    );

    const transcriptionText = response.text;
    if (!transcriptionText || !transcriptionText.trim()) {
      throw new GeminiServiceError(
        "Gemini не вернул расшифровку. Проверьте формат аудио и API ключ.",
        502,
        "gemini_empty_transcription"
      );
    }

    return {
      text: transcriptionText.trim(),
      language: language || "ru",
      duration: undefined,
      segments: undefined
    };
  } catch (error) {
    if (error instanceof GeminiServiceError) throw error;
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    throw new GeminiServiceError(
      `Ошибка транскрипции аудио: ${message}`,
      502,
      "gemini_transcription_failed",
      error instanceof Error ? { cause: error } : undefined
    );
  }
}
