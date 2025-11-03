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
    const systemPrompt = `Эксперт по оценке менеджеров. Для каждого критерия определи уровень (MAX/MID/MIN/null), балл, цитаты, комментарий.

MAX = идеально выполнен
MID = частично выполнен  
MIN = плохо выполнен
null = не выполнен

Ответ строго в JSON:
{
  "stages": [
    {
      "stageName": "Этап",
      "criteria": [
        {
          "id": "id",
          "number": "1.1",
          "title": "название",
          "achievedLevel": "max|mid|min|null",
          "score": 5,
          "evidence": [{"text": "цитата", "timestamp": "12"}],
          "comment": "комментарий"
        }
      ]
    }
  ],
  "summary": "Сводка 2-3 предложения"
}`;

    const checklistData = checklist.stages.map(stage => ({
      name: stage.name,
      criteria: stage.criteria.map(c => {
        const compact: {
          id: string;
          n: string;
          t: string;
          w: number;
          max?: { d: string; s: number };
          mid?: { d: string; s: number };
          min?: { d: string; s: number };
          bin?: boolean;
        } = {
          id: c.id,
          n: c.number,
          t: c.title,
          w: c.weight,
        };
        if (c.max) compact.max = { d: c.max.description, s: c.max.score };
        if (c.mid) compact.mid = { d: c.mid.description, s: c.mid.score };
        if (c.min) compact.min = { d: c.min.description, s: c.min.score };
        if (c.isBinary) compact.bin = true;
        return compact;
      }),
    }));

    const contents = `ДИАЛОГ:
"""
${transcript}
"""

КРИТЕРИИ:
${JSON.stringify(checklistData)}

Проанализируй и верни JSON.`;

    const fullPrompt = systemPrompt + "\n\n" + contents;
    const promptLength = fullPrompt.length;
    const totalCriteria = checklist.stages.reduce((acc, s) => acc + s.criteria.length, 0);
    console.log(
      `[Advanced Analyzer] Prompt length: ${promptLength} chars, ` +
      `Transcript: ${transcript.length} chars, ` +
      `Checklist stages: ${checklist.stages.length}, ` +
      `Total criteria: ${totalCriteria}`
    );

    const geminiClient = getGeminiClient();
    const response = await executeGeminiRequest(() =>
      geminiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [{ text: fullPrompt }],
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
