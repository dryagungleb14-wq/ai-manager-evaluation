import { Checklist } from "@shared/schema";

export const defaultChecklists: Checklist[] = [
  {
    id: "b2b-sales-basic",
    name: "Продажи B2B — базовый",
    version: "1.0",
    items: [
      {
        id: "greeting",
        title: "Приветствие и представление",
        type: "mandatory",
        criteria: {
          positive_patterns: ["добрый день", "здравствуйте", "меня зовут", "компания"],
          negative_patterns: [],
          llm_hint: "Оценить наличие корректного приветствия и представления компании/менеджера.",
        },
        confidence_threshold: 0.6,
      },
      {
        id: "needs",
        title: "Выявление потребностей",
        type: "mandatory",
        criteria: {
          positive_patterns: ["какие задачи", "что важно", "какие цели", "расскажите о"],
          llm_hint: "Проверить, задавались ли вопросы для понимания задач клиента.",
        },
        confidence_threshold: 0.65,
      },
      {
        id: "presentation",
        title: "Презентация решения",
        type: "mandatory",
        criteria: {
          positive_patterns: ["мы можем предложить", "наше решение", "это поможет вам"],
          llm_hint: "Проверить, представил ли менеджер решение с привязкой к потребностям клиента.",
        },
        confidence_threshold: 0.6,
      },
      {
        id: "objections",
        title: "Работа с возражениями",
        type: "recommended",
        criteria: {
          llm_hint: "Оценить, как менеджер обрабатывал возражения клиента (если были).",
        },
        confidence_threshold: 0.65,
      },
      {
        id: "next-steps",
        title: "Договорённости о следующих шагах",
        type: "mandatory",
        criteria: {
          positive_patterns: ["следующий шаг", "когда встретимся", "пришлю", "свяжемся"],
          llm_hint: "Проверить, были ли зафиксированы конкретные следующие шаги.",
        },
        confidence_threshold: 0.7,
      },
      {
        id: "promises-without-basis",
        title: "Обещания без оснований",
        type: "prohibited",
        criteria: {
          negative_patterns: ["гарантирую", "точно получится", "обещаю", "100%"],
          llm_hint: "Выявить необоснованные обещания или гарантии без подтверждения.",
        },
        confidence_threshold: 0.7,
      },
    ],
  },
  {
    id: "support-quality",
    name: "Качество поддержки клиентов",
    version: "1.0",
    items: [
      {
        id: "greeting-support",
        title: "Вежливое приветствие",
        type: "mandatory",
        criteria: {
          positive_patterns: ["добрый день", "здравствуйте", "чем могу помочь"],
          llm_hint: "Проверить вежливость и профессионализм приветствия.",
        },
        confidence_threshold: 0.6,
      },
      {
        id: "problem-understanding",
        title: "Понимание проблемы",
        type: "mandatory",
        criteria: {
          positive_patterns: ["правильно понимаю", "уточните", "объясните"],
          llm_hint: "Оценить, задавал ли менеджер уточняющие вопросы для понимания проблемы.",
        },
        confidence_threshold: 0.65,
      },
      {
        id: "solution",
        title: "Предложение решения",
        type: "mandatory",
        criteria: {
          llm_hint: "Проверить, было ли предложено конкретное решение проблемы.",
        },
        confidence_threshold: 0.7,
      },
      {
        id: "empathy",
        title: "Эмпатия и понимание",
        type: "recommended",
        criteria: {
          positive_patterns: ["понимаю", "сожалею", "поможем разобраться"],
          llm_hint: "Оценить проявление эмпатии к проблеме клиента.",
        },
        confidence_threshold: 0.6,
      },
      {
        id: "rude-language",
        title: "Грубость или непрофессионализм",
        type: "prohibited",
        criteria: {
          negative_patterns: ["это не моя проблема", "сами виноваты", "не знаю"],
          llm_hint: "Выявить грубые или непрофессиональные высказывания.",
        },
        confidence_threshold: 0.8,
      },
    ],
  },
];
