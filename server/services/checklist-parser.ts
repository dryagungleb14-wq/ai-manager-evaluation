import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { Express } from 'express';
import { randomUUID } from "node:crypto";
import { Checklist, ChecklistItem } from "../shared/schema.js";
import { executeGeminiRequest, getGeminiClient, GeminiServiceError, type GeminiContentResponse } from "./gemini-client.js";

interface ParseResult {
  success: boolean;
  checklist?: Checklist;
  error?: string;
}

type UploadFile = File | Express.Multer.File;

function isBrowserFile(file: UploadFile): file is File {
  return typeof (file as File).arrayBuffer === 'function';
}

function isMulterFile(file: UploadFile): file is Express.Multer.File {
  return typeof (file as Express.Multer.File).originalname === 'string';
}

async function readFileAsText(file: UploadFile): Promise<string> {
  if (isBrowserFile(file)) {
    return file.text();
  }

  if (isMulterFile(file) && file.buffer) {
    return file.buffer.toString('utf-8');
  }

  throw new Error('Unsupported file format: unable to read file as text');
}

async function readFileAsBuffer(file: UploadFile): Promise<ArrayBuffer> {
  if (isBrowserFile(file)) {
    return file.arrayBuffer();
  }

  if (isMulterFile(file) && file.buffer) {
    return file.buffer.buffer.slice(file.buffer.byteOffset, file.buffer.byteOffset + file.buffer.byteLength);
  }

  throw new Error('Unsupported file format: unable to read file as binary data');
}

// AI-парсинг текстовых файлов (TXT, MD)
async function parseTextWithAI(content: string, filename: string): Promise<ParseResult> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      success: false,
      error: "GEMINI_API_KEY не настроен. Для парсинга TXT/MD файлов требуется Gemini API. Используйте CSV или Excel формат, или настройте API ключ в Secrets."
    };
  }

  try {
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
      "title": "Краткое название пункта",
      "type": "mandatory|recommended|prohibited",
      "criteria": {
        "llm_hint": "Что искать в диалоге",
        "positive_patterns": ["ключевая фраза 1", "ключевая фраза 2"],
        "negative_patterns": ["запрещённая фраза 1"]
      }
    }
  ]
}

ТЕКСТ ЧЕК-ЛИСТА:
${content}

Верни ТОЛЬКО валидный JSON без дополнительных комментариев.`;

    const response = await executeGeminiRequest<GeminiContentResponse>(() =>
      client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      })
    );

    const responseText = response.text ?? "";
    if (!responseText) {
      throw new GeminiServiceError("Пустой ответ от Gemini API", 502, "gemini_empty_checklist_parse");
    }

    const parsed = JSON.parse(responseText);

    const checklist: Checklist = {
      id: randomUUID(),
      name: parsed.name || filename.replace(/\.(txt|md)$/i, ''),
      version: "1.0",
      items: parsed.items.map((item: any, index: number) => ({
        id: `item-${index + 1}`,
        title: item.title,
        type: item.type,
        criteria: {
          llm_hint: item.criteria.llm_hint,
          positive_patterns: item.criteria.positive_patterns || [],
          negative_patterns: item.criteria.negative_patterns || [],
        },
        confidence_threshold: 0.6,
      })) as ChecklistItem[],
    };

    return { success: true, checklist };
  } catch (error) {
    console.error("AI parsing error:", error);
    if (error instanceof GeminiServiceError) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: `Ошибка AI-парсинга: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
    };
  }
}

// Парсинг CSV файлов
function parseCSV(content: string, filename: string): ParseResult {
  try {
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      return {
        success: false,
        error: `Ошибка парсинга CSV: ${parsed.errors[0].message}`
      };
    }

    const items: ChecklistItem[] = parsed.data.map((row: any, index: number) => {
      const title = row['Пункт'] || row['Название'] || row['Title'] || row['Item'] || row['пункт'] || '';
      const typeRaw = row['Тип'] || row['Type'] || row['тип'] || 'mandatory';
      const hint = row['Описание'] || row['Description'] || row['LLM Hint'] || row['описание'] || title;

      let type: 'mandatory' | 'recommended' | 'prohibited' = 'mandatory';
      const typeLower = typeof typeRaw === 'string' ? typeRaw.toLowerCase() : 'mandatory';

      if (typeLower.includes('обязат') || typeLower === 'mandatory' || typeLower === 'required') {
        type = 'mandatory';
      } else if (typeLower.includes('рекоменд') || typeLower === 'recommended') {
        type = 'recommended';
      } else if (typeLower.includes('запрещ') || typeLower === 'prohibited' || typeLower === 'forbidden') {
        type = 'prohibited';
      }

      return {
        id: `item-${index + 1}`,
        title: String(title).trim(),
        type,
        criteria: {
          llm_hint: String(hint).trim(),
          positive_patterns: [],
          negative_patterns: [],
        },
        confidence_threshold: 0.6,
      };
    }).filter(item => item.title.length > 0);

    const checklist: Checklist = {
      id: randomUUID(),
      name: filename.replace(/\.csv$/i, ''),
      version: "1.0",
      items,
    };

    return { success: true, checklist };
  } catch (error) {
    return {
      success: false,
      error: `Ошибка парсинга CSV: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
    };
  }
}

// Парсинг Excel файлов
function parseExcel(buffer: ArrayBuffer, filename: string): ParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    const items: ChecklistItem[] = (jsonData as any[]).map((row, index) => {
      const title = row['Пункт'] || row['Название'] || row['Title'] || row['Item'] || row['пункт'] || '';
      const typeRaw = row['Тип'] || row['Type'] || row['тип'] || 'mandatory';
      const hint = row['Описание'] || row['Description'] || row['LLM Hint'] || row['описание'] || title;

      let type: 'mandatory' | 'recommended' | 'prohibited' = 'mandatory';
      const typeLower = typeof typeRaw === 'string' ? typeRaw.toLowerCase() : 'mandatory';

      if (typeLower.includes('обязат') || typeLower === 'mandatory' || typeLower === 'required') {
        type = 'mandatory';
      } else if (typeLower.includes('рекоменд') || typeLower === 'recommended') {
        type = 'recommended';
      } else if (typeLower.includes('запрещ') || typeLower === 'prohibited' || typeLower === 'forbidden') {
        type = 'prohibited';
      }

      return {
        id: `item-${index + 1}`,
        title: String(title).trim(),
        type,
        criteria: {
          llm_hint: String(hint).trim(),
          positive_patterns: [],
          negative_patterns: [],
        },
        confidence_threshold: 0.6,
      };
    }).filter(item => item.title.length > 0);

    const checklist: Checklist = {
      id: randomUUID(),
      name: filename.replace(/\.(xlsx|xls)$/i, ''),
      version: "1.0",
      items,
    };

    return { success: true, checklist };
  } catch (error) {
    return {
      success: false,
      error: `Ошибка парсинга Excel: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
    };
  }
}

export async function parseChecklistFile(file: UploadFile): Promise<ParseResult> {
  const filename = isMulterFile(file) ? file.originalname : file.name;

  if (filename.endsWith('.txt') || filename.endsWith('.md')) {
    const textContent = await readFileAsText(file);
    return parseTextWithAI(textContent, filename);
  }

  if (filename.endsWith('.csv')) {
    const textContent = await readFileAsText(file);
    return parseCSV(textContent, filename);
  }

  if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
    const arrayBuffer = await readFileAsBuffer(file);
    return parseExcel(arrayBuffer, filename);
  }

  return {
    success: false,
    error: 'Неподдерживаемый формат файла. Загрузите CSV, XLSX, XLS, TXT или MD.'
  };
}
