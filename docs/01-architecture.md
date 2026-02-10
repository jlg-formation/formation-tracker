# 01 - Architecture

## Vue d'ensemble

ORSYS Training Tracker est une **Single Page Application (SPA)** React qui permet d'extraire, analyser et visualiser l'historique des formations ORSYS à partir des emails Gmail.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ORSYS Training Tracker                           │
│                                (SPA React)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │  Dashboard  │    │    Carte    │    │   Liste     │                     │
│  │  (D3.js)    │    │ (Leaflet)   │    │ Formations  │                     │
│  └─────────────┘    └─────────────┘    └─────────────┘                     │
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                      │
│  │    Mails    │    │  Paramètres │    │  Geocache   │                      │
│  │ (analyse)   │    │             │    │ (géocodage) │                      │
│  └─────────────┘    └─────────────┘    └─────────────┘                      │
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
              │  │ API     │ │  LLM    │ │ Nominatim │  │
              │  └─────────┘ └─────────┘ └───────────┘  │
              └─────────────────────────────────────────┘
```

---

## Flux de données

### Flux d'extraction

Le traitement des emails est découpé en **deux étapes indépendantes** :

1. **Analyse LLM** : Classification + Extraction des données JSON → stockage dans `emails_raw`
2. **Fusion** : Génération/mise à jour des formations → stockage dans `formations`

Cette séparation permet de **relancer la fusion sans refaire l'analyse** (économie de tokens LLM) ou d'**analyser de nouveaux emails sans fusionner immédiatement**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           ÉTAPE 1 : EXTRACTION + ANALYSE                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐                       │
│  │  Bouton  │────▶│  Gmail   │────▶│   LLM    │────▶│ IndexedDB│                       │
│  │ Extraire │     │   API    │     │  Parser  │     │  emails  │                       │
│  └──────────┘     └──────────┘     └──────────┘     └──────────┘                       │
│                        │                │                                              │
│                        ▼                ▼                                              │
│                   emails_raw      Classification                                       │
│                     cache         + Extraction                                         │
│                                   (JSON stocké)                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              ÉTAPE 2 : FUSION                                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐                       │
│  │  Bouton  │────▶│  Emails  │────▶│ Geocoding│────▶│ IndexedDB│                       │
│  │ Fusionner│     │ analysés │     │  Service │     │formations│                       │
│  └──────────┘     └──────────┘     └──────────┘     └──────────┘                       │
│                        │                │                                              │
│                        ▼                ▼                                              │
│                   Regroupement     geocache                                            │
│                   par formation                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Détail du flux

#### Étape 1 : Extraction + Analyse

1. **Authentification Gmail** : OAuth 2.0 popup → token stocké
2. **Requête Gmail** : `from:orsys.fr after:2014/01/01` → listing des emails
3. **Filtrage à la source** : exclusion des emails non pertinents **dès la requête Gmail** (paramètre `q`, exclusions sur le `subject` : ex. `Planning ORSYS Réactualisé`, `Demande Intra `) → jamais listés, jamais récupérés, jamais stockés
4. **Récupération** : téléchargement du contenu des emails filtrés
5. **Cache IndexedDB** : Les emails déjà téléchargés sont ignorés (économie API)
6. **Classification LLM** : Chaque email est classifié (convocation, annulation, etc.)
7. **Extraction LLM** : Les données structurées sont extraites en JSON
8. **Stockage analyse** : Les résultats (classification + extraction JSON) sont stockés dans la table `emails` avec le flag `processed = true`

Les résultats d'analyse sont conservés pour affichage dans la page « Mails ».

**Règles métier (post-traitement)** : certaines règles sont appliquées après l'extraction (ex. formations virtuelles, voir plus bas).

#### Étape 2 : Fusion (déclenchable séparément)

7. **Fusion** : Les emails analysés relatifs à la même session sont fusionnés (clé : `codeEtendu + dateDebut`)
8. **Géocodage** : Les adresses sont converties en coordonnées GPS (sauf formations annulées)
9. **Contrôles de cohérence** : Détection d'incohérences (ex. recouvrement de dates entre formations) et signalement dans l'interface (section « Erreurs » des paramètres)
10. **Stockage formations** : Les formations sont persistées dans IndexedDB

Après extraction, si le géocodage est absent ou imprécis, l'utilisateur peut **corriger manuellement** les coordonnées GPS depuis la **page détail** d'une formation : bouton « Corriger la position », clic sur la carte, puis « Valider la nouvelle position ».

---

## Règles métier (emails)

- **Engagement ORSYS** : une formation ne doit être considérée « confirmée » qu'à partir d'un email de **convocation** (`convocation-inter`/`convocation-intra`) ou d'un **bon de commande** (`bon-commande`).
- **Demande intra** (`demande-intra`) : une demande de formation intra par email **n'engage pas ORSYS** et ne doit pas être comptabilisée comme une formation confirmée. Les emails dont le sujet contient `Demande Intra ` sont **filtrés à la source** et ne sont jamais récupérés ni stockés.
- **Annulations** : un email `annulation` marque la session comme **annulée**.
  - Par défaut, les formations **annulées** ne sont **pas incluses** dans les **statistiques globales**.
  - Elles sont **comptabilisées séparément** (ex. indicateur « Annulées »).
  - Il est **interdit de géocoder** une formation **annulée**.
- **Formations futures** : par défaut, les formations dont la date de début est dans le futur (non encore réalisées) ne sont **pas affichées** dans les statistiques ni dans les vues principales.
- **Preuves de réalisation** :
  - `emargements` : suivi des signatures / feuille d'émargement (ex. "Service suivi qualité inter"). Preuve forte que la session a eu lieu.
  - `accuse-reception` : accusé de réception de documents administratifs ("Service Suivi Qualité Logistique"). Preuve forte que la session a eu lieu.
    Ces emails peuvent contenir des informations partielles : on peut créer/mettre à jour une formation **incomplète** si nécessaire.
- Mention **« Annulé et remplacé »** : à traiter comme une **annulation** ; indique qu'une nouvelle session est probablement créée en remplacement (ex. changement de dates et/ou de code formation). La session de remplacement est gérée par les emails ultérieurs (nouvelle convocation / bon de commande).
- **Formations multi-parties (bon de commande)** : un email de `bon-commande` peut contenir **plusieurs formations** sous forme de "parties" (ex. "1ère partie : Du 21 au 22 janvier", "2ème partie : Le 29 janvier"). Dans ce cas :
  - **Créer autant de formations que de parties** distinctes.
  - **Lier l'email** (son ID) à **toutes les formations créées** via le champ `emailIds`.
  - Chaque formation conserve le même `titre`, `codeEtendu`, `referenceIntra`, etc., mais avec ses propres dates (`dateDebut`, `dateFin`, `dates`).

---

## Règles métier (formations)

- **Formations virtuelles (classe virtuelle / CV)** : si `codeEtendu` se termine par `CV<n>` où `<n>` est un chiffre (`0`…`9`), alors l'adresse du lieu doit être forcée à :
  - `2 allée du Commandant Charcot 77200 TORCY (France)`
    Cette règle est appliquée pendant l'analyse des formations (post-traitement), avant le géocodage.

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
│   │   ├── FormationDetail.tsx # Page détail
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
