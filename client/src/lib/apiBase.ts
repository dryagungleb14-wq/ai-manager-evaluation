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

export function buildApiUrl(path: string): string {
  if (API_URL_PATTERN.test(path)) {
    return path;
  }

  const baseUrl = getApiBaseUrl();
  const normalizedPath = normalizePath(path);

  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
