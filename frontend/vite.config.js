import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// React app is bundled by Vite. Dev server runs on port 3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
});
