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
    rules: {
      // Disable all strict TypeScript rules
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      
      // Disable React hooks rules
      "react-hooks/exhaustive-deps": "off",
      
      // Disable React rules
      "react/no-unescaped-entities": "off",
      
      // Disable Next.js specific rules
      "@next/next/no-img-element": "off",
      
      // Disable other rules
      "prefer-const": "off",
    },
  },
];

export default eslintConfig;
