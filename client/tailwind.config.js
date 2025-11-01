/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: { extend: {} },
  safelist: [
    "container","mx-auto","grid","gap-2","gap-4",
    "text-sm","text-base","text-lg","font-medium",
    "bg-muted","bg-primary","text-primary-foreground",
    "border","border-input","rounded-md","p-2","p-4",
    "data-[state=open]:animate-in",
    "data-[state=closed]:animate-out",
    "data-[state=active]:bg-accent"
  ],
};
