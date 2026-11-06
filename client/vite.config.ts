import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  // 개발 중 의존성을 다시 묶으면서 React가 두 벌 섞이는 일을 막는다
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'zustand', 'socket.io-client', 'three', '@react-three/fiber', '@react-three/drei'] },
  server: {
    port: 5180, strictPort: true,
    // 기본은 :3000 서버. 다른 포트의 서버로 붙이려면 AVALON_SERVER=http://localhost:3001 처럼 지정
    proxy: { '/socket.io': { target: process.env.AVALON_SERVER ?? 'http://localhost:3000', ws: true } },
  },
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), preview: resolve(__dirname, 'preview.html') },
    },
  },
});
