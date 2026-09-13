import { defineConfig } from 'vite';

// GitHub Pages serve em /<repo>/; Vercel serve na raiz. BASE_PATH é definido no workflow.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: { outDir: 'dist', sourcemap: false, target: 'es2022' },
  test: { include: ['src/**/*.test.ts', 'ingest/**/*.test.ts'], environment: 'node' },
});
