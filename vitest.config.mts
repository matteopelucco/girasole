import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit test per la sola logica pura di lib/ (nessun I/O: niente Supabase,
// niente fetch, niente filesystem) — vedi CLAUDE.md, sezione "Test-first".
// Tutto il resto (Server Actions, pagine, RLS, flussi autenticati) resta
// coperto da Playwright in e2e/.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './'),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
