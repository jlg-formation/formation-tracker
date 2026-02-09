# 01 - Architecture

## Vue d'ensemble

ORSYS Training Tracker est une **Single Page Application (SPA)** React qui permet d'extraire, analyser et visualiser l'historique des formations ORSYS à partir des emails Gmail.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ORSYS Training Tracker                           │
│                                (SPA React)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  Dashboard  │    │    Carte    │    │   Liste     │    │  Paramètres │  │
│  │  (D3.js)    │    │ (Leaflet)   │    │ Formations  │    │             │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                              Services                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Gmail        │  │ LLM Parser   │  │ Geocoding    │  │ Export       │    │
│  │ Service      │  │ Service      │  │ Service      │  │ Service      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                              Stockage                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         IndexedDB                                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │ emails_raw  │  │ formations  │  │ geocache    │  │ settings    │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
              ┌─────────────────────────────────────────┐
              │            APIs Externes                │
              │  ┌─────────┐ ┌─────────┐ ┌───────────┐  │
              │  │ Gmail   │ │ OpenAI  │ │ Geocoding │  │
              │  │ API     │ │ GPT-4o  │ │ Nominatim │  │
              │  └─────────┘ └─────────┘ └───────────┘  │
              └─────────────────────────────────────────┘
```

---

## Flux de données

### Flux d'extraction

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Bouton  │────▶│  Gmail   │────▶│   LLM    │────▶│ Geocoding│────▶│ IndexedDB│
│ Extraire │     │   API    │     │  Parser  │     │  Service │     │  Store   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
                      │                │                │
                      ▼                ▼                ▼
                 emails_raw      Classification     geocache
                   cache         + Extraction
```

### Détail du flux

1. **Authentification Gmail** : OAuth 2.0 popup → token stocké
2. **Requête Gmail** : `from:orsys.fr` → récupération des emails
3. **Cache IndexedDB** : Les emails déjà traités sont ignorés (économie API)
4. **Classification LLM** : Chaque email est classifié (convocation, annulation, etc.)
5. **Extraction LLM** : Les données structurées sont extraites en JSON
6. **Géocodage** : Les adresses sont converties en coordonnées GPS
7. **Fusion** : Les emails relatifs à la même session sont fusionnés
8. **Contrôles de cohérence** : Détection d'incohérences (ex. recouvrement de dates entre formations) et signalement dans l'interface (section « Erreurs » des paramètres)
9. **Stockage** : Les formations sont persistées dans IndexedDB

---

## Règles métier (emails)

- **Engagement ORSYS** : une formation ne doit être considérée « confirmée » qu'à partir d'un email de **convocation** (`convocation-inter`/`convocation-intra`) ou d'un **bon de commande** (`bon-commande`).
- **Demande intra** (`demande-intra`) : une demande de formation intra par email **n'engage pas ORSYS** et ne doit pas être comptabilisée comme une formation confirmée (emails à ignorer côté création/statistiques, éventuellement tracés dans le cache emails).
- **Annulations** : un email `annulation` marque la session comme **annulée** et elle doit être exclue des statistiques de formations dispensées.
- Mention **« Annulé et remplacé »** : à traiter comme une **annulation** ; indique qu'une nouvelle session est probablement créée en remplacement (ex. changement de dates et/ou de code formation). La session de remplacement est gérée par les emails ultérieurs (nouvelle convocation / bon de commande).

---

## Contrôles de cohérence

- **Recouvrement de dates** : deux formations ne peuvent pas avoir lieu aux mêmes dates. Un recouvrement indique une erreur probable dans le traitement des emails et doit être **signalé dans l'interface web**.

---

## Structure des composants React

```
project/src/
├── main.tsx                    # Point d'entrée
├── App.tsx                     # Router principal
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   │
│   ├── dashboard/
│   │   ├── Dashboard.tsx       # Page principale
│   │   ├── StatsCards.tsx      # Cartes KPI
│   │   ├── YearlyChart.tsx     # Timeline D3.js
│   │   └── TopCoursesChart.tsx # Histogramme D3.js
│   │
│   ├── map/
│   │   ├── MapView.tsx         # Page carte
│   │   ├── FormationMarker.tsx # Marqueur Leaflet
│   │   └── MarkerCluster.tsx   # Clustering
│   │
│   ├── formations/
│   │   ├── FormationList.tsx   # Liste filtrable
│   │   ├── FormationCard.tsx   # Carte formation
│   │   ├── FormationDetail.tsx # Modal détail
│   │   └── Filters.tsx         # Filtres
│   │
│   ├── extraction/
│   │   ├── ExtractionPanel.tsx # Panneau extraction
│   │   ├── ProgressBar.tsx     # Barre de progression
│   │   └── ExtractionLog.tsx   # Logs temps réel
│   │
│   └── export/
│       ├── ExportPanel.tsx     # Options d'export
│       └── ExportButton.tsx    # Boutons JSON/CSV/PDF
│
├── services/
│   ├── gmail/
│   │   ├── auth.ts             # OAuth 2.0
│   │   ├── api.ts              # Appels Gmail API
│   │   └── types.ts            # Types Gmail
│   │
│   ├── llm/
│   │   ├── parser.ts           # Parsing via OpenAI
│   │   ├── prompts.ts          # Prompts classification/extraction
│   │   └── types.ts            # Types LLM
│   │
│   ├── geocoding/
│   │   ├── adapter.ts          # Interface adapter
│   │   ├── nominatim.ts        # Implémentation Nominatim
│   │   ├── google.ts           # Implémentation Google
│   │   └── mapbox.ts           # Implémentation Mapbox
│   │
│   └── export/
│       ├── json.ts             # Export JSON
│       ├── csv.ts              # Export CSV
│       └── pdf.ts              # Export PDF (jsPDF)
│
├── stores/
│   ├── db.ts                   # IndexedDB (Dexie.js)
│   ├── formationsStore.ts      # Store formations
│   └── settingsStore.ts        # Store paramètres
│
├── hooks/
│   ├── useFormations.ts        # Hook formations
│   ├── useExtraction.ts        # Hook extraction
│   └── useFilters.ts           # Hook filtres
│
├── types/
│   └── index.ts                # Types partagés
│
└── utils/
    ├── dates.ts                # Utilitaires dates
    ├── fusion.ts               # Logique de fusion
    └── constants.ts            # Constantes
```

---

## Technologies

| Couche      | Technologie              | Rôle                              |
| ----------- | ------------------------ | --------------------------------- |
| Runtime     | Bun                      | Exécution, build                  |
| Build       | Vite                     | Bundler, HMR                      |
| UI          | React 18                 | Composants                        |
| **Styling** | **Tailwind CSS v4**      | Classes utilitaires (CSS minimal) |
| Routing     | React Router             | Navigation SPA                    |
| State       | Zustand ou Context       | État global                       |
| Persistence | IndexedDB (Dexie.js)     | Stockage local                    |
| Charts      | D3.js                    | Graphiques                        |
| Maps        | Leaflet + React-Leaflet  | Cartographie                      |
| PDF         | jsPDF                    | Export PDF                        |
| HTTP        | fetch                    | Appels API                        |
| Tests       | Vitest + Testing Library | Tests unitaires                   |

---

## Sécurité

- **OAuth 2.0** : Aucun mot de passe stocké, tokens gérés par Google
- **Clé API OpenAI** : Stockée en `localStorage` (saisie utilisateur)
- **Données locales** : Tout reste dans le navigateur (IndexedDB)
- **Pas de backend** : Aucune donnée transmise à un serveur tiers (hors APIs)

---

## Limites

- **Quota Gmail API** : 250 unités/utilisateur/seconde
- **Quota OpenAI** : Selon plan utilisateur
- **IndexedDB** : ~50% de l'espace disque disponible
- **GitHub Pages** : Statique uniquement, pas de secrets côté serveur
