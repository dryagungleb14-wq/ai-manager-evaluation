import type { Request, RequestHandler } from "express";

interface AuthGuardOptions {
  enabled?: boolean;
  publicRoutes?: string[];
  publicPrefixes?: string[];
  protectedRoutes?: string[];
  protectedPrefixes?: string[];
  protectedMethods?: string[];
  headerNames?: string[];
  cookieNames?: string[];
}

interface AuthGuardHandler extends RequestHandler {
  enabled: boolean;
}

const DEFAULT_PUBLIC_ROUTES = [
  "/",
  "/index.html",
  "/health",
  "/healthz",
  "/version",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

const DEFAULT_PUBLIC_PREFIXES = [
  "/assets/",
  "/static/",
  "/public/",
  "/client/",
  "/dist/",
  "/_next/",
];

const DEFAULT_PROTECTED_PREFIXES = [
  "/api/admin/",
  "/api/internal/",
];

const DEFAULT_PROTECTED_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

const DEFAULT_HEADER_NAMES = ["authorization"];

const DEFAULT_COOKIE_NAMES = [
  "auth_token",
  "token",
  "access_token",
  "session",
  "sessionid",
  "jwt",
  "jwt_token",
];

const STATIC_ASSET_EXTENSION = /\.(?:css|js|mjs|cjs|map|png|jpg|jpeg|gif|svg|ico|webp|avif|txt|json|wasm|woff2?|ttf|eot)$/i;

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "") {
    return fallback;
  }

  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off", "disabled"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function readEnvList(name: string): string[] {
  const raw = process.env[name];
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map(entry => entry.trim())
    .filter((entry): entry is string => entry.length > 0);
}

function envHasKey(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(process.env, name);
}

function ensureLeadingSlash(value: string): string {
  if (!value.startsWith("/")) {
    return `/${value}`;
  }

  return value;
}

function normalizeRoute(route: string): string {
  const trimmed = route.trim();
  if (!trimmed) {
    return "/";
  }

  let normalized = ensureLeadingSlash(trimmed);
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, "");
    if (normalized.length === 0) {
      return "/";
    }
    if (!normalized.startsWith("/")) {
      normalized = `/${normalized}`;
    }
  }

  return normalized || "/";
}

function normalizePrefix(prefix: string): string {
  const normalized = normalizeRoute(prefix);
  if (normalized === "/") {
    return "/";
  }

  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function normalizeRequestPath(path: string | undefined): string {
  if (!path) {
    return "/";
  }

  if (path === "/") {
    return "/";
  }

  return path.replace(/\/+$/, "");
}

function pathMatchesPrefix(path: string, prefix: string): boolean {
  if (prefix === "/") {
    return true;
  }

  if (path === prefix.slice(0, -1)) {
    return true;
  }

  return path.startsWith(prefix);
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawKey, rawValue] = part.split("=");
    const key = rawKey?.trim();
    if (!key) {
      return acc;
    }

    const value = rawValue?.trim();
    acc[key.toLowerCase()] = value ? decodeURIComponent(value) : "";
    return acc;
  }, {});
}

function hasAuthCredentials(
  req: Request,
  headerNames: Set<string>,
  cookieNames: Set<string>,
): boolean {
  for (const headerName of headerNames) {
    const headerValue = req.headers[headerName];
    if (typeof headerValue === "string" && headerValue.trim().length > 0) {
      return true;
    }

    if (Array.isArray(headerValue) && headerValue.some(value => value.trim().length > 0)) {
      return true;
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  for (const cookieName of cookieNames) {
    const cookieValue = cookies[cookieName];
    if (cookieValue && cookieValue.length > 0) {
      return true;
    }
  }

  return false;
}

export function createAuthGuard(options: AuthGuardOptions = {}): AuthGuardHandler {
  const envEnabled = parseBoolean(process.env.AUTH_GUARD_ENABLED, true);
  const envDisabled = parseBoolean(process.env.AUTH_GUARD_DISABLED, false);
  const isEnabled = typeof options.enabled === "boolean"
    ? options.enabled
    : envEnabled && !envDisabled;

  const publicRoutes = new Set(
    [
      ...DEFAULT_PUBLIC_ROUTES,
      ...readEnvList("AUTH_PUBLIC_ROUTES"),
      ...(options.publicRoutes ?? []),
    ].map(normalizeRoute),
  );

  const publicPrefixes = [
    ...DEFAULT_PUBLIC_PREFIXES,
    ...readEnvList("AUTH_PUBLIC_PREFIXES"),
    ...(options.publicPrefixes ?? []),
  ].map(normalizePrefix);

  const protectedRoutes = new Set(
    [
      ...readEnvList("AUTH_PROTECTED_ROUTES"),
      ...(options.protectedRoutes ?? []),
    ].map(normalizeRoute),
  );

  const envProtectedPrefixesDefined = envHasKey("AUTH_PROTECTED_PREFIXES");
  const envProtectedPrefixes = readEnvList("AUTH_PROTECTED_PREFIXES");
  const hasCustomProtectedPrefixes = envProtectedPrefixesDefined || options.protectedPrefixes !== undefined;
  const protectedPrefixes = (
    hasCustomProtectedPrefixes
      ? [...envProtectedPrefixes, ...(options.protectedPrefixes ?? [])]
      : DEFAULT_PROTECTED_PREFIXES
  ).map(normalizePrefix);

  const envProtectedMethodsDefined = envHasKey("AUTH_PROTECTED_METHODS");
  const envProtectedMethods = readEnvList("AUTH_PROTECTED_METHODS");
  const methodsConfigured = options.protectedMethods !== undefined || envProtectedMethodsDefined;
  const protectedMethodsSource = options.protectedMethods
    ?? (envProtectedMethodsDefined ? envProtectedMethods : DEFAULT_PROTECTED_METHODS);
  const protectedMethods = new Set(
    protectedMethodsSource
      .map(method => method.toUpperCase())
      .filter(method => method.length > 0),
  );

  if (!methodsConfigured && protectedMethods.size === 0) {
    DEFAULT_PROTECTED_METHODS.forEach(method => protectedMethods.add(method));
  }

  const headerNames = new Set(
    [
      ...DEFAULT_HEADER_NAMES,
      ...readEnvList("AUTH_HEADER_NAMES").map(name => name.toLowerCase()),
      ...(options.headerNames ?? []).map(name => name.toLowerCase()),
    ],
  );

  const cookieNames = new Set(
    [
      ...DEFAULT_COOKIE_NAMES,
      ...readEnvList("AUTH_COOKIE_NAMES").map(name => name.toLowerCase()),
      ...(options.cookieNames ?? []).map(name => name.toLowerCase()),
    ],
  );

  const handler: AuthGuardHandler = (req, res, next) => {
    if (!isEnabled) {
      next();
      return;
    }

    if (req.method === "OPTIONS" || req.method === "HEAD") {
      next();
      return;
    }

    const path = normalizeRequestPath(req.path);

    if (
      publicRoutes.has(path)
      || publicPrefixes.some(prefix => pathMatchesPrefix(path, prefix))
      || STATIC_ASSET_EXTENSION.test(path)
    ) {
      next();
      return;
    }

    if (protectedRoutes.has(path)) {
      if (!hasAuthCredentials(req, headerNames, cookieNames)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      next();
      return;
    }

    const method = req.method.toUpperCase();
    if (!protectedMethods.has(method)) {
      next();
      return;
    }

    if (!protectedPrefixes.some(prefix => pathMatchesPrefix(path, prefix))) {
      next();
      return;
    }

    if (!hasAuthCredentials(req, headerNames, cookieNames)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    next();
  };

  handler.enabled = isEnabled;
  return handler;
}

export type { AuthGuardOptions, AuthGuardHandler };
