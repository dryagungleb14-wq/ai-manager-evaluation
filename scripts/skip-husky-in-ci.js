// scripts/skip-husky-in-ci.js
const isCI = !!(process.env.CI || process.env.VERCEL || process.env.RAILWAY);
if (isCI) {
  // Husky уважает переменную HUSKY=0
  console.log("CI detected -> disabling husky install");
  process.env.HUSKY = "0";
}
