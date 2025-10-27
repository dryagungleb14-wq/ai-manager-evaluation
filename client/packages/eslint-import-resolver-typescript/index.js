const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const projectCache = new Map();

function ensureConfigFile(projectPath, cwd) {
  if (!projectPath) {
    return path.resolve(cwd, 'tsconfig.json');
  }

  let resolved = path.resolve(cwd, projectPath);

  try {
    const stats = fs.statSync(resolved);
    if (stats.isDirectory()) {
      const candidate = path.join(resolved, 'tsconfig.json');
      if (fs.existsSync(candidate)) {
        resolved = candidate;
      }
    }
  } catch (error) {
    // File might not exist yet. Leave resolved path as-is so TypeScript can handle the error.
  }

  return resolved;
}

function readProjectConfig(projectPath, cwd) {
  const normalized = ensureConfigFile(projectPath, cwd);

  if (projectCache.has(normalized)) {
    return projectCache.get(normalized);
  }

  if (!fs.existsSync(normalized)) {
    projectCache.set(normalized, null);
    return null;
  }

  const configFile = ts.readConfigFile(normalized, ts.sys.readFile);

  if (configFile.error) {
    projectCache.set(normalized, null);
    return null;
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(normalized),
    undefined,
    normalized,
  );

  projectCache.set(normalized, parsed);
  return parsed;
}

function createModuleResolver(cwd) {
  return {
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    realpath: ts.sys.realpath,
    directoryExists: ts.sys.directoryExists,
    getCurrentDirectory: () => cwd,
    getDirectories: ts.sys.getDirectories,
  };
}

function resolveWithProject(source, file, project, cwd) {
  const parsedConfig = readProjectConfig(project, cwd);

  if (!parsedConfig) {
    return null;
  }

  const compilerOptions = parsedConfig.options || {};
  const host = createModuleResolver(cwd);
  const containingFile = file || path.join(cwd, '__placeholder__.ts');
  const resolution = ts.resolveModuleName(source, containingFile, compilerOptions, host);

  if (resolution && resolution.resolvedModule && resolution.resolvedModule.resolvedFileName) {
    return {
      found: true,
      path: resolution.resolvedModule.resolvedFileName,
    };
  }

  return null;
}

exports.interfaceVersion = 2;

exports.resolve = function resolve(source, file, options = {}) {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const projectsOption = options.project;
  const projects = Array.isArray(projectsOption)
    ? projectsOption
    : projectsOption
      ? [projectsOption]
      : ['./tsconfig.json'];

  for (const project of projects) {
    const result = resolveWithProject(source, file, project, cwd);
    if (result) {
      return result;
    }
  }

  try {
    const paths = file ? [path.dirname(file), cwd] : [cwd];
    const resolvedPath = require.resolve(source, { paths });
    return {
      found: true,
      path: resolvedPath,
    };
  } catch (error) {
    return {
      found: false,
    };
  }
};

exports.clearCache = function clearCache() {
  projectCache.clear();
};
