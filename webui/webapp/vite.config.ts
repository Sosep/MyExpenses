import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { lingui } from '@lingui/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react(), lingui({ macroTransform: true }), tailwindcss()],
    base: '/app/',
    build: {
      outDir: '../src/main/assets/webapp',
      emptyOutDir: true,
    },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:9000',
          changeOrigin: true,
        },
      },
    },
  }
})
