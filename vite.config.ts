import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const src = fileURLToPath(new URL('./src', import.meta.url))
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as {
  version: string
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': src,
      '@app': `${src}/app`,
      '@game': `${src}/game`,
      '@components': `${src}/components`,
      '@assets': `${src}/assets`,
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
