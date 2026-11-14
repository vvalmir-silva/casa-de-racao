import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    env: { DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://x:y@localhost/db" },
  },
});
