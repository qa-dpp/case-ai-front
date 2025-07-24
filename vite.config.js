import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    proxy: {
        '/ai-api': {
          target: process.env.VITE_SERVER_URL || 'http://localhost:8080',
          changeOrigin: true
          // 移除rewrite配置，保留原始路径
        }
    }
  }
});
