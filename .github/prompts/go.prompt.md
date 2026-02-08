# ORSYS Training Tracker - Prompt de développement itératif

## Instructions

Tu es un développeur expert React/TypeScript. Ce prompt est **itératif et idempotent** : exécute-le plusieurs fois pour faire avancer le projet étape par étape.

### Principe de fonctionnement

1. **Lis le fichier d'état** `project/.build-state.json` s'il existe
2. **Détermine l'étape courante** selon le fichier d'état (ou vérifie les fichiers si absent)
3. **Exécute UNIQUEMENT l'étape suivante** (pas plus)
4. **Met à jour le fichier d'état** avec le résultat de l'étape
5. **Termine** en indiquant clairement ce qui a été fait et quelle est la prochaine étape

### Règles impératives

- **Une seule étape par exécution** - N'anticipe pas les étapes suivantes
- **Vérifie avant de créer** - Ne recrée pas ce qui existe déjà
- **Tests après chaque étape** - Vérifie que le build passe (`bun run build`) ET les tests passent (`bun run test`)
- **Tests unitaires obligatoires** - Chaque service/utilitaire doit avoir son fichier `.test.ts`
- **Commit mental** - Chaque étape doit laisser le projet dans un état fonctionnel
- **Français** - Tous les textes UI en français
- **Fichier d'état** - Toujours mettre à jour `project/.build-state.json` après chaque étape

---

## Résumé des démos par étape

Ce tableau permet de voir rapidement ce qui est démontrable à chaque étape pour présenter l'avancement du projet.

| Étape | Nom                | Ce qu'on peut montrer au chef                      |
| ----- | ------------------ | -------------------------------------------------- |
| 0     | Init Vite + React  | Page React de base qui se lance en local           |
| 1     | Vitest + Tests     | Tests qui passent, rapport de couverture           |
| 2     | Types + Structure  | Types TypeScript, tests des enums                  |
| 3     | IndexedDB          | Tables dans DevTools, tests CRUD                   |
| 4     | Tailwind + Layout  | Tailwind CSS v4 installé, navigation entre 4 pages |
| 5     | Page Paramètres    | Formulaire de config, sauvegarde persistante       |
| 6     | Gmail OAuth        | Connexion Google fonctionnelle                     |
| 7     | Extraction emails  | Barre de progression, emails stockés               |
| 8     | LLM Classification | Email → type détecté avec confiance                |
| 9     | LLM Extraction     | Email brut → Formation structurée                  |
| 10    | Géocodage          | Adresse → coordonnées GPS, cache                   |
| 11    | Fusion             | Plusieurs emails → 1 formation fusionnée           |
| 12    | Dashboard Stats    | 4 cartes KPI avec chiffres réels                   |
| 13    | Graphiques D3      | Barres par année, camembert, top 10                |
| 14    | Carte Leaflet      | Marqueurs interactifs sur carte France             |
| 15    | Liste formations   | Filtres, recherche, cartes détaillées              |
| 16    | Export             | Téléchargement JSON/CSV/PDF                        |
| 17    | Finitions          | Parcours complet, tests 70%+, build prod           |

---

## Fichier d'état : `project/.build-state.json`

Ce fichier JSON persiste l'état du projet entre les exécutions.

### Structure

```json
{
  "version": "1.0",
  "currentStep": 3,
  "lastUpdated": "2026-02-08T10:30:00.000Z",
  "steps": {
    "0": { "status": "completed", "completedAt": "2026-02-08T09:00:00.000Z" },
    "1": { "status": "completed", "completedAt": "2026-02-08T09:15:00.000Z" },
    "2": { "status": "completed", "completedAt": "2026-02-08T09:45:00.000Z" },
    "3": { "status": "in-progress", "startedAt": "2026-02-08T10:00:00.000Z" },
    "4": { "status": "not-started" }
  },
  "errors": [
    {
      "step": 2,
      "timestamp": "2026-02-08T09:40:00.000Z",
      "message": "Test failed: formationsStore.test.ts",
      "resolved": true
    }
  ],
  "filesCreated": ["project/src/types/index.ts", "project/src/stores/db.ts"]
}
```

### Champs

| Champ             | Description                                               |
| ----------------- | --------------------------------------------------------- |
| `version`         | Version du schéma (pour migrations futures)               |
| `currentStep`     | Numéro de l'étape en cours ou à exécuter                  |
| `lastUpdated`     | Timestamp ISO de la dernière mise à jour                  |
| `steps`           | État de chaque étape (0-17)                               |
| `steps[n].status` | `not-started` \| `in-progress` \| `completed` \| `failed` |
| `errors`          | Historique des erreurs rencontrées                        |
| `filesCreated`    | Liste des fichiers créés (pour rollback éventuel)         |

### Workflow du fichier d'état

1. **Au début** : Lire `project/.build-state.json`
   - Si absent → Créer avec `currentStep: 0`
   - Si présent → Reprendre à `currentStep`

2. **Avant l'étape** : Marquer l'étape comme `in-progress`

3. **Après l'étape** :
   - Si succès → Marquer `completed`, incrémenter `currentStep`
   - Si échec → Marquer `failed`, ajouter l'erreur dans `errors`

4. **Toujours** : Mettre à jour `lastUpdated` et `filesCreated`

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

**🎯 Démo possible :**

> _"L'environnement de développement est opérationnel."_
>
> - Lancer `bun run dev` et ouvrir http://localhost:5173
> - Montrer la page React par défaut avec le compteur Vite
> - Expliquer : "La stack technique est en place : React, TypeScript, Vite. Le projet compile et se lance en local."

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

**🎯 Démo possible :**

> _"L'infrastructure de tests est en place."_
>
> - Lancer `bun run test` et montrer les tests qui passent (même si minimal)
> - Montrer le rapport de couverture : `bun run test:coverage`
> - Expliquer : "Chaque fonctionnalité sera testée automatiquement. On vise 70%+ de couverture."

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

**🎯 Démo possible :**

> _"Le modèle de données est défini et validé."_
>
> - Ouvrir `src/types/index.ts` et montrer les types Formation, Lieu, Participant
> - Lancer `bun run test` → montrer les tests des enums et fonctions utilitaires
> - Expliquer : "Toutes les structures de données sont typées. Les formations, emails, paramètres... tout est défini."

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

**🎯 Démo possible :**

> _"La base de données locale est opérationnelle."_
>
> - Ouvrir DevTools → Application → IndexedDB → montrer les tables créées
> - Lancer les tests CRUD : `bun run test formationsStore`
> - Expliquer : "Les données sont stockées localement dans le navigateur. Pas de serveur nécessaire, tout reste sur la machine de l'utilisateur."

---

### Étape 4 : Tailwind CSS v4 + Layout + Routing

**Critères de complétion :**

- [ ] `tailwindcss` et `@tailwindcss/vite` dans les dépendances
- [ ] `project/vite.config.ts` configuré avec le plugin `@tailwindcss/vite`
- [ ] `project/src/index.css` contient `@import "tailwindcss"`
- [ ] `react-router-dom` dans les dépendances
- [ ] `project/src/components/layout/Header.tsx` existe avec classes Tailwind
- [ ] `project/src/components/layout/Footer.tsx` existe avec classes Tailwind
- [ ] `project/src/App.tsx` avec routes : `/`, `/carte`, `/formations`, `/parametres`
- [ ] `project/src/App.css` supprimé ou vidé (CSS personnalisé minimal)
- [ ] Tous les composants utilisent des classes Tailwind (pas de CSS personnalisé)
- [ ] Navigation fonctionnelle entre les pages

**Actions si incomplet :**

```bash
cd project
bun add tailwindcss @tailwindcss/vite
bun add react-router-dom
```

Configurer `vite.config.ts` avec le plugin Tailwind v4 :

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()]
  // ... reste de la config
});
```

Remplacer le contenu de `project/src/index.css` :

```css
@import "tailwindcss";

/* Thème personnalisé ORSYS (optionnel) */
@theme {
  --color-orsys-primary: #0066cc;
  --color-orsys-dark: #1a1a2e;
}
```

Supprimer ou vider `project/src/App.css` et refactorer tous les composants pour utiliser des classes Tailwind :

```tsx
// ✅ BON : Classes Tailwind
<header className="flex justify-between items-center p-4 bg-gray-900 border-b border-gray-800">
  <span className="text-xl font-semibold text-white">
    ORSYS Training Tracker
  </span>
</header>

// ❌ MAUVAIS : CSS personnalisé
// .header { display: flex; justify-content: space-between; }
```

**🎯 Démo possible :**

> _"Tailwind CSS v4 est installé et la navigation fonctionne."_
>
> - Montrer que Tailwind est configuré (pas de fichier CSS personnalisé)
> - Lancer `bun run dev` et naviguer entre les 4 pages
> - Inspecter le DOM → montrer les classes Tailwind sur les éléments
> - Expliquer : "On utilise Tailwind CSS v4 pour le styling. Pas de CSS à maintenir, tout est dans les classes utilitaires."

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

**🎯 Démo possible :**

> _"La configuration de l'application est fonctionnelle."_
>
> - Aller sur /parametres
> - Saisir une clé API OpenAI (ou factice pour la démo)
> - Choisir un provider de géocodage (Nominatim par défaut)
> - Montrer que les paramètres sont sauvegardés (recharger la page)
> - Expliquer : "L'utilisateur peut configurer ses clés API. Elles restent stockées localement de façon sécurisée."

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

**🎯 Démo possible :**

> _"La connexion Gmail fonctionne."_
>
> - Cliquer sur "Se connecter avec Gmail"
> - S'authentifier avec un compte Google
> - Montrer que le bouton change ("Àutorisation accordée" ou avatar)
> - Expliquer : "L'application peut maintenant accéder aux emails Gmail de l'utilisateur. Aucune donnée ne transite par nos serveurs."

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

**🎯 Démo possible :**

> _"L'extraction des emails ORSYS fonctionne."_
>
> - Cliquer sur "Extraire les emails"
> - Montrer la barre de progression pendant l'extraction
> - Ouvrir DevTools → IndexedDB → montrer les emails stockés
> - Afficher le nombre d'emails récupérés
> - Expliquer : "Tous les emails provenant d'ORSYS depuis 2014 sont maintenant stockés localement. On peut les analyser."

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

**🎯 Démo possible :**

> _"L'IA classifie automatiquement les emails."_
>
> - Montrer un email brut dans la console
> - Lancer la classification → afficher le type détecté (convocation, annulation...)
> - Montrer le niveau de confiance (ex: 95%)
> - Expliquer : "L'IA analyse chaque email et détermine son type : convocation inter/intra, annulation, bon de commande... C'est la première étape avant l'extraction."

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

**🎯 Démo possible :**

> _"L'IA extrait les informations structurées des emails."_
>
> - Prendre un email de convocation brut
> - Lancer l'extraction → afficher l'objet Formation structuré
> - Montrer les champs extraits : titre, dates, lieu, participants...
> - Comparer visuellement l'email source vs les données extraites
> - Expliquer : "L'IA transforme un email texte libre en données structurées exploitables. Dates, lieux, codes formation... tout est extrait automatiquement."

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

**🎯 Démo possible :**

> _"Les adresses sont converties en coordonnées GPS."_
>
> - Prendre une adresse de formation (ex: "ORSYS La Défense, Tour Opus")
> - Lancer le géocodage → afficher lat/lng
> - Montrer le cache IndexedDB (les adresses déjà géocodées)
> - Expliquer : "Chaque lieu de formation est géolocalisé automatiquement. Le cache évite de refaire les mêmes requêtes."

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

**🎯 Démo possible :**

> _"Les emails multiples sont fusionnés intelligemment."_
>
> - Montrer 2-3 emails concernant la même formation (confirmation + rappel)
> - Lancer la fusion → montrer une seule formation résultante
> - Montrer un cas d'annulation qui met à jour le statut
> - Expliquer : "Plusieurs emails peuvent concerner la même formation. L'algorithme les fusionne et gère les annulations. Clé unique = code formation + date."

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

**🎯 Démo possible :**

> _"Le tableau de bord affiche les statistiques clés."_
>
> - Ouvrir la page d'accueil (Dashboard)
> - Montrer les 4 cartes KPI : Total formations, Jours formés, Inter/Intra, Annulées
> - Insérer quelques formations de test → voir les chiffres se mettre à jour
> - Expliquer : "En un coup d'œil, on voit l'historique complet des formations : combien, quel type, combien d'annulations..."

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

**🎯 Démo possible :**

> _"Les données sont visualisées graphiquement."_
>
> - Montrer le graphique barres par année (2014-2026)
> - Montrer le camembert Inter vs Intra
> - Montrer le top 10 des formations les plus suivies
> - Survoler les graphiques pour voir les détails interactifs
> - Expliquer : "On visualise instantanément les tendances : évolution année par année, répartition inter/intra, formations les plus récurrentes."

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

**🎯 Démo possible :**

> _"Les formations sont affichées sur une carte interactive."_
>
> - Ouvrir la page Carte
> - Montrer les marqueurs sur la carte de France
> - Zoomer sur un cluster → voir les marqueurs se séparer
> - Cliquer sur un marqueur → popup avec détails de la formation
> - Expliquer : "Chaque formation est géolocalisée. On voit immédiatement où ont eu lieu les formations : Paris, Lyon, Toulouse..."

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

**🎯 Démo possible :**

> _"Toutes les formations sont consultables et filtrables."_
>
> - Ouvrir la page Formations
> - Montrer la liste avec les cartes de formation
> - Filtrer par année (ex: 2024)
> - Filtrer par type (Intra uniquement)
> - Rechercher "Python" ou "Management"
> - Expliquer : "On peut retrouver n'importe quelle formation passée. Filtres par année, type, statut, et recherche textuelle."

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

**🎯 Démo possible :**

> _"Les données peuvent être exportées dans plusieurs formats."_
>
> - Cliquer sur "Exporter JSON" → télécharger et ouvrir le fichier
> - Cliquer sur "Exporter CSV" → ouvrir dans Excel/Sheets
> - Cliquer sur "Exporter PDF" → montrer le rapport généré
> - Expliquer : "Les données sont portables. JSON pour archivage/sauvegarde, CSV pour analyse Excel, PDF pour rapport imprimable."

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

**🎯 Démo possible :**

> _"L'application est complète et prête pour la production."_
>
> - Parcours complet : connexion Gmail → extraction → dashboard → carte → liste → export
> - Montrer la gestion d'erreurs (déconnexion réseau simulée)
> - Montrer le responsive sur mobile (DevTools)
> - Afficher le rapport de couverture de tests (>70%)
> - Lancer `bun run build` → montrer le build prêt pour GitHub Pages
> - Expliquer : "L'application est terminée, testée, et prête à être déployée. Toutes les fonctionnalités sont opérationnelles."

---

## Commande d'analyse

### 1. Vérifier le fichier d'état (prioritaire)

```bash
cat project/.build-state.json
```

Si le fichier existe, lire `currentStep` et reprendre à cette étape.

### 2. Fallback : Analyse du système de fichiers

Si le fichier d'état n'existe pas, déterminer l'étape par inspection :

| Étape | Fichier à vérifier                                                       |
| ----- | ------------------------------------------------------------------------ |
| 0     | `project/package.json`                                                   |
| 1     | `project/vitest.config.ts`                                               |
| 2     | `project/src/types/index.ts`                                             |
| 3     | `project/src/stores/db.ts`                                               |
| 4     | `tailwindcss` dans package.json + `@import "tailwindcss"` dans index.css |
| 5     | `project/src/components/settings/SettingsPage.tsx`                       |
| 6     | `project/src/services/gmail/auth.ts`                                     |
| 7     | `project/src/components/extraction/ExtractionPanel.tsx`                  |
| 8     | `project/src/services/llm/parser.ts`                                     |
| 9     | `project/src/services/llm/prompts.ts` (extraction)                       |
| 10    | `project/src/services/geocoding/nominatim.ts`                            |
| 11    | `project/src/utils/fusion.ts`                                            |
| 12    | `project/src/components/dashboard/Dashboard.tsx`                         |
| 13    | `project/src/components/dashboard/YearlyChart.tsx`                       |
| 14    | `project/src/components/map/MapView.tsx`                                 |
| 15    | `project/src/components/formations/FormationList.tsx`                    |
| 16    | `project/src/services/export/pdf.ts`                                     |
| 17    | Tous les critères de finition                                            |

Après détermination, **créer le fichier d'état** avec l'étape trouvée.

### 3. Vérifier les tests

Vérifie aussi que les **tests correspondants existent** pour chaque module.

---

## Rapport de fin d'exécution

À la fin de chaque exécution :

### 1. Mettre à jour le fichier d'état

```bash
# Exemple après complétion de l'étape 3
cat > project/.build-state.json << 'EOF'
{
  "version": "1.0",
  "currentStep": 4,
  "lastUpdated": "TIMESTAMP_ISO",
  "steps": {
    "0": { "status": "completed", "completedAt": "..." },
    "1": { "status": "completed", "completedAt": "..." },
    "2": { "status": "completed", "completedAt": "..." },
    "3": { "status": "completed", "completedAt": "TIMESTAMP_ISO" },
    "4": { "status": "not-started" }
  },
  "filesCreated": [...]
}
EOF
```

### 2. Afficher le rapport

```
## ✅ Étape [N] terminée : [Nom de l'étape]

### Fichier d'état mis à jour :
`project/.build-state.json` → currentStep: [N+1]

### Ce qui a été fait :
- [Liste des fichiers créés/modifiés]

### 🎯 Ce que vous pouvez montrer à votre chef :
[Copier la section "Démo possible" de l'étape complétée]

### Prochaine étape :
Étape [N+1] : [Nom de l'étape suivante]

### Pour continuer :
Relance ce prompt pour exécuter l'étape suivante.
```

### 3. En cas d'échec

```
## ❌ Étape [N] échouée : [Nom de l'étape]

### Erreur :
[Description de l'erreur]

### Fichier d'état :
`project/.build-state.json` → status: "failed"

### Pour reprendre :
Corrige l'erreur puis relance ce prompt.
```

---

## Gestion du fichier d'état

### Réinitialiser le projet (recommencer à zéro)

```bash
rm project/.build-state.json
```

### Forcer une étape spécifique

Modifier manuellement `currentStep` dans le fichier JSON :

```bash
# Exemple : reprendre à l'étape 5
jq '.currentStep = 5' project/.build-state.json > tmp.json && mv tmp.json project/.build-state.json
```

### Ignorer le fichier d'état dans Git (optionnel)

Si tu veux que chaque développeur ait son propre état :

```bash
echo ".build-state.json" >> project/.gitignore
```

### Vérifier l'état actuel

```bash
cat project/.build-state.json | jq '.currentStep, .steps[.currentStep | tostring].status'
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
