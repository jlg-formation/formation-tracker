import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "src/**/index.ts", // Fichiers de re-export
        "src/components/**/*.tsx", // Composants React (testés via integration)
        "src/services/export/pdf.ts", // Nécessite jsPDF + DOM complet
        "src/main.tsx",
        "src/App.tsx"
      ]
    }
  }
});
