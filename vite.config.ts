import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwind()], build: {outDir: 'dist/client', chunkSizeWarningLimit: 1800,rollupOptions:{output:{manualChunks:{phaser:['phaser'],network:['@colyseus/sdk']}}}}, server: {host:'127.0.0.1'} });
