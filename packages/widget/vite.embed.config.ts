import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    lib: {
      entry: path.resolve(__dirname, 'src/embed.tsx'),
      name: 'ChatWidgetEmbed',
      formats: ['iife'],
      fileName: () => 'embed.js'
    },
    rollupOptions: {
      output: {
        assetFileNames: 'embed.[name][extname]'
      }
    },
    sourcemap: true
  }
});
