import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { qaApiPlugin } from "./server/qa-plugin";

// Load packages/ai-service/.env into process.env before the QA middleware
// boots. The ai-service reads ANTHROPIC_API_KEY / OPENAI_API_KEY off
// process.env, and Vite doesn't auto-load env files for the Node-side plugins.
// Using Node's built-in process.loadEnvFile keeps us off a third-party dep.
// Existing shell vars win over the file (loadEnvFile doesn't override).
const envPath = fileURLToPath(
  new URL("../../packages/ai-service/.env", import.meta.url),
);
try {
  process.loadEnvFile(envPath);
} catch {
  // .env is optional — only required if the dev wants to actually call /api/qa.
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    qaApiPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
