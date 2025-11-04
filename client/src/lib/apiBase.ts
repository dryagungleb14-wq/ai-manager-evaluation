const API_URL_PATTERN = /^https?:\/\//i;

function normalizePath(path: string): string {
  if (!path) {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

export function getApiBaseUrl(): string {
  const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
  return rawBaseUrl.replace(/\/$/, "");
}

let configWarningShown = false;

export function buildApiUrl(path: string): string {
  if (API_URL_PATTERN.test(path)) {
    return path;
  }

  const baseUrl = getApiBaseUrl();
  const normalizedPath = normalizePath(path);

  if (!baseUrl && import.meta.env.PROD && !configWarningShown) {
    configWarningShown = true;
    console.error(
      "[API Config] VITE_API_BASE_URL не установлен. " +
      "API запросы будут отправляться на текущий домен. " +
      "Для работы с отдельным бэкендом установите VITE_API_BASE_URL в переменных окружения Vercel."
    );
  }

  const finalUrl = baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
  
  if (import.meta.env.DEV) {
    console.log(`[API] ${normalizedPath} -> ${finalUrl}`);
  }

  return finalUrl;
}
