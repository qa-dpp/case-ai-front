import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    plugins: [vue()],
    server: {
      proxy: {
        '/ai-api': {
          target: env.VITE_SERVER_URL,
          changeOrigin: true
        }
      }
    }
  }
})
