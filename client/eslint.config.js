import tsParser from '@typescript-eslint/parser';
import pluginImport from 'eslint-plugin-import';

const sharedSettings = {
  'import/parsers': {
    '@typescript-eslint/parser': ['.ts', '.tsx'],
  },
  'import/resolver': {
    typescript: {
      project: './tsconfig.json',
    },
    node: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
  },
};

export default [
  {
    ignores: ['dist', 'node_modules'],
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        window: 'readonly',
      },
    },
    plugins: {
      import: pluginImport,
    },
    settings: sharedSettings,
    rules: {
      'import/no-extraneous-dependencies': ['error', { packageDir: ['.'] }],
      'import/no-unresolved': 'error',
    },
  },
];
