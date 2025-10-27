import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PLUGIN_NAME = "vite:tsconfig-paths-lite";

function normalizePattern(pattern) {
  return pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
}

function normalizeTarget(target) {
  return target.endsWith("*") ? target.slice(0, -1) : target;
}

function mergeAlias(configAlias, pattern, replacement) {
  if (Array.isArray(configAlias)) {
    const exists = configAlias.some((entry) => {
      if (typeof entry === "string") {
        return entry === pattern;
      }

      if (entry && typeof entry === "object" && "find" in entry) {
        return entry.find === pattern || entry.find?.toString() === pattern;
      }

      return false;
    });

    if (!exists) {
      configAlias.push({ find: pattern, replacement });
    }

    return configAlias;
  }

  const aliasObject = { ...(configAlias ?? {}) };
  if (!(pattern in aliasObject)) {
    aliasObject[pattern] = replacement;
  }

  return aliasObject;
}

function applyPathsAliases(config, root, baseUrl, paths) {
  const entries = Object.entries(paths);
  if (entries.length === 0) {
    return;
  }

  if (!config.resolve) {
    config.resolve = {};
  }

  const aliases = entries.reduce((currentAlias, [pattern, targets]) => {
    if (!Array.isArray(targets) || targets.length === 0) {
      return currentAlias;
    }

    const normalizedPattern = normalizePattern(pattern);
    const normalizedTarget = normalizeTarget(targets[0]);
    const replacement = resolve(root, baseUrl, normalizedTarget);

    if (!currentAlias) {
      if (Array.isArray(config.resolve.alias)) {
        currentAlias = [...config.resolve.alias];
      } else if (config.resolve.alias) {
        currentAlias = { ...config.resolve.alias };
      } else {
        currentAlias = {};
      }
    }

    return mergeAlias(currentAlias, normalizedPattern, replacement);
  }, undefined);

  if (aliases !== undefined) {
    config.resolve.alias = aliases;
  }
}

export default function tsconfigPaths(options = {}) {
  const projectFile = options.project ?? options.projects?.[0] ?? "tsconfig.json";

  return {
    name: PLUGIN_NAME,
    enforce: "pre",
    config(config) {
      const rootDir = config.root ? resolve(config.root) : process.cwd();
      const tsconfigPath = resolve(rootDir, projectFile);

      if (!existsSync(tsconfigPath)) {
        return;
      }

      let parsed;

      try {
        const raw = readFileSync(tsconfigPath, "utf-8");
        parsed = JSON.parse(raw);
      } catch {
        return;
      }

      const compilerOptions = parsed.compilerOptions ?? {};
      const baseUrl = compilerOptions.baseUrl ?? ".";
      const paths = compilerOptions.paths ?? {};

      applyPathsAliases(config, rootDir, baseUrl, paths);
    }
  };
}
