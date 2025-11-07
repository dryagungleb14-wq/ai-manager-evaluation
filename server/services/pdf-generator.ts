import PDFDocument from "pdfkit";
import type PDFKit from "pdfkit";
import type { AnalysisReport } from "../shared/schema.js";

type TextOptionsWithItalics = PDFKit.Mixins.TextOptions & { italics?: boolean };

interface PDFOptions {
  title?: string;
  author?: string;
}

/**
 * Generate a PDF document from analysis report
 * Returns a stream that can be piped to response or file
 */
export function generatePDFReport(
  report: AnalysisReport,
  options: PDFOptions = {}
): PDFKit.PDFDocument {
  const { checklistReport, objectionsReport } = report;
  const { meta } = checklistReport;

  // Create PDF document
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: options.title || `Анализ: ${meta.source === "call" ? "Звонок" : "Переписка"}`,
      Author: options.author || "AI-система оценки менеджеров",
      CreationDate: new Date(),
    },
  });

  // Helper functions
  const addTitle = (text: string, size: number = 20) => {
    doc.fontSize(size).font("Helvetica-Bold").text(text, { align: "left" });
    doc.moveDown(0.5);
  };

  const addHeading = (text: string, size: number = 14) => {
    doc.fontSize(size).font("Helvetica-Bold").text(text, { align: "left" });
    doc.moveDown(0.3);
  };

  const addText = (
    text: string,
    options: TextOptionsWithItalics = {}
  ) => {
    const { italics, ...textOptions } = options;
    const fontName = italics ? "Helvetica-Oblique" : "Helvetica";
    doc.fontSize(11).font(fontName).text(text, textOptions);
    if (italics) {
      doc.font("Helvetica");
    }
  };

  const addSeparator = () => {
    const y = doc.y;
    doc.strokeColor("#ddd").lineWidth(1).moveTo(50, y).lineTo(545, y).stroke();
    doc.moveDown(0.5);
  };

  // Title and metadata
  const sourceText = meta.source === "call" ? "Звонок" : "Переписка";
  addTitle(`Отчёт анализа: ${sourceText}`, 24);

  addText(`Дата анализа: ${new Date(meta.analyzed_at || new Date()).toLocaleString("ru")}`, {
    continued: false,
  });
  addText(`Язык: ${meta.language}`, { continued: false });
  if (meta.duration) {
    addText(`Длительность: ${meta.duration} сек.`, { continued: false });
  }
  doc.moveDown(1);

  addSeparator();
  doc.moveDown(0.5);

  // Checklist Report Section
  addHeading("Отчёт по чек-листу", 18);
  doc.moveDown(0.3);

  // Summary
  addText(checklistReport.summary, {
    continued: false,
    indent: 20,
  });
  doc.moveDown(0.5);

  // Calculate statistics
  const totalItems = checklistReport.items.length;
  const passedItems = checklistReport.items.filter((item) => item.status === "passed").length;
  const failedItems = checklistReport.items.filter((item) => item.status === "failed").length;
  const uncertainItems = checklistReport.items.filter(
    (item) => item.status === "uncertain"
  ).length;
  const passRate = Math.round((passedItems / totalItems) * 100);

  addText(`Результаты: ${passedItems}/${totalItems} пунктов выполнено (${passRate}%)`, {
    continued: false,
  });
  addText(`✓ Выполнено: ${passedItems}`, { continued: false });
  addText(`✗ Не выполнено: ${failedItems}`, { continued: false });
  addText(`? Неопределённо: ${uncertainItems}`, { continued: false });
  doc.moveDown(0.8);

  // Checklist items
  addHeading("Детализация по пунктам", 14);
  doc.moveDown(0.3);

  checklistReport.items.forEach((item, index) => {
    // Check if we need a new page
    if (doc.y > 700) {
      doc.addPage();
    }

    const statusIcon = getStatusIcon(item.status);
    const typeText = getTypeText(item.type);
    const confidence = Math.round(item.score * 100) + "%";

    addText(`${index + 1}. ${item.title}`, {
      continued: false,
      underline: false,
    });

    doc.fontSize(10).font("Helvetica");
    doc.text(`   Тип: ${typeText} | Статус: ${statusIcon} | Уверенность: ${confidence}`, {
      continued: false,
    });

    if (item.comment) {
      doc.fontSize(10).fillColor("#666");
      doc.text(`   ${item.comment}`, { continued: false });
      doc.fillColor("#000");
    }

    if (item.evidence.length > 0) {
      doc.fontSize(9).fillColor("#444");
      item.evidence.forEach((evidence, evidenceIndex) => {
        const timeStamp =
          evidence.start !== undefined && evidence.end !== undefined
            ? ` [${formatTime(evidence.start)}-${formatTime(evidence.end)}]`
            : "";
        doc.text(`   → ${timeStamp} "${evidence.text}"`, { continued: false });
      });
      doc.fillColor("#000");
    }

    doc.moveDown(0.4);
  });

  doc.addPage();

  // Objections Report Section
  addHeading("Отчёт по возражениям и содержанию", 18);
  doc.moveDown(0.5);

  // Conversation essence
  addHeading("Суть разговора", 14);
  addText(objectionsReport.conversation_essence, {
    continued: false,
    indent: 20,
  });
  doc.moveDown(0.5);

  // Outcome
  addHeading("Итог и следующие шаги", 14);
  addText(objectionsReport.outcome, {
    continued: false,
    indent: 20,
  });
  doc.moveDown(0.5);

  // Topics
  if (objectionsReport.topics.length > 0) {
    addHeading("Ключевые темы", 14);
    objectionsReport.topics.forEach((topic) => {
      addText(`• ${topic}`, { continued: false, indent: 20 });
    });
    doc.moveDown(0.5);
  }

  // Objections
  if (objectionsReport.objections.length > 0) {
    addHeading(`Возражения (${objectionsReport.objections.length})`, 14);
    doc.moveDown(0.3);

    objectionsReport.objections.forEach((objection, index) => {
      // Check if we need a new page
      if (doc.y > 680) {
        doc.addPage();
      }

      const handlingIcon = getHandlingIcon(objection.handling);
      const handlingText = getHandlingText(objection.handling);

      addText(`${index + 1}. ${objection.category}`, {
        continued: false,
        underline: true,
      });
      doc.moveDown(0.2);

      doc.fontSize(10).font("Helvetica");
      doc.text(`   Фраза клиента: "${objection.client_phrase}"`, { continued: false });

      if (objection.manager_reply) {
        doc.text(`   Ответ менеджера: "${objection.manager_reply}"`, { continued: false });
      }

      doc.text(`   Обработка: ${handlingIcon} ${handlingText}`, { continued: false });

      if (objection.advice) {
        doc.fontSize(10).fillColor("#0066cc");
        doc.text(`   Рекомендация: ${objection.advice}`, { continued: false });
        doc.fillColor("#000");
      }

      doc.moveDown(0.5);
    });
  } else {
    addHeading("Возражения", 14);
    addText("Возражений не выявлено", {
      continued: false,
      italics: true,
      indent: 20,
    });
  }

  // Footer
  doc.moveDown(1);
  addSeparator();
  doc.fontSize(9).fillColor("#666");
  doc.text("Отчёт сгенерирован AI-системой оценки менеджеров", {
    align: "center",
  });

  // Don't call doc.end() here - let the caller handle it after piping
  return doc;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "passed":
      return "✓";
    case "failed":
      return "✗";
    case "uncertain":
      return "?";
    default:
      return status;
  }
}

function getTypeText(type: string): string {
  switch (type) {
    case "mandatory":
      return "Обязательный";
    case "recommended":
      return "Рекомендуемый";
    case "prohibited":
      return "Запрещённый";
    default:
      return type;
  }
}

function getHandlingText(handling: string): string {
  switch (handling) {
    case "handled":
      return "Обработано успешно";
    case "partial":
      return "Частично обработано";
    case "unhandled":
      return "Не обработано";
    default:
      return handling;
  }
}

function getHandlingIcon(handling: string): string {
  switch (handling) {
    case "handled":
      return "✓";
    case "partial":
      return "⚠";
    case "unhandled":
      return "✗";
    default:
      return "?";
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
