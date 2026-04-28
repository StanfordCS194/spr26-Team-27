import js from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import reactDom from "eslint-plugin-react-dom";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import reactX from "eslint-plugin-react-x";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["**/dist", "**/node_modules"]),
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        { allowExportNames: ["Route"] },
      ],
    },
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      reactX.configs["recommended-typescript"],
      reactDom.configs.recommended,
      eslintPluginPrettierRecommended,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["apps/web/src/routes/**/*.{ts,tsx}"],
    rules: {
      // TanStack Router's redirect() returns a Response (not Error), but throwing it
      // is the framework's intended pattern for redirects in beforeLoad/loader.
      "@typescript-eslint/only-throw-error": "off",
    },
  },
]);
