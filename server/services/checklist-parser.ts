import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { GoogleGenAI } from "@google/genai";
import { Checklist, ChecklistItem } from "@shared/schema";

interface ParseResult {
  success: boolean;
  checklist?: Checklist;
  error?: string;
}

// AI-парсинг текстовых файлов (TXT, MD)
async function parseTextWithAI(content: string, filename: string): Promise<ParseResult> {
  // Check if API key is available
  if (!process.env.GEMINI_API_KEY) {
    return {
      success: false,
      error: "GEMINI_API_KEY не настроен. Для парсинга TXT/MD файлов требуется Gemini API. Используйте CSV или Excel формат, или настройте API ключ в Secrets."
    };
  }

  try {
    // Lazy initialization of Gemini client
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = result.text ?? "";
    if (!responseText) {
      throw new Error("Пустой ответ от Gemini API");
    }
    
    const parsed = JSON.parse(responseText);
    
    // Добавляем ID и дефолтные значения
    const checklist: Checklist = {
      id: crypto.randomUUID(),
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
      // Поддержка различных названий колонок
      const title = row['Пункт'] || row['Название'] || row['Title'] || row['Item'] || row['пункт'] || '';
      const typeRaw = row['Тип'] || row['Type'] || row['тип'] || 'mandatory';
      const hint = row['Описание'] || row['Description'] || row['LLM Hint'] || row['описание'] || title;
      
      // Преобразование типа
      let type: 'mandatory' | 'recommended' | 'prohibited' = 'mandatory';
      const typeLower = typeRaw.toLowerCase();
      
      if (typeLower.includes('обязат') || typeLower === 'mandatory' || typeLower === 'required') {
        type = 'mandatory';
      } else if (typeLower.includes('рекоменд') || typeLower === 'recommended') {
        type = 'recommended';
      } else if (typeLower.includes('запрещ') || typeLower === 'prohibited' || typeLower === 'forbidden') {
        type = 'prohibited';
      }

      return {
        id: `item-${index + 1}`,
        title: title.trim(),
        type,
        criteria: {
          llm_hint: hint.trim(),
          positive_patterns: [],
          negative_patterns: [],
        },
        confidence_threshold: 0.6,
      };
    }).filter(item => item.title.length > 0);

    const checklist: Checklist = {
      id: crypto.randomUUID(),
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
function parseExcel(buffer: Buffer, filename: string): ParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet);

    const items: ChecklistItem[] = data.map((row: any, index: number) => {
      const title = row['Пункт'] || row['Название'] || row['Title'] || row['Item'] || '';
      const typeRaw = row['Тип'] || row['Type'] || 'mandatory';
      const hint = row['Описание'] || row['Description'] || row['LLM Hint'] || title;
      
      let type: 'mandatory' | 'recommended' | 'prohibited' = 'mandatory';
      const typeLower = String(typeRaw).toLowerCase();
      
      if (typeLower.includes('обязат') || typeLower === 'mandatory') {
        type = 'mandatory';
      } else if (typeLower.includes('рекоменд') || typeLower === 'recommended') {
        type = 'recommended';
      } else if (typeLower.includes('запрещ') || typeLower === 'prohibited') {
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
      id: crypto.randomUUID(),
      name: filename.replace(/\.(xlsx?|xls)$/i, ''),
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

// Главная функция парсинга
export async function parseChecklistFile(
  file: Express.Multer.File
): Promise<ParseResult> {
  const filename = file.originalname;
  const ext = filename.split('.').pop()?.toLowerCase();

  try {
    switch (ext) {
      case 'txt':
      case 'md':
        const textContent = file.buffer.toString('utf-8');
        return await parseTextWithAI(textContent, filename);

      case 'csv':
        const csvContent = file.buffer.toString('utf-8');
        return parseCSV(csvContent, filename);

      case 'xlsx':
      case 'xls':
        return parseExcel(file.buffer, filename);

      default:
        return { 
          success: false, 
          error: `Неподдерживаемый формат файла: ${ext}. Используйте TXT, MD, CSV или XLSX` 
        };
    }
  } catch (error) {
    return { 
      success: false, 
      error: `Ошибка обработки файла: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}` 
    };
  }
}
