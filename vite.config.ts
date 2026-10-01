import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  server: {
    host: "localhost",
    port: 5173
  }
});
