import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allow the external host (e.g. the ngrok / dev tunnel hostname)
    // If you see "Blocked request. This host is not allowed" add the host here.
    allowedHosts: [
      'tardy-supermechanically-maxwell.ngrok-free.dev'
    ],
    proxy: {
      '/api': {
        target: 'https://tftp-cn.onrender.com',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
