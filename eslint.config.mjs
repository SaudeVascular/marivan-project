// Substitui o "react-app" do CRA: as regras que ele aplicava e que o
// projeto já seguia (hooks, imports não usados, Testing Library).
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import testingLibrary from 'eslint-plugin-testing-library';
import jestDom from 'eslint-plugin-jest-dom';
import jest from 'eslint-plugin-jest';

export default [
  { ignores: ['build/', 'coverage/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, process: 'readonly' },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // CEP e afins falham em silêncio de propósito (catch vazio).
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none' }],
    },
  },
  {
    files: ['src/**/*.test.{js,jsx}', 'src/**/__mocks__/**', 'src/setupTests.js', 'src/testes/**'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
    plugins: { jest },
    rules: { ...jest.configs['flat/recommended'].rules, 'jest/no-conditional-expect': 'off' },
  },
  { files: ['src/**/*.test.{js,jsx}'], ...testingLibrary.configs['flat/react'] },
  { files: ['src/**/*.test.{js,jsx}'], ...jestDom.configs['flat/recommended'] },
];
