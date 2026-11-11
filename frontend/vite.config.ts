import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 3000 is the backend's default FRONTEND_URL / CORS origin (see backend/.env.example).
  server: { port: 3000 },
});
