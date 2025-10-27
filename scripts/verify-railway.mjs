import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportsDir = path.resolve(__dirname, "..", "reports");
const reportPath = path.join(reportsDir, "railway-health.json");

function normalizeUrl(rawUrl) {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, "");
  }
  return `https://${trimmed.replace(/\/$/, "")}`;
}

async function probeHealth(baseUrl) {
  const healthUrl = `${baseUrl}/healthz`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(healthUrl, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const text = await response.text();
    clearTimeout(timeoutId);

    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    return {
      status: response.ok ? "ok" : "error",
      httpStatus: response.status,
      ok: response.ok,
      url: healthUrl,
      body,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      status: "error",
      url: healthUrl,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  await fs.mkdir(reportsDir, { recursive: true });

  const report = {
    timestamp: new Date().toISOString(),
    discoveredUrl: null,
    healthz: {
      status: "pending",
      message: "Pending: public URL not discoverable automatically",
    },
    hints: [],
  };

  const envUrl = normalizeUrl(process.env.RAILWAY_PUBLIC_URL);
  if (envUrl) {
    report.discoveredUrl = envUrl;
    report.hints.push("URL source: RAILWAY_PUBLIC_URL environment variable");
    report.healthz = await probeHealth(envUrl);
  } else {
    const defaultUrl = normalizeUrl("https://ai-manager-evaluation.up.railway.app");
    const result = await probeHealth(defaultUrl);

    if (result.ok) {
      report.discoveredUrl = defaultUrl;
      report.hints.push("URL source: default ai-manager-evaluation.up.railway.app probe");
      report.healthz = result;
    } else {
      report.hints.push(
        "Public URL not detected automatically. Provide RAILWAY_PUBLIC_URL to enable the check.",
      );
    }
  }

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`Railway health report written to ${reportPath}`);

  if (report.discoveredUrl) {
    console.log(`Checked ${report.discoveredUrl}/healthz → ${report.healthz.httpStatus ?? "n/a"}`);
  } else {
    console.log(report.healthz.message);
  }
}

main().catch(error => {
  console.error("verify-railway.mjs failed:", error);
  process.exitCode = 1;
});
