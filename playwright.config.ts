import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3200);
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://cr@localhost:5433/cr_e2e?host=/tmp";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "celular", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    { name: "desktop", use: { viewport: { width: 1366, height: 900 } }, testMatch: /telas\.spec\.ts/ },
    { name: "celular-pequeno", use: { ...devices["Pixel 7"], browserName: "chromium", viewport: { width: 360, height: 740 } }, testMatch: /telas\.spec\.ts/ },
    { name: "tablet", use: { viewport: { width: 820, height: 1180 }, hasTouch: true }, testMatch: /telas\.spec\.ts/ },
    { name: "sem-animacao", use: { ...devices["Pixel 7"], browserName: "chromium", reducedMotion: "reduce" }, testMatch: /telas\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DB_DRIVER: "pg",
      DATABASE_URL,
      SESSION_SECRET: "e2e-segredo-de-teste-com-32-caracteres",
      CRON_SECRET: "e2e",
      GEOCODER: "off",
      WHATSAPP_PROVIDER: "none",
    },
  },
});
