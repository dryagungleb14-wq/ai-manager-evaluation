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

## Проверки после деплоя
- Клиентские роуты открываются без ошибок.
- API-запросы уходят на адрес, указанный в `VITE_API_BASE_URL`.

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
