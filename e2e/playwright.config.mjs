import { defineConfig } from '@playwright/test';

// Ver scripts/e2e.sh. Um teste por vez: eles compartilham o banco local.
export default defineConfig({
  testDir: './testes',
  workers: 1,
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]] : 'list',
  globalSetup: './preparar.mjs',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1440, height: 900 },
    // Mesmo fuso da clínica: o banco conclui o atendimento pela data de São Paulo.
    timezoneId: 'America/Sao_Paulo',
    // No Mac de desenvolvimento usa o Chrome instalado; no CI, o Chromium do Playwright.
    channel: process.env.E2E_CANAL || undefined,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --outDir build-e2e --port 4173 --strictPort',
    cwd: '..',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
