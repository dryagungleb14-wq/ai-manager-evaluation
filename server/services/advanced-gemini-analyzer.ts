import {
  AdvancedChecklist,
  AdvancedChecklistReport,
  StageReport,
  CriterionReport,
} from "../shared/schema.js";
import { executeGeminiRequest, getGeminiClient, GeminiServiceError } from "./gemini-client.js";

export async function analyzeAdvancedChecklist(
  transcript: string,
  checklist: AdvancedChecklist,
  source: "call" | "correspondence" = "call",
  language: string = "ru"
): Promise<AdvancedChecklistReport> {
  try {
    const systemPrompt = `Ты эксперт по оценке качества работы менеджеров.

ЗАДАЧА: Проанализируй диалог и для КАЖДОГО критерия определи:
1. Какой уровень достигнут: MAX (идеально), MID (средне), MIN (неудовлетворительно) или null (критерий не применим/не выполнен)
2. Балл за этот уровень (согласно описанию уровня)
3. Цитаты из диалога (evidence) с временными метками если возможно
4. Краткий комментарий

ПРАВИЛА ОЦЕНКИ:
- MAX: Менеджер выполнил критерий идеально, все аспекты учтены
- MID: Критерий выполнен частично или с недочётами
- MIN: Критерий выполнен минимально или с серьёзными проблемами
- null: Критерий не применим или вообще не выполнен

Для каждого критерия используй описания max/mid/min из чек-листа для определения уровня.
Если у критерия нет градаций (только weight), то оценивай бинарно: выполнен = weight баллов, не выполнен = 0.

ФОРМАТ ОТВЕТА (строгий JSON):
{
  "stages": [
    {
      "stageName": "Название этапа",
      "criteria": [
        {
          "id": "criterion-1.1",
          "number": "1.1",
          "title": "Название критерия",
          "achievedLevel": "max|mid|min|null",
          "score": 5,
          "evidence": [{ "text": "цитата из диалога", "timestamp": "12.5" }],
          "comment": "Краткий комментарий о выполнении"
        }
      ]
    }
  ],
  "summary": "Общая сводка по всем этапам (2-3 предложения)"
}`;

    const checklistData = checklist.stages.map(stage => ({
      name: stage.name,
      criteria: stage.criteria.map(c => ({
        id: c.id,
        number: c.number,
        title: c.title,
        description: c.description,
        weight: c.weight,
        max: c.max,
        mid: c.mid,
        min: c.min,
        isBinary: c.isBinary,
      })),
    }));

    const contents = `ДИАЛОГ ДЛЯ АНАЛИЗА:
"""
${transcript}
"""

ЧЕК-ЛИСТ:
${JSON.stringify(checklistData, null, 2)}

Проанализируй диалог согласно чек-листу и верни результат в указанном JSON формате.`;

    const geminiClient = getGeminiClient();
    const response = await executeGeminiRequest(() =>
      geminiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [{ text: systemPrompt + "\n\n" + contents }],
          },
        ],
        config: { 
          responseMimeType: "application/json",
        },
      }),
    );

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Gemini вернул пустой ответ при анализе чек-листа");
    }

    const result = JSON.parse(responseText);

    // Enrich result with description and maxScore from checklist
    for (let i = 0; i < result.stages.length; i++) {
      const stage = result.stages[i];
      const checklistStage = checklist.stages.find(s => s.name === stage.stageName);
      if (checklistStage) {
        for (let j = 0; j < stage.criteria.length; j++) {
          const criterion = stage.criteria[j];
          const checklistCriterion = checklistStage.criteria.find(c => c.id === criterion.id);
          if (checklistCriterion) {
            criterion.description = checklistCriterion.description;
            criterion.maxScore = checklistCriterion.weight;
          }
        }
      }
    }

    // Calculate total score
    let totalScore = 0;
    for (const stage of result.stages) {
      for (const criterion of stage.criteria) {
        totalScore += criterion.score || 0;
      }
    }

    return {
      checklistId: checklist.id,
      totalScore,
      maxPossibleScore: checklist.totalScore,
      percentage: Math.round((totalScore / checklist.totalScore) * 100),
      stages: result.stages,
      summary: result.summary || "Анализ выполнен",
    };
  } catch (error) {
    if (error instanceof GeminiServiceError) throw error;
    if (error instanceof SyntaxError) {
      throw new GeminiServiceError(
        "Ошибка парсинга ответа от Gemini - некорректный JSON",
        502,
        "gemini_parse_error",
      );
    }
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    console.error("Gemini advanced analysis error:", message);
    throw new GeminiServiceError(
      `Ошибка анализа продвинутого чек-листа: ${message}`,
      502,
      "gemini_advanced_analysis_failed",
      error instanceof Error ? { cause: error } : undefined,
    );
  }
}
