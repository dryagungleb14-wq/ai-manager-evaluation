# Деплой на Vercel

## Импорт проекта
1. Зайдите в [Vercel](https://vercel.com/) и нажмите **New Project**.
2. Выберите **Import Git Repository** и подключите этот репозиторий.

## Настройки сборки
- Корень фронтенда (FRONT_ROOT) — корень репозитория.
- В мастере можно оставить `vercel.json` из корня — он настроит сборку автоматически, менять Root Directory не нужно.
- Build Command и Output Directory будут подхвачены из `vercel.json`.

## Переменные окружения
1. В настройках проекта на вкладке **Environment Variables** добавьте переменную:
   - `VITE_API_BASE_URL` = `https://YOUR-BACKEND-URL`
2. Запустите пересборку деплоя.

**⚠️ ВАЖНО:** Без установки `VITE_API_BASE_URL` приложение не сможет загрузить чек-листы и другие данные!

Бэкенд должен быть развернут отдельно на Railway или другом сервисе. См. [README_BACKEND_DEPLOY.md](./README_BACKEND_DEPLOY.md).

## Проверки после деплоя
- Клиентские роуты открываются без ошибок.
- API-запросы уходят на адрес, указанный в `VITE_API_BASE_URL`.
- Чек-листы загружаются и отображаются в интерфейсе.

## Устранение неполадок

Если после деплоя отображается "Нет доступных чек-листов" или "Ошибка загрузки", см. подробное руководство:
**[VERCEL_CHECKLIST_FIX.md](./VERCEL_CHECKLIST_FIX.md)**

## Обновление проекта
- Любой push в ветку `main` запустит новый деплой.
- Pull Request создаёт preview-окружение.

## Локальная проверка
```bash
cd client
npm ci
npm run build
npm run preview
```
Предпросмотр Vite доступен по адресу http://localhost:4173.

## Зависимости клиента
- Все runtime-зависимости фронтенда описаны в `client/package.json` и устанавливаются командой `npm ci` в каталоге `client/`.
- Важные пакеты для роутинга и стилей: `wouter`, `tailwindcss`, `tailwindcss-animate`, `postcss`, `autoprefixer`.
- Конфигурационные файлы (`tailwind.config.ts`, `postcss.config.js`, `vite.config.ts`) находятся в каталоге `client/` и не используют импорты из корня.
