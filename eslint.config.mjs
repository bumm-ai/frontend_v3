import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      // Build output can live nested under Claude worktrees too — match any
      // depth so a stray .claude/worktrees/*/.next/ never pollutes the lint.
      "**/.next/**",
      ".claude/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Untracked, git-ignored ad-hoc debug scripts at the repo root (CommonJS,
      // not part of the app/build). Absent in CI; ignore so local lint matches.
      "fix-*.js",
    ],
  },
  {
    rules: {
      // Underscore-prefixed identifiers are an explicit "intentionally unused"
      // convention (placeholder params, legacy-compat no-op args, caught errors
      // we deliberately swallow). Don't flag them.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;
