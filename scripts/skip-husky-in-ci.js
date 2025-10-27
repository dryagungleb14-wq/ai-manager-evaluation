// scripts/skip-husky-in-ci.js
const isCI = !!(process.env.CI || process.env.VERCEL || process.env.RAILWAY);
if (isCI) {
  // Важный момент: печать в лог для диагностики
  console.log("CI detected -> disabling husky install and using public npm registry");
  process.env.HUSKY = "0";
  process.env.NPM_CONFIG_REGISTRY = "https://registry.npmjs.org/";
}
