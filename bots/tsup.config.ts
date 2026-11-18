import { defineConfig } from "tsup";

// CommonJS for the backend. The worker and the tournament runner are their own entry points: Node
// starts them as separate files (a worker thread, a command line script).
export default defineConfig({
  entry: ["src/index.ts", "src/worker.ts", "src/tournament.ts"],
  format: ["cjs"],
  dts: { entry: "src/index.ts" },
  clean: true,
  sourcemap: true,
  target: "node24",
});
