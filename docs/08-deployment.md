# 08 - Déploiement

## Vue d'ensemble

L'application est déployée sur **GitHub Pages** en tant que site statique.

| Environnement | URL                                                  | Branch     |
| ------------- | ---------------------------------------------------- | ---------- |
| Production    | `https://jlg-formation.github.io/formation-tracker/` | `gh-pages` |
| Développement | `http://localhost:5173`                              | `master`   |

---

## Structure du projet

```
formation-tracker/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions CI/CD
├── docs/                       # Documentation technique
├── input/                      # Brief et exemples emails
├── public/
│   └── favicon.ico
├── src/                        # Code source
├── .env.example                # Template variables d'environnement
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Configuration Vite

### vite.config.ts

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // Base URL pour GitHub Pages
  base: "/formation-tracker/",

  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "terser",
    rollupOptions: {
      output: {
        manualChunks: {
          // Séparer les vendors lourds
          vendor: ["react", "react-dom", "react-router-dom"],
          charts: ["d3"],
          maps: ["leaflet", "react-leaflet"],
          pdf: ["jspdf", "jspdf-autotable"]
        }
      }
    }
  },

  server: {
    port: 5173,
    open: true
  },

  preview: {
    port: 4173
  }
});
```

---

## Configuration Vitest

### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["node_modules/", "src/test/", "**/*.d.ts", "src/main.tsx"],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    }
  }
});
```

### src/test/setup.ts

```typescript
import "@testing-library/jest-dom";
import "fake-indexeddb/auto";
```

### Dépendances de test

```bash
bun add -d vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom fake-indexeddb
```

### Scripts package.json

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext ts,tsx"
  }
}
```

---

## Variables d'environnement

### .env.example

```env
# Google OAuth Client ID (obligatoire)
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# URL de base (optionnel, pour développement)
VITE_BASE_URL=/formation-tracker/
```

### .env.local (développement)

```env
VITE_GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
```

⚠️ **Ne jamais commiter `.env.local`**

### Utilisation dans le code

```typescript
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const baseUrl = import.meta.env.VITE_BASE_URL || "/";
```

---

## GitHub Actions CI/CD

### .github/workflows/deploy.yml

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - master
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Type check
        run: bun run typecheck

      - name: Test
        run: bun run test:run

      - name: Lint
        run: bun run lint

      - name: Build
        run: bun run build
        env:
          VITE_GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

## Configuration GitHub

### 1. Activer GitHub Pages

1. Repository → Settings → Pages
2. Source : **GitHub Actions**

### 2. Configurer les secrets

1. Repository → Settings → Secrets and variables → Actions
2. Ajouter :
   - `GOOGLE_CLIENT_ID` : Votre Client ID Google OAuth

### 3. Configurer Google OAuth pour la production

Dans Google Cloud Console :

1. APIs & Services → Credentials → Votre OAuth Client
2. Ajouter aux origines JavaScript autorisées :
   ```
   https://jlg-formation.github.io
   ```
3. Ajouter aux URIs de redirection :
   ```
   https://jlg-formation.github.io/formation-tracker/
   ```

---

## Scripts package.json

```json
{
  "name": "formation-tracker",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext ts,tsx",
    "lint:fix": "eslint src --ext ts,tsx --fix"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "d3": "^7.8.5",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",
    "dexie": "^3.2.4",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.1"
  },
  "devDependencies": {
    "@types/d3": "^7.4.3",
    "@types/leaflet": "^1.9.8",
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^8.56.0",
    "eslint-plugin-react": "^7.33.2",
    "eslint-plugin-react-hooks": "^4.6.0",
    "terser": "^5.27.0",
    "typescript": "^5.3.3",
    "vite": "^5.1.0"
  }
}
```

---

## Commandes de développement

```bash
# Installation des dépendances
bun install

# Lancer le serveur de développement
bun run dev

# Build de production
bun run build

# Prévisualiser le build
bun run preview

# Vérification des types
bun run typecheck

# Linting
bun run lint
bun run lint:fix
```

---

## Gestion du SPA sur GitHub Pages

GitHub Pages ne supporte pas le routing SPA par défaut. Solution : **404.html redirect trick**

### public/404.html

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Formation Tracker</title>
    <script>
      // Redirect vers index.html avec le path en query param
      const path = window.location.pathname;
      const base = "/formation-tracker";
      if (path.startsWith(base)) {
        const route = path.slice(base.length) || "/";
        sessionStorage.setItem("redirect", route);
        window.location.replace(base + "/");
      }
    </script>
  </head>
  <body></body>
</html>
```

### Dans main.tsx

```typescript
// Récupérer la route stockée
const redirect = sessionStorage.getItem("redirect");
if (redirect) {
  sessionStorage.removeItem("redirect");
  window.history.replaceState(null, "", redirect);
}
```

---

## Optimisation du bundle

### Analyse de la taille

```bash
# Installer l'analyseur
bun add -d rollup-plugin-visualizer

# Ajouter dans vite.config.ts
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true }),
  ],
});
```

### Tailles cibles

| Chunk          | Taille max          |
| -------------- | ------------------- |
| vendor (React) | ~150 KB             |
| charts (D3)    | ~100 KB             |
| maps (Leaflet) | ~150 KB             |
| pdf (jsPDF)    | ~200 KB             |
| app            | ~100 KB             |
| **Total**      | **~700 KB gzipped** |

---

## Monitoring

### Erreurs JavaScript

```typescript
// src/main.tsx
window.onerror = (message, source, lineno, colno, error) => {
  console.error("Global error:", { message, source, lineno, colno, error });
  // Optionnel : envoyer à un service de monitoring
};

window.onunhandledrejection = (event) => {
  console.error("Unhandled promise rejection:", event.reason);
};
```

### Performance

```typescript
// Mesurer le temps de chargement
if (typeof performance !== "undefined") {
  window.addEventListener("load", () => {
    const timing = performance.getEntriesByType(
      "navigation"
    )[0] as PerformanceNavigationTiming;
    console.log(
      "Page load time:",
      timing.loadEventEnd - timing.startTime,
      "ms"
    );
  });
}
```
