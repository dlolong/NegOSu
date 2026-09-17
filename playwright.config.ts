import { defineConfig, devices } from "@playwright/test";

const defaultBaseUrl = "http://127.0.0.1:3100";
const baseURL = process.env.E2E_BASE_URL ?? defaultBaseUrl;
const usesOperatorManagedServer = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/playwright",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    browserName: "chromium",
    baseURL,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : undefined,
  },
  webServer: usesOperatorManagedServer ? undefined : {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: `${defaultBaseUrl}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "mobile-320", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 320, height: 740 } } },
    { name: "mobile-375", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 375, height: 812 } } },
    { name: "mobile-390", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
    { name: "mobile-430", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 430, height: 932 } } },
  ],
});
