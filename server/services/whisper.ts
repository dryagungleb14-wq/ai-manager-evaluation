import fs from "fs";
import path from "path";
import { getGeminiClient } from "../lib/gemini-client.js";

// Using Gemini 2.5 Flash for audio transcription (FREE alternative to OpenAI Whisper)
// Gemini supports: audio/mp3, audio/wav, audio/m4a, audio/flac, audio/ogg, etc.
const geminiClient = getGeminiClient();

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

// Helper to get MIME type from file extension
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    ".mp3": "audio/mp3",
    ".wav": "audio/wav",
    ".m4a": "audio/m4a",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".webm": "audio/webm",
    ".opus": "audio/opus",
  };
  return mimeTypes[ext] || "audio/mpeg";
}

export async function transcribeAudio(
  audioFilePath: string,
  language?: string
): Promise<TranscriptionResult> {
  try {
    // Read audio file
    const audioBytes = fs.readFileSync(audioFilePath);
    const mimeType = getMimeType(audioFilePath);

    // Prepare prompt - let Gemini auto-detect language or use hint if provided
    let prompt = `Transcribe this audio file accurately. Return ONLY the transcription text, without any additional comments.
If multiple speakers are audible, indicate them as "Manager:" and "Client:" or "Speaker 1:", "Speaker 2:", etc.`;
    
    if (language) {
      // Add language hint if specified
      prompt = `Transcribe this audio in ${language} language. ${prompt}`;
    }
    // Call Gemini with audio
    const response = await geminiClient.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: audioBytes.toString("base64"),
                mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
    });

    // Extract text from Gemini response (same as in gemini-analyzer.ts)
    const transcriptionText = response.text;

    if (!transcriptionText || transcriptionText.trim().length === 0) {
      console.error("Gemini response:", JSON.stringify(response, null, 2));
      throw new Error("Gemini не вернул расшифровку. Проверьте формат аудио и API ключ.");
    }

    const result: TranscriptionResult = {
      text: transcriptionText.trim(),
      language: language || "ru",
      // Note: Gemini doesn't return duration and segments like Whisper
      // These fields are optional and not critical for dialogue analysis
      duration: undefined,
      segments: undefined,
    };

    return result;
  } catch (error) {
    console.error("Gemini transcription error:", error);
    throw new Error(
      `Ошибка транскрипции аудио: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`
    );
  }
}
