import path from "node:path";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: {
    // Exposed to the UI so the sidebar never drifts from package.json.
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks: {
          editor: ["konva", "react-konva"],
          pdf: ["pdf-lib", "@pdf-lib/fontkit", "pdfjs-dist"],
          vendor: ["react", "react-dom", "react-router-dom", "zustand", "dexie"],
        },
      },
    },
  },
});
