import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Compat pour consommer "next/core-web-vitals" (format .eslintrc) en flat config
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  // Ignorer build & assets
  { ignores: ['node_modules/**', '.next/**', 'public/**'] },

  // Équivaut à "extends: 'next/core-web-vitals'" mais compatible flat config
  ...compat.extends('next/core-web-vitals'),

  // Règles perso (optionnel)
  {
    rules: {
      // exemples:
      // 'no-console': 'warn',
      // '@next/next/no-img-element': 'off',
    },
  },
];

export default eslintConfig;
