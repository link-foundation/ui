import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import noChangelogCommentsRule from './eslint-rules/no-changelog-comments.js';

const localPlugin = {
  rules: {
    'no-changelog-comments': noChangelogCommentsRule,
  },
};

export default [
  js.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    plugins: {
      local: localPlugin,
      prettier: prettierPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        // Node.js 18+ globals
        fetch: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        // Runtime-specific globals
        Bun: 'readonly',
        Deno: 'readonly',
      },
    },
    rules: {
      // Prettier integration
      'prettier/prettier': 'error',

      // Code quality rules
      'no-unused-vars': 'error',
      'no-console': 'off', // Allow console in this project
      'no-debugger': 'error',

      // Best practices
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'no-duplicate-imports': 'error',

      // ES6+ features
      'arrow-body-style': ['error', 'as-needed'],
      'object-shorthand': ['error', 'always'],
      'prefer-template': 'error',

      // Async/await
      'no-async-promise-executor': 'error',
      'require-await': 'warn',

      // Comments and documentation
      'local/no-changelog-comments': [
        'warn',
        {
          // GitHub's X-GitHub-Api-Version header value is a protocol
          // constant, not a reference to a changelog entry.
          allow: ['2022-11-28'],
        },
      ],
      'spaced-comment': ['error', 'always', { markers: ['/'] }],

      // Complexity rules - reasonable thresholds for maintainability
      complexity: ['warn', 15], // Cyclomatic complexity - allow more complex logic than strict 8
      'max-depth': ['warn', 5], // Maximum nesting depth - slightly more lenient than strict 4
      'max-lines-per-function': [
        'warn',
        {
          max: 150, // More reasonable than strict 50 lines per function
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-params': ['warn', 6], // Maximum function parameters - slightly more lenient than strict 5
      'max-statements': ['warn', 60], // Maximum statements per function - reasonable limit for orchestration functions
      'max-lines': ['error', 1500], // Maximum lines per file - counts all lines including blank lines and comments
    },
  },
  {
    files: ['examples/universal-app/src/**/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
      },
    },
  },
  {
    // The ui-dom example page runs in the browser only.
    files: ['examples/ui-dom/**/*.js', 'packages/*/examples/**/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        URL: 'readonly',
      },
    },
  },
  {
    // Package demo pages (such as the icon gallery) run in the browser only.
    files: ['packages/*/examples/**/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        location: 'readonly',
        CSS: 'readonly',
      },
    },
  },
  {
    // Playwright UI tests: callbacks passed to page.evaluate run in the
    // browser, so browser globals are available there.
    files: [
      '**/*.e2e.mjs',
      'tests/e2e/**/*.spec.js',
      'packages/*/tests/e2e/**/*.spec.js',
    ],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
      },
    },
    rules: {
      'require-await': 'off',
    },
  },
  {
    // The HTML importer reads HTML only with parse5 or the DOM and writes
    // Links Notation only through links-notation `Link` objects: no regular
    // expressions, so no hand-written HTML or LiNo parser.
    files: ['packages/ui-convert/src/html/**/*.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[regex]',
          message:
            'No regular expressions in src/html/: read HTML with parse5 or the DOM.',
        },
        {
          selector: "NewExpression[callee.name='RegExp']",
          message:
            'No regular expressions in src/html/: read HTML with parse5 or the DOM.',
        },
        {
          selector: "CallExpression[callee.name='RegExp']",
          message:
            'No regular expressions in src/html/: read HTML with parse5 or the DOM.',
        },
      ],
    },
  },
  {
    // Behaviour is data: an action or guard name selects a registered
    // function and is never evaluated, so no source file may turn text
    // into code (tests/behavior/lint-rules.test.js checks the rules).
    files: ['packages/ui-components/src/**/*.js'],
    rules: {
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
    },
  },
  {
    // Test files have different requirements
    files: ['tests/**/*.js', 'packages/*/tests/**/*.js', '**/*.test.js'],
    rules: {
      'require-await': 'off', // Async functions without await are common in tests
    },
  },
  {
    // describeChanges prints one line per configuration value for people
    // and AI agents (ui-config, R12), in the wording the issue asks for;
    // that output describes values at run time, not source history.
    files: [
      'packages/ui-config/src/explain.js',
      'packages/ui-config/tests/explain.test.js',
    ],
    rules: {
      'local/no-changelog-comments': [
        'warn',
        { allow: [['changed', 'from'].join(' ')] },
      ],
    },
  },
  {
    // Case studies preserve historical wording on purpose, and the rule's own
    // tests contain fixtures the rule is designed to flag.
    files: [
      'docs/case-studies/**/*.{js,mjs,cjs}',
      'docs/template-history/**/*.{js,mjs,cjs}',
      'tests/no-changelog-comments.test.js',
    ],
    rules: {
      'local/no-changelog-comments': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '**/node_modules/**',
      'coverage/**',
      'dist/**',
      'playwright-report/**',
      'test-results/**',
      '**/dist/**',
      '**/out/**',
      '*.min.js',
      '.eslintcache',
      // The jscpd HTML reporter writes a bundled prism.js here
      'reports/**',
      // Case study raw data files (downloaded from external sources)
      'docs/case-studies/*/data/**',
      'docs/template-history/case-studies/*/data/**',
      'dev/log/**',
      // Gradle build outputs of the native ports (Kotlin/JS and Kotlin/Wasm bundles)
      'native/**/build/**',
      'native/**/.gradle/**',
      // Gradle build outputs (test reports) of ui-kotlin and its example
      'packages/ui-kotlin/build/**',
      'packages/ui-kotlin/.gradle/**',
      'examples/kotlin/build/**',
      'examples/kotlin/.gradle/**',
    ],
  },
];
