import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:5173", trace: "retain-on-failure" },
  reporter: "list",
});
