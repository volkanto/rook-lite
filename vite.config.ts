import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8")
) as { version: string };

function resolveAppVersion(): string {
  if (process.env.VITE_APP_VERSION) {
    return process.env.VITE_APP_VERSION;
  }
  if (process.env.VITE_APP_COMMIT_SHA) {
    const shortSha = process.env.VITE_APP_COMMIT_SHA.trim().slice(0, 7);
    return `${pkg.version} (${shortSha})`;
  }
  return pkg.version;
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  define: {
    __APP_VERSION__: JSON.stringify(resolveAppVersion())
  },
  server: {
    host: "localhost",
    port: 5173
  }
});
