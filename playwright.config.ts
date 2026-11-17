import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
/* Mỗi lượt chạy (feature × browser) xuất một report riêng: REPORT_DIR=reports/fr01-firefox */
const RUN_BY = process.env.RUN_BY ?? '23120031';
const RUN_AT = new Date().toISOString();
const REPORT_DIR = process.env.REPORT_DIR ?? 'playwright-report';

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  /* Các test dùng chung một backend nên chạy tuần tự */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    ['html', { outputFolder: REPORT_DIR, open: 'never', title: `Run by: ${RUN_BY} · ${RUN_AT}` }],
  ],
  metadata: { 'Run by': RUN_BY, 'Run at': RUN_AT },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    screenshot: 'only-on-failure',
    /* Lượt chính thức (có REPORT_DIR, report được commit vào repo): tắt trace để report nhẹ.
       Lượt chạy thử (không có REPORT_DIR): giữ trace của test fail để gỡ lỗi. */
    trace: process.env.REPORT_DIR ? 'off' : 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
