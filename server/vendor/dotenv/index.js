const fs = require("fs");
const path = require("path");

function parse(content) {
  const result = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    if (!rawLine || /^\s*[#;]/.test(rawLine)) {
      continue;
    }

    const match = rawLine.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2] ?? "";

    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function config(options = {}) {
  const envPath = options.path || path.resolve(process.cwd(), ".env");
  const encoding = options.encoding || "utf8";

  try {
    if (!fs.existsSync(envPath)) {
      return { parsed: undefined };
    }

    const content = fs.readFileSync(envPath, encoding);
    const parsed = parse(content);

    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }

    return { parsed };
  } catch (error) {
    return { error };
  }
}

module.exports = { config };
module.exports.default = { config };
