# Решение проблемы "Нет доступных чек-листов" на Vercel

## Описание проблемы

После деплоя фронтенда на Vercel в интерфейсе приложения отображается сообщение "Нет доступных чек-листов" или "Ошибка загрузки чек-листов".

## Причина

Приложение использует **раздельную архитектуру деплоя**:
- Фронтенд (статические файлы) → Vercel
- Бэкенд (API сервер) → Railway или другой хостинг

Проблема возникает когда:
1. Переменная окружения `VITE_API_BASE_URL` не установлена в настройках Vercel
2. Бэкенд не развернут или недоступен
3. URL бэкенда указан неправильно

## Диагностика

### 1. Проверка консоли браузера

Откройте консоль разработчика (F12) и найдите сообщения:

```
[API Config] VITE_API_BASE_URL не установлен. 
API запросы будут отправляться на текущий домен.
```

Или ошибки загрузки:

```
[Checklist Selector] Ошибка загрузки чек-листов
[Checklist Selector] Проверьте настройку VITE_API_BASE_URL и доступность бэкенда
```

### 2. Проверка Network вкладки

В Network вкладке браузера проверьте куда отправляются запросы к `/api/checklists`:
- **Неправильно**: `https://your-app.vercel.app/api/checklists` (404)
- **Правильно**: `https://your-backend.railway.app/api/checklists` (200)

### 3. Проверка переменных окружения в Vercel

1. Зайдите в настройки проекта на Vercel
2. Откройте вкладку **Settings → Environment Variables**
3. Проверьте наличие `VITE_API_BASE_URL`

## Решение

### Шаг 1: Разверните бэкенд

Бэкенд должен быть развернут отдельно на Railway, Render или другом сервисе.

Следуйте инструкциям из [README_BACKEND_DEPLOY.md](./README_BACKEND_DEPLOY.md).

**Важные переменные окружения для бэкенда:**
- `DATABASE_URL` - PostgreSQL подключение (обязательно для production)
- `GEMINI_API_KEY` - ключ для AI анализа
- `SESSION_SECRET` - секрет для сессий (обязательно для production)
- `FRONTEND_ORIGIN` - URL вашего Vercel деплоя для CORS

### Шаг 2: Настройте VITE_API_BASE_URL в Vercel

1. Зайдите в **Vercel Dashboard → Settings → Environment Variables**
2. Добавьте новую переменную:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://your-backend.railway.app` (URL вашего бэкенда)
   - **Environment**: Production (и Preview, если нужно)
3. Нажмите **Save**

### Шаг 3: Пересоберите деплой

После добавления переменной окружения:
1. Перейдите в **Deployments**
2. Найдите последний деплой
3. Нажмите **⋯ → Redeploy**

Или просто сделайте новый коммит в main ветку.

## Проверка работоспособности

### 1. Проверка бэкенда

```bash
curl https://your-backend.railway.app/healthz
```

Ожидаемый ответ:
```json
{
  "ok": true,
  "geminiKey": true,
  "version": "1.0.0"
}
```

### 2. Проверка API чек-листов

```bash
curl https://your-backend.railway.app/api/checklists
```

Должен вернуть массив чек-листов (минимум 2 дефолтных).

### 3. Проверка фронтенда

1. Откройте приложение на Vercel
2. Откройте консоль разработчика (F12)
3. В консоли должны быть логи вида:
   ```
   [API] /api/checklists -> https://your-backend.railway.app/api/checklists
   ```
4. Чек-листы должны загрузиться и отобразиться в интерфейсе

## Автоматическая инициализация чек-листов

При первом запуске бэкенд автоматически создает дефолтные чек-листы:

**Простые чек-листы:**
1. "Продажи B2B — базовый"
2. "Качество поддержки клиентов"

**Продвинутые чек-листы:**
1. "Чек-лист до пробного этапа"
2. "Для Ульяны"

Это происходит в `server/index.ts` через функции:
- `seedDefaultChecklists()`
- `seedDefaultAdvancedChecklists()`

Инициализация выполняется только если БД пустая.

## Логи для отладки

### Логи бэкенда при старте

```
[storage] ✓ Database connection successful - using persistent storage
Seeding database with default checklists...
Seeded 2 default checklists
Seeding database with default advanced checklists...
Seeded 2 default advanced checklists
```

### Логи фронтенда при загрузке

В режиме разработки (`npm run dev`):
```
[API] /api/checklists -> http://localhost:3000/api/checklists
[API] /api/advanced-checklists -> http://localhost:3000/api/advanced-checklists
```

В production с `VITE_API_BASE_URL`:
```
[API] /api/checklists -> https://your-backend.railway.app/api/checklists
```

При ошибках:
```
[Checklist Selector] Ошибка загрузки чек-листов
[Checklist Selector] Проверьте настройку VITE_API_BASE_URL и доступность бэкенда
```

## Частые ошибки

### 1. CORS ошибка

**Симптом**: В консоли браузера "blocked by CORS policy"

**Решение**: Установите `FRONTEND_ORIGIN` на бэкенде:
```bash
FRONTEND_ORIGIN=https://your-app.vercel.app
```

### 2. 404 Not Found

**Симптом**: Запросы к `/api/checklists` возвращают 404

**Причина**: `VITE_API_BASE_URL` не установлен, запросы идут на Vercel

**Решение**: Установите `VITE_API_BASE_URL` в Vercel

### 3. Empty array

**Симптом**: API возвращает `[]`, но без ошибки

**Причина**: Бэкенд работает без БД (in-memory mode) или БД не инициализирована

**Решение**: 
1. Установите `DATABASE_URL` на бэкенде
2. Перезапустите бэкенд для инициализации дефолтных чек-листов

### 4. 503 Service Unavailable

**Симптом**: Бэкенд не отвечает

**Причина**: Бэкенд не запущен или спит (на бесплатных планах)

**Решение**: 
1. Проверьте статус деплоя на Railway
2. Откройте URL бэкенда чтобы "разбудить" сервис

## Итоговый чеклист

- [ ] Бэкенд развернут и доступен по URL
- [ ] На бэкенде установлены все обязательные переменные окружения
- [ ] `VITE_API_BASE_URL` установлен в Vercel и указывает на бэкенд
- [ ] `FRONTEND_ORIGIN` на бэкенде указывает на Vercel домен
- [ ] После изменения переменных выполнен redeploy
- [ ] API эндпоинты возвращают данные (проверено через curl)
- [ ] В консоли браузера нет ошибок CORS или 404
- [ ] Чек-листы отображаются в интерфейсе

## Дополнительная информация

- [README_DEPLOY.md](./README_DEPLOY.md) - инструкции по деплою фронтенда
- [README_BACKEND_DEPLOY.md](./README_BACKEND_DEPLOY.md) - инструкции по деплою бэкенда
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Railway Deployment](https://docs.railway.app/deploy/deployments)
