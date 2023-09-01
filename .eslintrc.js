module.exports = {
  plugins: [
    "@typescript-eslint", // prettier-ignore
    'import',
    'simple-import-sort',
    'prettier',
  ],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  ignorePatterns: ['/node_modules/', '/dist/', '/.turbo/'],
  rules: {
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-unnecessary-type-constraint': 'off',
    '@typescript-eslint/no-explicit-any': 'off', // bit spicy, i will concede
    '@typescript-eslint/no-unused-vars': 'off',
    'no-useless-computed-key': 'off',

    '@typescript-eslint/consistent-type-imports': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn', // default is error

    'simple-import-sort/imports': 'warn',
    // "simple-import-sort/exports": "warn",
    'import/newline-after-import': 'warn',
    'import/no-duplicates': 'warn',
    'import/no-unused-modules': 'warn',
    'prefer-const': [
      'warn',
      {
        destructuring: 'all',
        ignoreReadBeforeAssign: false,
      },
    ],
  },
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/external-module-folders': ['node_modules', 'packages'],
    // "import/internal-regex": "^@gita/",
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        // project: ["apps/*/tsconfig.json", "packages/*/tsconfig.json"],
      },
    },
    'simple-import-sort/imports': [
      'warn',
      {
        // groups: [
        //   // react first then other packages
        //   ["^react", "^(@(?!gita))?\\w"],
        //   // gita packages by themselves
        //   ["^@gita/"],
        //   // Side effect imports.
        //   ["^\\u0000"],
        //   // Parent imports. Put `..` last.
        //   ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
        //   // Other relative imports. Put same-folder imports and `.` last.
        //   ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
        //   // Anything not matched in another group.
        //   ["^"],
        // ],
        groups: [['^.*\\u0000$'], ['^\\u0000'], ['^node:'], ['^@?\\w'], ['^'], ['^\\.']],
      },
    ],
  },
}
