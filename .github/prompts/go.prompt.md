# ORSYS Training Tracker - Prompt de développement itératif

## Instructions

Tu es un développeur expert React/TypeScript. Ce prompt est **itératif et idempotent** : exécute-le plusieurs fois pour faire avancer le projet étape par étape.

### Principe de fonctionnement

1. **Analyse l'état actuel** du projet en vérifiant quels fichiers/dossiers existent
2. **Détermine l'étape courante** selon la checklist ci-dessous
3. **Exécute UNIQUEMENT l'étape suivante** (pas plus)
4. **Termine** en indiquant clairement ce qui a été fait et quelle est la prochaine étape

### Règles impératives

- **Une seule étape par exécution** - N'anticipe pas les étapes suivantes
- **Vérifie avant de créer** - Ne recrée pas ce qui existe déjà
- **Tests après chaque étape** - Vérifie que le build passe (`bun run build`) ET les tests passent (`bun run test`)
- **Tests unitaires obligatoires** - Chaque service/utilitaire doit avoir son fichier `.test.ts`
- **Commit mental** - Chaque étape doit laisser le projet dans un état fonctionnel
- **Français** - Tous les textes UI en français

---

## Checklist des étapes

### Étape 0 : Initialisation Vite + React

**Critères de complétion :**

- [ ] Répertoire `project/` existe
- [ ] `project/package.json` existe avec React, TypeScript, Vite
- [ ] `project/vite.config.ts` configuré
- [ ] `project/src/main.tsx` existe
- [ ] `project/src/App.tsx` existe
- [ ] `bun run dev` fonctionne (depuis project/)

**Actions si incomplet :**

```bash
mkdir project
cd project
bun create vite . --template react-ts
bun install
```

Configurer `vite.config.ts` avec base pour GitHub Pages.

---

### Étape 1 : Configuration Vitest + Structure Tests

**Critères de complétion :**

- [ ] `vitest` dans les devDependencies
- [ ] `@testing-library/react` et `@testing-library/jest-dom` installés
- [ ] `project/vitest.config.ts` configuré
- [ ] `project/src/test/setup.ts` existe (setup testing-library)
- [ ] Script `"test": "vitest"` dans package.json
- [ ] Script `"test:coverage": "vitest run --coverage"` dans package.json
- [ ] `bun run test` fonctionne (même sans tests)

**Actions si incomplet :**

```bash
cd project
bun add -d vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8
```

Créer `project/vitest.config.ts` :

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules/", "src/test/"]
    }
  }
});
```

Créer `project/src/test/setup.ts` :

```typescript
import "@testing-library/jest-dom";
```

---

### Étape 2 : Structure projet + Types

**Critères de complétion :**

- [ ] `project/src/types/index.ts` existe avec tous les types de `docs/02-data-model.ts`
- [ ] `project/src/services/` dossier créé
- [ ] `project/src/components/` dossier créé
- [ ] `project/src/stores/` dossier créé
- [ ] `project/src/hooks/` dossier créé
- [ ] `project/src/utils/` dossier créé
- [ ] `project/src/types/index.test.ts` avec tests de validation des enums

**Actions si incomplet :**

1. Créer la structure de dossiers
2. Copier les types depuis `docs/02-data-model.ts` vers `project/src/types/index.ts`
3. Créer `project/src/utils/constants.ts` avec les constantes de base
4. Créer tests pour les fonctions utilitaires (generateId, getFormationKey)

---

### Étape 3 : IndexedDB avec Dexie.js

**Critères de complétion :**

- [ ] `dexie` dans les dépendances
- [ ] `project/src/stores/db.ts` existe avec schéma Dexie
- [ ] Tables : `emails`, `formations`, `geocache`, `settings`
- [ ] `project/src/stores/formationsStore.ts` avec fonctions CRUD basiques
- [ ] `project/src/stores/formationsStore.test.ts` avec tests CRUD (utiliser fake-indexeddb)

**Actions si incomplet :**

```bash
cd project
bun add dexie
bun add -d fake-indexeddb
```

Créer le store Dexie selon `docs/01-architecture.md`.

Pour les tests, utiliser fake-indexeddb :

```typescript
import "fake-indexeddb/auto";
```

---

### Étape 4 : Layout de base + Routing

**Critères de complétion :**

- [ ] `react-router-dom` dans les dépendances
- [ ] `project/src/components/layout/Header.tsx` existe
- [ ] `project/src/components/layout/Footer.tsx` existe
- [ ] `project/src/App.tsx` avec routes : `/`, `/carte`, `/formations`, `/parametres`
- [ ] Navigation fonctionnelle entre les pages

**Actions si incomplet :**

```bash
cd project
bun add react-router-dom
```

Créer les composants layout et configurer le router.

---

### Étape 5 : Page Paramètres + Stockage clés API

**Critères de complétion :**

- [ ] `project/src/components/settings/SettingsPage.tsx` existe
- [ ] Formulaire pour saisir la clé API OpenAI
- [ ] Formulaire pour choisir le provider de géocodage
- [ ] Stockage dans IndexedDB via `settingsStore`
- [ ] Hook `useSettings()` pour récupérer les paramètres
- [ ] `project/src/hooks/useSettings.test.ts` avec tests du hook

**Actions si incomplet :**
Créer la page paramètres selon `docs/06-ui-specs.md`.

---

### Étape 6 : Service Gmail OAuth

**Critères de complétion :**

- [ ] `project/src/services/gmail/auth.ts` existe
- [ ] `project/src/services/gmail/api.ts` existe
- [ ] Intégration Google Identity Services (GIS)
- [ ] Bouton "Se connecter avec Gmail" fonctionnel
- [ ] Token stocké dans IndexedDB

**Actions si incomplet :**
Créer le service Gmail selon `docs/04-gmail-api.md`.
Utiliser `accounts.google.com/gsi/client` pour OAuth côté client.

---

### Étape 7 : Extraction emails Gmail

**Critères de complétion :**

- [ ] `project/src/components/extraction/ExtractionPanel.tsx` existe
- [ ] Query Gmail : `from:orsys.fr`
- [ ] Emails stockés dans IndexedDB (table `emails`)
- [ ] Barre de progression pendant l'extraction
- [ ] Gestion pagination Gmail API

**Actions si incomplet :**
Créer le panneau d'extraction avec appels Gmail API selon `docs/04-gmail-api.md`.

---

### Étape 8 : Service LLM - Classification

**Critères de complétion :**

- [ ] `project/src/services/llm/parser.ts` existe
- [ ] `project/src/services/llm/prompts.ts` avec prompts de classification
- [ ] Fonction `classifyEmail(email)` → `TypeEmail`
- [ ] `project/src/services/llm/parser.test.ts` avec mocks OpenAI
- [ ] Tests avec exemples de `input/emails-samples/`

**Actions si incomplet :**
Créer le service LLM selon `docs/03-llm-prompts.md`.

Pour les tests, mocker l'API OpenAI :

```typescript
vi.mock('openai', () => ({ ... }))
```

---

### Étape 9 : Service LLM - Extraction

**Critères de complétion :**

- [ ] Prompts d'extraction dans `prompts.ts`
- [ ] Fonction `extractFormation(email, type)` → `Partial<Formation>`
- [ ] Gestion des différents types (inter, intra, annulation...)
- [ ] Tests unitaires pour chaque type d'extraction
- [ ] Stockage formations dans IndexedDB

**Actions si incomplet :**
Compléter le service LLM avec l'extraction selon `docs/03-llm-prompts.md`.

---

### Étape 10 : Service Géocodage

**Critères de complétion :**

- [ ] `project/src/services/geocoding/adapter.ts` interface
- [ ] `project/src/services/geocoding/nominatim.ts` implémentation
- [ ] `project/src/services/geocoding/geocoding.test.ts` avec tests (mocker fetch)
- [ ] Cache des résultats dans IndexedDB (table `geocache`)
- [ ] Rate limiting (1 req/s pour Nominatim)

**Actions si incomplet :**
Créer le service géocodage selon `docs/05-geocoding.md`.

---

### Étape 11 : Logique de fusion

**Critères de complétion :**

- [ ] `project/src/utils/fusion.ts` existe
- [ ] `project/src/utils/fusion.test.ts` avec tests complèts
- [ ] Fusion des emails relatifs à la même formation
- [ ] Clé unique : `codeEtendu + dateDebut`
- [ ] Gestion annulations (met à jour statut)

**Actions si incomplet :**
Créer la logique de fusion des formations.

**Cas de test obligatoires :**

- Fusion de 2 emails pour une même formation
- Annulation qui met à jour une formation existante
- Emails sans correspondance (nouvelle formation)

---

### Étape 12 : Dashboard - Stats Cards

**Critères de complétion :**

- [ ] `project/src/components/dashboard/Dashboard.tsx` existe
- [ ] `project/src/components/dashboard/StatsCards.tsx` avec 4 KPI
- [ ] Hook `useFormations()` pour récupérer les données
- [ ] `project/src/utils/stats.ts` avec calcul des statistiques
- [ ] `project/src/utils/stats.test.ts` avec tests des calculs

**Actions si incomplet :**
Créer le dashboard selon `docs/06-ui-specs.md`.

---

### Étape 13 : Dashboard - Graphiques D3.js

**Critères de complétion :**

- [ ] `d3` dans les dépendances
- [ ] `project/src/components/dashboard/YearlyChart.tsx` (bar chart par année)
- [ ] `project/src/components/dashboard/TopCoursesChart.tsx` (top 10 formations)
- [ ] `project/src/components/dashboard/TypePieChart.tsx` (inter vs intra)

**Actions si incomplet :**

```bash
cd project
bun add d3 @types/d3
```

Créer les graphiques D3.js.

---

### Étape 14 : Carte Leaflet

**Critères de complétion :**

- [ ] `leaflet` et `react-leaflet` dans les dépendances
- [ ] `project/src/components/map/MapView.tsx` existe
- [ ] Marqueurs pour chaque lieu de formation
- [ ] Clustering des marqueurs (Leaflet.markercluster)
- [ ] Popup avec détails de la formation

**Actions si incomplet :**

```bash
cd project
bun add leaflet react-leaflet leaflet.markercluster @types/leaflet
```

Créer la carte selon `docs/06-ui-specs.md`.

---

### Étape 15 : Liste des formations

**Critères de complétion :**

- [ ] `project/src/components/formations/FormationList.tsx` existe
- [ ] `project/src/components/formations/FormationCard.tsx`
- [ ] `project/src/components/formations/Filters.tsx`
- [ ] Filtres par année, type, statut
- [ ] Recherche textuelle

**Actions si incomplet :**
Créer la liste des formations selon `docs/06-ui-specs.md`.

---

### Étape 16 : Export JSON/CSV/PDF

**Critères de complétion :**

- [ ] `jspdf` dans les dépendances
- [ ] `project/src/services/export/json.ts`
- [ ] `project/src/services/export/csv.ts`
- [ ] `project/src/services/export/pdf.ts`
- [ ] `project/src/services/export/export.test.ts` (tests JSON et CSV)
- [ ] Boutons d'export dans le dashboard

**Actions si incomplet :**

```bash
cd project
bun add jspdf
```

Créer les services d'export selon `docs/07-export.md`.

---

### Étape 17 : Finitions et polish

**Critères de complétion :**

- [ ] Gestion des erreurs avec messages en français
- [ ] Loading states sur toutes les actions async
- [ ] Responsive design basique
- [ ] `README.md` avec instructions d'utilisation
- [ ] Build production fonctionne (`bun run build`)
- [ ] **Coverage tests > 70%** (`bun run test:coverage`)
- [ ] Tous les tests passent (`bun run test`)

**Actions si incomplet :**
Finaliser l'application et préparer le déploiement.

---

## Commande d'analyse

Pour déterminer l'étape courante, vérifie dans cet ordre :

1. `project/package.json` existe ? → Sinon étape 0
2. `project/vitest.config.ts` existe ? → Sinon étape 1
3. `project/src/types/index.ts` existe ? → Sinon étape 2
4. `project/src/stores/db.ts` existe ? → Sinon étape 3
5. `project/src/components/layout/Header.tsx` existe ? → Sinon étape 4
6. Continue ainsi jusqu'à trouver la première étape incomplète

Vérifie aussi que les **tests correspondants existent** pour chaque module.

---

## Rapport de fin d'exécution

À la fin de chaque exécution, affiche :

```
## ✅ Étape [N] terminée : [Nom de l'étape]

### Ce qui a été fait :
- [Liste des fichiers créés/modifiés]

### Prochaine étape :
Étape [N+1] : [Nom de l'étape suivante]

### Pour continuer :
Relance ce prompt pour exécuter l'étape suivante.
```

---

## Documentation de référence

Consulte ces fichiers pour les détails d'implémentation :

- `docs/01-architecture.md` - Architecture globale
- `docs/02-data-model.ts` - Types TypeScript
- `docs/03-llm-prompts.md` - Prompts LLM
- `docs/04-gmail-api.md` - Configuration Gmail OAuth
- `docs/05-geocoding.md` - Service géocodage
- `docs/06-ui-specs.md` - Spécifications UI
- `docs/07-export.md` - Formats d'export
- `input/emails-samples/` - Exemples d'emails pour tests
