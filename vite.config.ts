import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
