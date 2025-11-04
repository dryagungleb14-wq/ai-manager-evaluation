import config from "./client/tailwind.config";

export default {
  ...config,
  content: [
    "./client/index.html",
    "./client/src/**/*.{ts,tsx,js,jsx}",
  ],
};
