import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default [
    {
        ignores: ['**/build/', '**/.prettierrc.js', '**/.eslintrc.js', 'admin/words.js', '**/test/', '.dev-server/**'],
    },
    ...compat.extends('plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'),
    {
        plugins: {},

        languageOptions: {
            parser: tsParser,
            ecmaVersion: 'latest',
            sourceType: 'module',

            parserOptions: {
                project: './tsconfig.json',
            },
        },

        rules: {
            '@typescript-eslint/no-parameter-properties': 'off',
            '@typescript-eslint/no-explicit-any': 'off',

            '@typescript-eslint/no-use-before-define': [
                'error',
                {
                    functions: false,
                    typedefs: false,
                    classes: false,
                },
            ],

            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    ignoreRestSiblings: true,
                    argsIgnorePattern: '^_',
                },
            ],

            '@typescript-eslint/explicit-function-return-type': [
                'warn',
                {
                    allowExpressions: true,
                    allowTypedFunctionExpressions: true,
                },
            ],

            '@typescript-eslint/no-object-literal-type-assertion': 'off',
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            'no-var': 'error',
            'prefer-const': 'error',
            'no-trailing-spaces': 'error',
        },
    },
    {
        files: ['**/*.test.ts'],

        rules: {
            '@typescript-eslint/explicit-function-return-type': 'off',
        },
    },
];
