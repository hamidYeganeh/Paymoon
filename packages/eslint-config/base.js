import js from "@eslint/js";
import ts from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";
export const config = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/out/**",
      "**/coverage/**",
      "**/android/**",
      "**/ios/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  prettier,
  {
    languageOptions: { globals: globals.node },
    rules: {
      "sort-imports": ["error", { ignoreDeclarationSort: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@repo/*/src/**", "**/apps/*/**"],
              message: "Use declared package public APIs.",
            },
            {
              group: ["lucide-react", "react-icons", "@heroicons/*"],
              message: "Use @repo/icons.",
            },
          ],
        },
      ],
    },
  },
];
