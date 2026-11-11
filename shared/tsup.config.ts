import { defineConfig } from "tsup";

// Two builds of the same code: CommonJS for the backend, ESM for the frontend (Vite).
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
