import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist", "assets");
const cssFiles = readdirSync(dist).filter((file) => file.endsWith(".css"));

if (!cssFiles.length) {
  console.error("❌ No CSS bundle found in dist/assets");
  process.exit(1);
}

const total = cssFiles
  .map((file) => statSync(join(dist, file)).size)
  .reduce((acc, size) => acc + size, 0);

if (total < 50_000) {
  console.error(
    `❌ CSS too small: ${Math.round(total / 1024)} KB. Tailwind likely not applied.`,
  );
  process.exit(1);
}

console.log(`✅ CSS size OK: ${Math.round(total / 1024)} KB`);
