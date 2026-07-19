import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // `next lint` applied these implicitly; the ESLint CLI does not, so
    // they have to be declared. design-lab/ is a standalone Vite app
    // that lints under its own config.
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "design-lab/**",
      // Repo tooling, not application code. `next lint` only ever
      // scanned app directories, so these were never linted; the CLI
      // scans the whole tree and would otherwise report ~140 warnings.
      "skills/**",
      ".design-sync/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
