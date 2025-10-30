import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ctonew/widget': path.resolve(__dirname, '../..', 'packages/widget/src')
    }
  },
  server: {
    port: 4173
  }
});
