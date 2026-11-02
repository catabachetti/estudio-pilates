import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'

// Config heredada de la plantilla de Vite y ajustada a Next:
//
//   - se ignora `.next` y no `dist`, que es lo que genera Vite y acá no existe
//   - se suman los globales de Node: casi todo corre en el servidor y usa
//     `process.env` para leer las variables de entorno
//   - se saca eslint-plugin-react-refresh, que es del HMR de Vite. Marcaba un
//     error en cada página del proyecto por exportar `metadata`, `revalidate` o
//     `dynamic`, que es justo lo que Next pide exportar
//
// Antes de este arreglo `npm run lint` informaba miles de errores, o sea que no
// lo corría nadie. Con la config puesta encontro un import muerto en el primer
// intento.

export default defineConfig([
  // Se ignoran tambien los artefactos de Playwright. `playwright-report/` trae
  // el visor de trazas empaquetado —CodeMirror y compania— y lint sobre eso
  // informaba miles de errores de codigo que no es nuestro, que es exactamente
  // el estado del que se salio cuando se arreglo esta config.
  globalIgnores([
    '.next',
    'node_modules',
    'public',
    'test-results',
    'playwright-report',
    'blob-report',
    'playwright/.cache',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
