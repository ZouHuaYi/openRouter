import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: __dirname,
  plugins: [vue(), UnoCSS()],
  build: {
    outDir: path.join(__dirname, '../ui'),
    emptyOutDir: true,
  },
  base: './',
})
