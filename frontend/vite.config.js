import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// 不强制指定端口，使用 Vite 默认端口 5173
export default defineConfig({
  plugins: [react()],
})
