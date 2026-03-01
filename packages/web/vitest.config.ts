import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 15000,
    include: ['e2e/**/*.test.ts'],
  },
});
