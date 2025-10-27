import {
  Checklist,
  ChecklistReport,
  ObjectionsReport,
  ChecklistItemStatus,
  ObjectionHandling,
} from "../shared/schema.js";
import { executeGeminiRequest, getGeminiClient, GeminiServiceError } from "./gemini-client.js";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or "gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user
// This API key is from Gemini Developer API Key, not vertex AI API Key

interface AnalysisResult {
  checklistReport: ChecklistReport;
  objectionsReport: ObjectionsReport;
}

export async function analyzeConversation(
  transcript: string,
  checklist: Checklist,
  source: "call" | "correspondence" = "call",
  language: string = "ru"
): Promise<AnalysisResult> {
  try {
    const checklistResult = await analyzeChecklist(transcript, checklist, source, language);
    const objectionsResult = await analyzeObjections(transcript, language);
    return { checklistReport: checklistResult, objectionsReport: objectionsResult };
  } catch (error) {
    if (error instanceof GeminiServiceError) throw error;
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    console.error("Gemini analysis error:", message);
    throw new GeminiServiceError(
      `Ошибка анализа диалога: ${message}`,
      502,
      "gemini_analysis_failed",
      error instanceof Error ? { cause: error } : undefined,
    );
  }
}

async function analyzeChecklist(
  transcript: string,
  checklist: Checklist,
  source: "call" | "correspondence",
  language: string
): Promise<ChecklistReport> {
  const systemPrompt = `Ты эксперт по оценке качества работы менеджеров. Проанализируй диалог и проверь выполнение каждого пункта чек-листа.

Для каждого пункта чек-листа определи:
1. status: "passed" (выполнен), "failed" (не выполнен), или "uncertain" (сомнительно)
2. score: число от 0 до 1, показывающее уверенность в оценке
3. evidence: массив цитат из диалога, подтверждающих оценку (с таймкодами если есть)
4. comment: краткий комментарий о выполнении пункта

Учитывай:
- Для "mandatory" (обязательных) пунктов требуй чёткого выполнения
- Для "recommended" (рекомендуемых) оценивай мягче
- Для "prohibited" (запрещённых) ищи нарушения
- Используй positive_patterns и negative_patterns как подсказки
- Основывайся на llm_hint для понимания, что именно проверять

Отвечай ТОЛЬКО валидным JSON без дополнительного текста.`;

  const checklistItems = checklist.items.map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    criteria: item.criteria,
    threshold: item.confidence_threshold,
  }));

  const contents = `Диалог для анализа:
"""
${transcript}
"""

Чек-лист для проверки:
${JSON.stringify(checklistItems, null, 2)}

Проанализируй диалог и верни результат в формате:
{
  "items": [
    {
      "id": "ID пункта из чек-листа",
      "status": "passed|failed|uncertain",
      "score": 0.85,
      "evidence": [{"text": "цитата из диалога", "start": 12.5, "end": 15.3}],
      "comment": "Краткий комментарий"
    }
  ],
  "summary": "Краткая общая сводка выполнения чек-листа (2-3 предложения)"
}`;

  const client = getGeminiClient();
  const response = await executeGeminiRequest(() =>
    client.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  status: { type: "string" },
                  score: { type: "number" },
                  evidence: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string" },
                        start: { type: "number" },
                        end: { type: "number" }
                      },
                      required: ["text"]
                    }
                  },
                  comment: { type: "string" }
                },
                required: ["id", "status", "score", "evidence"]
              }
            },
            summary: { type: "string" }
          },
          required: ["items", "summary"]
        }
      },
      contents
    })
  );

  const rawJson = response.text;
  if (!rawJson) throw new GeminiServiceError("Gemini вернул пустой ответ", 502, "gemini_empty_response");

  let analysisData: any;
  try {
    analysisData = JSON.parse(rawJson);
  } catch (parseError) {
    throw new GeminiServiceError(
      "Не удалось обработать ответ от AI. Попробуйте снова.",
      502,
      "gemini_parse_error",
      parseError instanceof Error ? { cause: parseError } : undefined,
    );
  }

  if (!analysisData.items || !Array.isArray(analysisData.items)) {
    throw new GeminiServiceError("AI вернул некорректный формат данных", 502, "gemini_invalid_schema");
  }

  const reportItems = checklist.items.map((item) => {
    const analyzed = analysisData.items.find((a: any) => a.id === item.id);
    return {
      id: item.id,
      title: item.title,
      type: item.type,
      status: (analyzed?.status || "uncertain") as ChecklistItemStatus,
      score: typeof analyzed?.score === "number" ? analyzed.score : 0,
      evidence: Array.isArray(analyzed?.evidence) ? analyzed.evidence : [],
      comment: analyzed?.comment
    };
  });

  return {
    meta: {
      source,
      language,
      analyzed_at: new Date().toISOString(),
      duration: undefined,
      volume: transcript.length
    },
    items: reportItems,
    summary: analysisData.summary || "Анализ завершён"
  };
}

async function analyzeObjections(
  transcript: string,
  language: string
): Promise<ObjectionsReport> {
  const systemPrompt = `Ты эксперт по анализу переговоров и работе с возражениями. Проанализируй диалог и выяви:

1. Ключевые темы обсуждения (topics)
2. Все возражения клиента (objections) с категоризацией:
   - Категория возражения (цена, сроки, качество, доверие, конкурент, функционал, и т.д.)
   - Формулировка клиента (client_phrase)
   - Ответ менеджера (manager_reply)
   - Качество обработки: "handled" (обработано), "partial" (частично), "unhandled" (не обработано)
   - Рекомендация для улучшения (advice)
3. Суть разговора в 1-3 предложениях (conversation_essence)
4. Итог и следующие шаги (outcome)

Отвечай ТОЛЬКО валидным JSON без дополнительного текста.`;

  const contents = `Диалог для анализа:
"""
${transcript}
"""

Проанализируй диалог и верни результат в формате:
{
  "topics": ["тема1", "тема2"],
  "objections": [
    {
      "category": "цена",
      "client_phrase": "Что сказал клиент",
      "manager_reply": "Как ответил менеджер",
      "handling": "handled|partial|unhandled",
      "advice": "Рекомендация для улучшения"
    }
  ],
  "conversation_essence": "Суть разговора в 1-3 предложениях",
  "outcome": "Итог: что договорились, следующие шаги"
}`;

  const client = getGeminiClient();
  const response = await executeGeminiRequest(() =>
    client.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            topics: { type: "array", items: { type: "string" } },
            objections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  client_phrase: { type: "string" },
                  manager_reply: { type: "string" },
                  handling: { type: "string" },
                  advice: { type: "string" }
                },
                required: ["category", "client_phrase", "handling"]
              }
            },
            conversation_essence: { type: "string" },
            outcome: { type: "string" }
          },
          required: ["topics", "objections", "conversation_essence", "outcome"]
        }
      },
      contents
    })
  );

  const rawJson = response.text;
  if (!rawJson) {
    throw new GeminiServiceError(
      "Gemini вернул пустой ответ для анализа возражений",
      502,
      "gemini_empty_objections_response",
    );
  }

  let data: any;
  try {
    data = JSON.parse(rawJson);
  } catch (parseError) {
    throw new GeminiServiceError(
      "Не удалось обработать ответ от AI при анализе возражений",
      502,
      "gemini_objections_parse_error",
      parseError instanceof Error ? { cause: parseError } : undefined,
    );
  }

  return {
    topics: Array.isArray(data.topics) ? data.topics : [],
    objections: Array.isArray(data.objections)
      ? data.objections.map((obj: any) => ({
          category: obj.category || "Прочее",
          client_phrase: obj.client_phrase || "",
          manager_reply: obj.manager_reply || undefined,
          handling: (obj.handling || "unhandled") as ObjectionHandling,
          advice: obj.advice || undefined
        }))
      : [],
    conversation_essence: data.conversation_essence || "Не удалось определить суть разговора",
    outcome: data.outcome || "Итог не зафиксирован"
  };
}
