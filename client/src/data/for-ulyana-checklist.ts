import { AdvancedChecklist } from "@/lib/rest";

/**
 * Чек-лист "Для Ульяны"
 * Оценка звонков по квалификации лидов с использованием системы оценки 0/0.5/1
 * 
 * NOTE: This file is intentionally duplicated from server/data/for-ulyana-checklist.ts
 * for simplicity in the MVP. In a production system, this should be moved to a shared package.
 */
export const forUlyanaChecklist: AdvancedChecklist = {
  id: "for-ulyana-checklist",
  name: "Для Ульяны",
  version: "1.0",
  type: "advanced",
  totalScore: 13,
  stages: [
    {
      id: "contact-establishment",
      name: "Установление контакта",
      order: 1,
      criteria: [
        {
          id: "contact-establishment-1",
          number: "1.1",
          title: "Установление контакта",
          description: "Менеджер устанавливает первичный контакт с клиентом",
          weight: 1,
          max: {
            description: "Менеджер поздоровался, представился, узнал имя клиента, установил раппорт",
            score: 1,
          },
          mid: {
            description: "Менеджер поздоровался и представился, но не установил полноценный контакт",
            score: 0.5,
          },
          min: {
            description: "Менеджер не установил контакт или сделал это формально",
            score: 0,
          },
        },
      ],
    },
    {
      id: "qualification",
      name: "Квалификация",
      order: 2,
      criteria: [
        {
          id: "qualification-1",
          number: "2.1",
          title: "Квалификация",
          description: "Менеджер проводит первичную квалификацию клиента",
          weight: 1,
          max: {
            description: "Менеджер выяснил ключевую информацию для квалификации (потребность, готовность, бюджет)",
            score: 1,
          },
          mid: {
            description: "Менеджер частично провел квалификацию, выяснил некоторые параметры",
            score: 0.5,
          },
          min: {
            description: "Менеджер не провел квалификацию",
            score: 0,
          },
        },
      ],
    },
    {
      id: "needs-identification",
      name: "Выявление потребностей",
      order: 3,
      criteria: [
        {
          id: "secondary-qualification-questions",
          number: "3.1",
          title: "Вопросы вторичной квалификации",
          description: "Менеджер задает уточняющие вопросы для глубокого понимания ситуации клиента",
          weight: 1,
          max: {
            description: "Менеджер задал несколько уточняющих вопросов, углубился в ситуацию клиента",
            score: 1,
          },
          mid: {
            description: "Менеджер задал 1-2 уточняющих вопроса",
            score: 0.5,
          },
          min: {
            description: "Менеджер не задавал уточняющих вопросов",
            score: 0,
          },
        },
        {
          id: "learning-goal-question",
          number: "3.2",
          title: "Вопрос о цели обучения",
          description: "Менеджер выясняет конкретную цель обучения клиента",
          weight: 1,
          max: {
            description: "Менеджер четко выяснил и зафиксировал цель обучения",
            score: 1,
          },
          mid: {
            description: "Менеджер задал вопрос о цели, но не получил четкого ответа",
            score: 0.5,
          },
          min: {
            description: "Менеджер не выяснял цель обучения",
            score: 0,
          },
        },
        {
          id: "needs-summary",
          number: "3.3",
          title: "Резюмирование потребности",
          description: "Менеджер резюмирует выявленные потребности клиента",
          weight: 1,
          max: {
            description: "Менеджер четко резюмировал потребности и получил подтверждение от клиента",
            score: 1,
          },
          mid: {
            description: "Менеджер попытался резюмировать, но сделал это не полностью",
            score: 0.5,
          },
          min: {
            description: "Менеджер не резюмировал потребности",
            score: 0,
          },
        },
      ],
    },
    {
      id: "presentation",
      name: "Презентация",
      order: 4,
      criteria: [
        {
          id: "presentation-from-needs",
          number: "4.1",
          title: "Презентация обучения из потребности клиента",
          description: "Менеджер презентует обучение, опираясь на выявленные потребности",
          weight: 1,
          max: {
            description: "Менеджер четко связал предложение с потребностями клиента",
            score: 1,
          },
          mid: {
            description: "Менеджер упомянул связь с потребностями, но не развил эту мысль",
            score: 0.5,
          },
          min: {
            description: "Менеджер не связал презентацию с потребностями",
            score: 0,
          },
        },
        {
          id: "format-presentation",
          number: "4.2",
          title: "Презентация формата обучения",
          description: "Менеджер презентует формат обучения (онлайн/оффлайн, индивидуально/группа)",
          weight: 1,
          max: {
            description: "Менеджер четко описал формат обучения и его преимущества",
            score: 1,
          },
          mid: {
            description: "Менеджер упомянул формат, но не раскрыл детали",
            score: 0.5,
          },
          min: {
            description: "Менеджер не презентовал формат обучения",
            score: 0,
          },
        },
        {
          id: "cost-presentation",
          number: "4.3",
          title: "Презентация стоимости",
          description: "Менеджер презентует стоимость обучения",
          weight: 1,
          max: {
            description: "Менеджер четко озвучил стоимость с обоснованием ценности",
            score: 1,
          },
          mid: {
            description: "Менеджер озвучил стоимость, но без обоснования",
            score: 0.5,
          },
          min: {
            description: "Менеджер не озвучил стоимость",
            score: 0,
          },
        },
        {
          id: "trial-lesson-info",
          number: "4.4",
          title: "Озвучивание информации для проведения пробного занятия",
          description: "Менеджер сообщает необходимую информацию для организации пробного занятия",
          weight: 1,
          max: {
            description: "Менеджер полностью описал процесс и детали пробного занятия",
            score: 1,
          },
          mid: {
            description: "Менеджер упомянул пробное занятие, но не раскрыл все детали",
            score: 0.5,
          },
          min: {
            description: "Менеджер не озвучил информацию о пробном занятии",
            score: 0,
          },
        },
      ],
    },
    {
      id: "objection-handling",
      name: "Работа с возражениями",
      order: 5,
      criteria: [
        {
          id: "objections-handling",
          number: "5.1",
          title: "Работа с возражениями",
          description: "Менеджер эффективно работает с возражениями клиента",
          weight: 1,
          max: {
            description: "Менеджер выслушал возражения, проявил эмпатию, привел убедительные аргументы",
            score: 1,
          },
          mid: {
            description: "Менеджер ответил на возражения, но не полностью их обработал",
            score: 0.5,
          },
          min: {
            description: "Менеджер не обработал возражения или возражений не было",
            score: 0,
          },
        },
      ],
    },
    {
      id: "closing",
      name: "Завершение сделки",
      order: 6,
      criteria: [
        {
          id: "closing-deal",
          number: "6.1",
          title: "Завершение сделки",
          description: "Менеджер договаривается о следующих шагах и закрывает сделку",
          weight: 1,
          max: {
            description: "Менеджер четко зафиксировал договоренности и назначил следующие действия",
            score: 1,
          },
          mid: {
            description: "Менеджер обсудил следующие шаги, но без четких договоренностей",
            score: 0.5,
          },
          min: {
            description: "Менеджер не зафиксировал следующие шаги",
            score: 0,
          },
        },
      ],
    },
    {
      id: "voice-characteristics",
      name: "Голосовые характеристики",
      order: 7,
      criteria: [
        {
          id: "speech-quality",
          number: "7.1",
          title: "Оценивается грамотность и формулировки",
          description: "Менеджер говорит грамотно, использует правильные формулировки",
          weight: 1,
          max: {
            description: "Менеджер говорит грамотно, четко формулирует мысли, без слов-паразитов",
            score: 1,
          },
          mid: {
            description: "Менеджер в целом говорит грамотно, но есть небольшие недочеты",
            score: 0.5,
          },
          min: {
            description: "Менеджер говорит неграмотно или с множеством ошибок",
            score: 0,
          },
        },
        {
          id: "dialogue-leadership",
          number: "7.2",
          title: "Инициатива за ведение диалога",
          description: "Менеджер ведет диалог и сохраняет инициативу",
          weight: 1,
          max: {
            description: "Менеджер полностью контролирует ход диалога, задает вопросы, ведет к цели",
            score: 1,
          },
          mid: {
            description: "Менеджер частично ведет диалог, но иногда теряет инициативу",
            score: 0.5,
          },
          min: {
            description: "Менеджер не контролирует диалог, инициатива у клиента",
            score: 0,
          },
        },
      ],
    },
  ],
};
