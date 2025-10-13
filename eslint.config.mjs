import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  {
    ignores: [
      "node_modules",
      ".next",
      ".vercel",
      "dist",
      "eslint.config.mjs"
    ]
  },
  ...compat.extends(
    "eslint:recommended",
    "plugin:import/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@next/next/recommended"
  ),
  ...compat.config({
    overrides: [
      {
        files: ["**/*.{ts,tsx}"],
        extends: ["plugin:@typescript-eslint/recommended"]
      },
      {
        files: ["**/*.config.{js,ts,mjs,cjs}", "*.config.{js,ts,mjs,cjs}", "next.config.mjs"],
        env: { node: true }
      }
    ]
  }),
  {
    settings: {
      react: { version: "detect" },
      "import/resolver": {
        node: { extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs"] },
        typescript: { alwaysTryTypes: true }
      }
    },
    rules: {
      "import/no-anonymous-default-export": "warn",
      "react/no-unknown-property": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "jsx-a11y/alt-text": [
        "warn",
        {
          elements: ["img"],
          img: ["Image"]
        }
      ],
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-proptypes": "warn",
      "jsx-a11y/aria-unsupported-elements": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/role-supports-aria-props": "warn",
      "react/jsx-no-target-blank": "off"
    }
  }
];
