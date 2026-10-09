import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  { languageOptions: { parserOptions: { projectService: true } } },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  // node:test's describe/it return promises that the runner tracks itself
  { files: ['**/test/**'], rules: { '@typescript-eslint/no-floating-promises': 'off' } },
  prettier,
);
