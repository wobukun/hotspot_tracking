import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000
  },
  build: {
    outDir: 'dist/client'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
