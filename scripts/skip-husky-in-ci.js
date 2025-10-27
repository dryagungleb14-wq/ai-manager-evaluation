// scripts/skip-husky-in-ci.js
const isCI = Boolean(process.env.CI || process.env.VERCEL || process.env.RAILWAY);
if (isCI) {
  console.log("CI detected -> disabling husky install");
  process.env.HUSKY = "0";
}
