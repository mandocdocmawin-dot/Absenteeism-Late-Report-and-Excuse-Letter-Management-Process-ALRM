// frontend/vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { cookieGatewayPlugin } from "./server/viteGateway.js";

export default defineConfig(({ mode }) => ({
  plugins: [
    cookieGatewayPlugin(loadEnv(mode, import.meta.dirname, "")),
    react(),
    tailwindcss(), // <- ito ang nagpapagana ng Tailwind CSS
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
}));
