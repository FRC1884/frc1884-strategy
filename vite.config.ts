import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The hub web app lives in web/ and is built into public/hub, which the
// Fastify server already serves. In development, run `npm run dev` (server)
// and `npm run dev:web` (this) side by side.
export default defineConfig({
  root: "web",
  base: "/hub/",
  plugins: [react()],
  resolve: {
    alias: { "@shared": path.resolve(__dirname, "src/shared") },
  },
  build: {
    outDir: "../public/hub",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3000", "/assets": "http://localhost:3000" },
  },
});
