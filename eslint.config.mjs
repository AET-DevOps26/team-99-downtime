import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allow intentionally-unused identifiers prefixed with "_"
      // (e.g. stub props `_props`, ignored args/rest siblings).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
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
      '.nx/**',
      // Auto-generated OpenAPI client types, never hand-edited
      'apps/client/src/shared/api/generated/**',
      '**/*.java',
      '**/*.py',
    ],
  },
);
