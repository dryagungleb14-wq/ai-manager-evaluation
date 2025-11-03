import { AdvancedChecklist } from "@/lib/rest";

/**
 * Чек-лист "До пробного этапа"
 * Детализированный чек-лист для оценки качества работы менеджера на этапе до пробного периода
 * с использованием системы оценки MAX/MID/MIN
 */
export const preTrialChecklist: AdvancedChecklist = {
  id: "pre-trial-checklist",
  name: "Чек-лист до пробного этапа",
  version: "1.0",
  type: "advanced",
  totalScore: 100,
  stages: [
    {
      id: "contact-establishment",
      name: "Установление контакта",
      order: 1,
      criteria: [
        {
          id: "greeting",
          number: "1.1",
          title: "Приветствие",
          description: "Менеджер приветствует клиента профессионально и дружелюбно",
          weight: 5,
          max: {
            description: "Менеджер тепло поприветствовал клиента, представился полностью (имя, компания), спросил как к нему обращаться",
            score: 5,
          },
          mid: {
            description: "Менеджер поздоровался и представился, но без особой теплоты",
            score: 3,
          },
          min: {
            description: "Менеджер не поздоровался или сделал это формально",
            score: 0,
          },
        },
        {
          id: "rapport",
          number: "1.2",
          title: "Установление раппорта",
          description: "Менеджер создаёт доверительную атмосферу",
          weight: 5,
          max: {
            description: "Менеджер задал вопросы о самочувствии, погоде, или сделал уместный комплимент, клиент расслабился",
            score: 5,
          },
          mid: {
            description: "Менеджер попытался наладить контакт, но это было несколько формально",
            score: 3,
          },
          min: {
            description: "Менеджер сразу перешёл к делу без установления контакта",
            score: 0,
          },
        },
        {
          id: "time-check",
          number: "1.3",
          title: "Определение времени",
          description: "Менеджер уточняет, удобно ли клиенту говорить",
          weight: 5,
          max: {
            description: 'Менеджер спросил "Вам удобно говорить?" и предложил перезвонить в другое время',
            score: 5,
          },
          mid: {
            description: "Менеджер спросил об удобстве, но не предложил альтернативу",
            score: 3,
          },
          min: {
            description: "Менеджер не уточнил удобство времени",
            score: 0,
          },
        },
        {
          id: "call-purpose",
          number: "1.4",
          title: "Озвучивание цели звонка",
          description: "Менеджер чётко объясняет причину звонка",
          weight: 5,
          max: {
            description: "Менеджер кратко и понятно объяснил цель звонка, упомянул выгоду для клиента",
            score: 5,
          },
          mid: {
            description: "Менеджер озвучил цель, но не очень понятно",
            score: 3,
          },
          min: {
            description: "Цель звонка не озвучена или озвучена непонятно",
            score: 0,
          },
        },
      ],
    },
    {
      id: "needs-diagnosis",
      name: "Диагностика потребностей",
      order: 2,
      criteria: [
        {
          id: "current-situation",
          number: "2.1",
          title: "Вопросы о текущей ситуации",
          description: "Менеджер задаёт открытые вопросы о текущей ситуации клиента",
          weight: 10,
          max: {
            description: "Менеджер задал 3+ открытых вопроса, внимательно слушал ответы, делал уточнения",
            score: 10,
          },
          mid: {
            description: "Менеджер задал 1-2 вопроса, слушал невнимательно",
            score: 5,
          },
          min: {
            description: "Менеджер не задавал вопросы о ситуации",
            score: 0,
          },
        },
        {
          id: "problem-identification",
          number: "2.2",
          title: "Выявление проблемы",
          description: "Менеджер определяет основную проблему или потребность клиента",
          weight: 10,
          max: {
            description: "Менеджер чётко сформулировал проблему клиента и получил подтверждение",
            score: 10,
          },
          mid: {
            description: "Менеджер понял проблему, но не озвучил её явно",
            score: 5,
          },
          min: {
            description: "Проблема не выявлена",
            score: 0,
          },
        },
        {
          id: "solution-criteria",
          number: "2.3",
          title: "Определение критериев решения",
          description: "Менеджер выясняет, что важно клиенту при выборе решения",
          weight: 10,
          max: {
            description: "Менеджер спросил о критериях (цена, сроки, качество) и записал приоритеты",
            score: 10,
          },
          mid: {
            description: "Менеджер частично выяснил критерии",
            score: 5,
          },
          min: {
            description: "Критерии не выяснены",
            score: 0,
          },
        },
      ],
    },
    {
      id: "solution-presentation",
      name: "Презентация решения",
      order: 3,
      criteria: [
        {
          id: "need-connection",
          number: "3.1",
          title: "Связь с потребностью",
          description: "Менеджер показывает, как продукт решает проблему клиента",
          weight: 10,
          max: {
            description: "Менеджер чётко связал функции продукта с выявленными потребностями",
            score: 10,
          },
          mid: {
            description: "Связь прослеживается, но не явная",
            score: 5,
          },
          min: {
            description: "Связь с потребностью не показана",
            score: 0,
          },
        },
        {
          id: "benefit-language",
          number: "3.2",
          title: "Использование языка выгод",
          description: "Менеджер говорит на языке выгод, а не характеристик",
          weight: 8,
          max: {
            description: 'Менеджер использовал формулу "Это означает, что вы..." для каждой характеристики',
            score: 8,
          },
          mid: {
            description: "Упомянуты выгоды, но не систематически",
            score: 4,
          },
          min: {
            description: "Только характеристики, без выгод",
            score: 0,
          },
        },
        {
          id: "examples-cases",
          number: "3.3",
          title: "Примеры и кейсы",
          description: "Менеджер приводит примеры успешного использования",
          weight: 7,
          max: {
            description: "Менеджер рассказал релевантный кейс с цифрами и результатами",
            score: 7,
          },
          mid: {
            description: "Упомянут пример, но без деталей",
            score: 4,
          },
          min: {
            description: "Примеры не приведены",
            score: 0,
          },
        },
      ],
    },
    {
      id: "objection-handling",
      name: "Работа с возражениями",
      order: 4,
      criteria: [
        {
          id: "active-listening",
          number: "4.1",
          title: "Активное слушание",
          description: "Менеджер внимательно слушает возражение, не перебивает",
          weight: 5,
          max: {
            description: "Менеджер дал клиенту договорить, повторил возражение своими словами",
            score: 5,
          },
          mid: {
            description: "Менеджер выслушал, но перебил",
            score: 3,
          },
          min: {
            description: "Менеджер не слушал или перебил",
            score: 0,
          },
        },
        {
          id: "empathy",
          number: "4.2",
          title: "Эмпатия",
          description: "Менеджер показывает понимание",
          weight: 5,
          max: {
            description: 'Менеджер сказал "Я понимаю ваши опасения" и объяснил почему это важно',
            score: 5,
          },
          mid: {
            description: "Показал понимание формально",
            score: 3,
          },
          min: {
            description: "Эмпатия не проявлена",
            score: 0,
          },
        },
        {
          id: "argumentation",
          number: "4.3",
          title: "Аргументация",
          description: "Менеджер приводит убедительные аргументы",
          weight: 5,
          max: {
            description: "Менеджер привёл 2+ сильных аргумента с фактами/цифрами",
            score: 5,
          },
          mid: {
            description: "Привёл 1 аргумент",
            score: 3,
          },
          min: {
            description: "Аргументы не приведены",
            score: 0,
          },
        },
      ],
    },
    {
      id: "closing",
      name: "Завершение",
      order: 5,
      criteria: [
        {
          id: "summary",
          number: "5.1",
          title: "Резюме договорённостей",
          description: "Менеджер подводит итог разговора",
          weight: 5,
          max: {
            description: "Менеджер чётко перечислил все договорённости и получил подтверждение",
            score: 5,
          },
          mid: {
            description: "Резюме есть, но не полное",
            score: 3,
          },
          min: {
            description: "Резюме не сделано",
            score: 0,
          },
        },
        {
          id: "next-step",
          number: "5.2",
          title: "Следующий шаг",
          description: "Менеджер назначает конкретное следующее действие",
          weight: 5,
          max: {
            description: "Назначена встреча/звонок с конкретной датой и временем",
            score: 5,
          },
          mid: {
            description: "Следующий шаг озвучен, но без конкретики",
            score: 3,
          },
          min: {
            description: "Следующий шаг не определён",
            score: 0,
          },
        },
      ],
    },
  ],
};
