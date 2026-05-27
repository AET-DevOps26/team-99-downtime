import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/client/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: './apps/client/tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'apps/*/build/**',
      '**/*.java',
      '**/*.py',
    ],
  },
);
