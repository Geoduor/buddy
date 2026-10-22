import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Project rule: never write HTML into the page. Show text with JSX text or element.textContent.
    files: ['src/**/*.{js,jsx}'],
    rules: {
      'no-restricted-properties': ['error',
        { property: 'innerHTML', message: 'Use textContent (or JSX text) so content can never run as HTML.' },
        { property: 'outerHTML', message: 'Use textContent (or JSX text) so content can never run as HTML.' },
        { property: 'insertAdjacentHTML', message: 'Use textContent (or JSX text) so content can never run as HTML.' },
      ],
      'no-restricted-syntax': ['error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Do not inject HTML. Render text as JSX children.' },
        { selector: "CallExpression[callee.object.name='document'][callee.property.name=/^(write|writeln)$/]", message: 'document.write is not allowed.' },
        { selector: "CallExpression[callee.name='eval']", message: 'eval is not allowed.' },
        { selector: "NewExpression[callee.name='Function']", message: 'new Function is not allowed.' },
      ],
    },
  },
  {
    // Serverless functions run on Node, not in the browser
    files: ['api/**/*.js', 'server/**/*.js'],
    languageOptions: { globals: globals.node },
  },
])
