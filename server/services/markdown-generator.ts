import { AnalysisReport, ChecklistReportItem, Objection } from "@shared/schema";

/**
 * Generate a Markdown document from analysis report
 */
export function generateMarkdownReport(report: AnalysisReport): string {
  const { checklistReport, objectionsReport } = report;
  const { meta } = checklistReport;
  
  const sections: string[] = [];
  
  // Title and metadata
  const sourceText = meta.source === "call" ? "Звонок" : "Переписка";
  const date = new Date(meta.analyzed_at).toLocaleString("ru");
  
  sections.push(`# Отчёт анализа: ${sourceText}`);
  sections.push(`**Дата анализа:** ${date}  `);
  sections.push(`**Язык:** ${meta.language}  `);
  if (meta.duration) {
    sections.push(`**Длительность:** ${meta.duration} сек.  `);
  }
  sections.push("");
  
  // Checklist Report Section
  sections.push("## Отчёт по чек-листу");
  sections.push("");
  
  // Summary
  sections.push(`> ${checklistReport.summary}`);
  sections.push("");
  
  // Calculate statistics
  const totalItems = checklistReport.items.length;
  const passedItems = checklistReport.items.filter(item => item.status === "passed").length;
  const failedItems = checklistReport.items.filter(item => item.status === "failed").length;
  const uncertainItems = checklistReport.items.filter(item => item.status === "uncertain").length;
  const passRate = Math.round((passedItems / totalItems) * 100);
  
  sections.push(`**Результаты:** ${passedItems}/${totalItems} пунктов выполнено (${passRate}%)  `);
  sections.push(`✅ Выполнено: ${passedItems}  `);
  sections.push(`❌ Не выполнено: ${failedItems}  `);
  sections.push(`❓ Неопределённо: ${uncertainItems}  `);
  sections.push("");
  
  // Checklist items table
  sections.push("### Детализация по пунктам");
  sections.push("");
  sections.push("| № | Пункт | Тип | Статус | Уверенность | Комментарий |");
  sections.push("|---|-------|-----|--------|-------------|-------------|");
  
  checklistReport.items.forEach((item, index) => {
    const statusIcon = getStatusIcon(item.status);
    const typeText = getTypeText(item.type);
    const confidence = Math.round(item.score * 100) + "%";
    const comment = item.comment || "-";
    
    sections.push(
      `| ${index + 1} | ${item.title} | ${typeText} | ${statusIcon} | ${confidence} | ${comment} |`
    );
  });
  sections.push("");
  
  // Evidence details
  sections.push("### Доказательства и цитаты");
  sections.push("");
  
  checklistReport.items.forEach((item, index) => {
    if (item.evidence.length > 0) {
      sections.push(`#### ${index + 1}. ${item.title}`);
      sections.push("");
      
      item.evidence.forEach((evidence, evidenceIndex) => {
        const timeStamp = evidence.start !== undefined && evidence.end !== undefined
          ? ` [${formatTime(evidence.start)}-${formatTime(evidence.end)}]`
          : "";
          
        sections.push(`${evidenceIndex + 1}. ${timeStamp}`);
        sections.push(`   > "${evidence.text}"`);
        sections.push("");
      });
    }
  });
  
  // Objections Report Section
  sections.push("---");
  sections.push("");
  sections.push("## Отчёт по возражениям и содержанию");
  sections.push("");
  
  // Conversation essence
  sections.push("### Суть разговора");
  sections.push("");
  sections.push(objectionsReport.conversation_essence);
  sections.push("");
  
  // Outcome
  sections.push("### Итог и следующие шаги");
  sections.push("");
  sections.push(objectionsReport.outcome);
  sections.push("");
  
  // Topics
  if (objectionsReport.topics.length > 0) {
    sections.push("### Ключевые темы");
    sections.push("");
    objectionsReport.topics.forEach(topic => {
      sections.push(`- ${topic}`);
    });
    sections.push("");
  }
  
  // Objections
  if (objectionsReport.objections.length > 0) {
    sections.push("### Возражения");
    sections.push("");
    sections.push(`**Всего возражений:** ${objectionsReport.objections.length}`);
    sections.push("");
    
    objectionsReport.objections.forEach((objection, index) => {
      sections.push(`#### Возражение ${index + 1}: ${objection.category}`);
      sections.push("");
      sections.push(`**Фраза клиента:**`);
      sections.push(`> "${objection.client_phrase}"`);
      sections.push("");
      
      if (objection.manager_reply) {
        sections.push(`**Ответ менеджера:**`);
        sections.push(`> "${objection.manager_reply}"`);
        sections.push("");
      }
      
      const handlingText = getHandlingText(objection.handling);
      const handlingIcon = getHandlingIcon(objection.handling);
      sections.push(`**Обработка:** ${handlingIcon} ${handlingText}`);
      sections.push("");
      
      if (objection.advice) {
        sections.push(`**Рекомендация:**`);
        sections.push(`> ${objection.advice}`);
        sections.push("");
      }
    });
  } else {
    sections.push("### Возражения");
    sections.push("");
    sections.push("_Возражений не выявлено_");
    sections.push("");
  }
  
  // Footer
  sections.push("---");
  sections.push("");
  sections.push("_Отчёт сгенерирован AI-системой оценки менеджеров_");
  
  return sections.join("\n");
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "passed": return "✅ Выполнено";
    case "failed": return "❌ Не выполнено";
    case "uncertain": return "❓ Неопределённо";
    default: return status;
  }
}

function getTypeText(type: string): string {
  switch (type) {
    case "mandatory": return "Обязательный";
    case "recommended": return "Рекомендуемый";
    case "prohibited": return "Запрещённый";
    default: return type;
  }
}

function getHandlingText(handling: string): string {
  switch (handling) {
    case "handled": return "Обработано успешно";
    case "partial": return "Частично обработано";
    case "unhandled": return "Не обработано";
    default: return handling;
  }
}

function getHandlingIcon(handling: string): string {
  switch (handling) {
    case "handled": return "✅";
    case "partial": return "⚠️";
    case "unhandled": return "❌";
    default: return "❓";
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
