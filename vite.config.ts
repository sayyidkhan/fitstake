import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // xfwd forwards the browser's real host so the API's same-origin check works in local dev.
  server: { proxy: { "/api": { target: "http://localhost:8787", xfwd: true } } },
});
