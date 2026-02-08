# AGENTS.md - Guide pour les agents IA

## Vue d'ensemble du projet

**ORSYS Training Tracker** est une Single Page Application (SPA) React permettant d'extraire, analyser et visualiser l'historique des formations ORSYS à partir des emails Gmail depuis 2014.

### Objectif principal

Extraire automatiquement les données de formation depuis les emails Gmail (domaine `@orsys.fr`) en utilisant un LLM (GPT-4o) pour classifier et parser les emails, puis afficher ces données sur une carte interactive avec des statistiques.

---

## Stack technique

| Composant      | Technologie                               |
| -------------- | ----------------------------------------- |
| Runtime        | Bun                                       |
| Framework      | React + TypeScript                        |
| Build          | Vite                                      |
| Graphiques     | D3.js                                     |
| Cartographie   | Leaflet.js + react-leaflet                |
| Stockage local | IndexedDB (via Dexie.js)                  |
| Auth Gmail     | OAuth 2.0 (Google Identity Services)      |
| LLM            | OpenAI GPT-4o                             |
| Géocodage      | Adapter pattern (Nominatim/Google/Mapbox) |
| Export         | JSON, CSV, PDF (jsPDF)                    |
| **Tests**      | **Vitest + Testing Library**              |
| Déploiement    | GitHub Pages                              |
| Langue UI      | Français uniquement                       |

---

## Structure du projet

```
orsys-gmail/
├── docs/                       # Documentation technique détaillée
│   ├── 01-architecture.md      # Architecture globale et flux de données
│   ├── 02-data-model.ts        # Types TypeScript (Formation, Participant, etc.)
│   ├── 03-llm-prompts.md       # Prompts de classification et extraction
│   ├── 04-gmail-api.md         # Configuration OAuth et appels Gmail
│   ├── 05-geocoding.md         # Adapters de géocodage
│   ├── 06-ui-specs.md          # Spécifications des interfaces
│   ├── 07-export.md            # Formats d'export (JSON/CSV/PDF)
│   ├── 08-deployment.md        # Configuration Vite et CI/CD
│   └── 09-exploitation.md      # Manuel utilisateur
├── input/
│   ├── brief.md                # Spécifications fonctionnelles
│   └── emails-samples/         # Exemples d'emails ORSYS par type
│       ├── annulation.txt
│       ├── bon-commande.txt
│       ├── confirmation-inter.txt
│       ├── confirmation-intra.txt
│       └── info-facturation.txt
└── src/                        # Code source (à créer)
    ├── components/             # Composants React
    ├── services/               # Services (Gmail, LLM, Geocoding, Export)
    ├── stores/                 # IndexedDB et state management
    ├── hooks/                  # Custom hooks React
    ├── types/                  # Types TypeScript partagés
    └── utils/                  # Utilitaires
```

---

## Documentation de référence

Avant de modifier le code, **consulter obligatoirement** :

| Fichier                                            | Contenu                                                     |
| -------------------------------------------------- | ----------------------------------------------------------- |
| [docs/01-architecture.md](docs/01-architecture.md) | Architecture, flux de données, structure composants         |
| [docs/02-data-model.ts](docs/02-data-model.ts)     | **Types TypeScript complets** (à copier dans `/src/types/`) |
| [docs/03-llm-prompts.md](docs/03-llm-prompts.md)   | Prompts LLM pour classification et extraction               |
| [input/brief.md](input/brief.md)                   | Spécifications fonctionnelles complètes                     |

---

## Concepts clés

### Types d'emails ORSYS

Les emails sont classifiés en 7 catégories :

| Type                | Action                                    |
| ------------------- | ----------------------------------------- |
| `convocation-inter` | Créer formation inter-entreprise          |
| `convocation-intra` | Créer formation intra-entreprise          |
| `annulation`        | Créer/modifier formation → statut annulée |
| `bon-commande`      | Créer formation préliminaire              |
| `info-facturation`  | Enrichir données de facturation           |
| `rappel`            | Ignorer ou fusionner                      |
| `autre`             | Ignorer                                   |

### Flux de traitement

```
Gmail API → Classification LLM → Extraction LLM → Géocodage → IndexedDB → UI
```

### Modèle de données principal

Le type `Formation` (voir `docs/02-data-model.ts`) contient :

- Informations générales : `titre`, `codeFormation`, `codeEtendu`, `statut`
- Dates : `dateDebut`, `dateFin`, `dates[]`, `nombreJours`
- Localisation : `lieu` (nom, adresse, GPS)
- Type : `typeSession` (inter/intra), `niveauPersonnalisation`
- Participants : `nombreParticipants`, `participants[]`
- Facturation : `entiteFacturation`, `referenceIntra`, `referenceCommande`

---

## Conventions de code

### TypeScript

- **Strictement typé** : Pas de `any`, utiliser les types de `docs/02-data-model.ts`
- **Enums** : Utiliser les enums définis (`StatutFormation`, `TypeSession`, etc.)
- **Dates** : Format ISO 8601 (`YYYY-MM-DD`)

### React

- **Composants fonctionnels** avec hooks
- **Nommage** : PascalCase pour composants, camelCase pour fonctions/variables
- **Organisation** : Un composant par fichier, fichiers dans le dossier approprié

### Patterns architecturaux

- **Adapter Pattern** pour le géocodage (3 providers interchangeables)
- **Services** : Logique métier isolée dans `/services/`
- **Stores** : Gestion IndexedDB via Dexie.js dans `/stores/`

### Internationalisation

- **Langue unique : Français** pour toute l'interface utilisateur
- Messages, labels, boutons en français

### Linting et formatage

- **ESLint** : Prévu (voir `docs/08-deployment.md`) mais **pas encore configuré**
- **Prettier** : Non utilisé actuellement

### Tests unitaires

- **Vitest** : Framework de test compatible Vite
- **Testing Library** : Tests composants React
- **fake-indexeddb** : Mock IndexedDB pour tests stores
- **Couverture** : Objectif > 70%
- **Fichiers** : Co-localisés `*.test.ts` / `*.test.tsx`

---

## Points d'attention

### Sécurité

- Les clés API (OpenAI, Google) sont **stockées côté client** (localStorage)
- Le token Gmail est géré via Google Identity Services
- Ne jamais committer de clés API dans le code

### Performance

- **Cache IndexedDB** : Éviter de re-traiter les emails déjà parsés
- **Rate limiting** : Respecter les limites Nominatim (1 req/s)
- **Chunking Vite** : Séparer les vendors lourds (D3, Leaflet, jsPDF)

### Gestion des erreurs

- Les emails mal parsés doivent être loggés, pas bloquants
- Gérer gracieusement les erreurs réseau (Gmail, OpenAI, géocodage)
- Afficher des messages d'erreur explicites en français

---

## Commandes de développement

```bash
# Installation des dépendances
bun install

# Développement local
bun run dev

# Tests unitaires (watch mode)
bun run test

# Tests unitaires (une seule exécution)
bun run test:run

# Couverture de tests
bun run test:coverage

# Build production
bun run build

# Preview du build
bun run preview
```

---

## Exemples d'emails

Le dossier `input/emails-samples/` contient des exemples représentatifs :

- **confirmation-inter.txt** : Email type convocation inter-entreprise
- **confirmation-intra.txt** : Email type convocation intra-entreprise
- **annulation.txt** : Email d'annulation de session
- **bon-commande.txt** : Confirmation de commande anticipée
- **info-facturation.txt** : Informations pour facturation

**Utiliser ces exemples** pour tester les prompts LLM et valider l'extraction.

---

## Checklist avant modification

1. ✅ Lire le fichier de documentation pertinent dans `/docs/`
2. ✅ Vérifier les types dans `docs/02-data-model.ts`
3. ✅ Respecter les conventions de nommage et de structure
4. ✅ Tester avec les exemples d'emails dans `/input/emails-samples/`
5. ✅ Vérifier que l'UI reste en français
6. ✅ S'assurer que le build Vite passe sans erreur

---

## Contacts et ressources

- **API Gmail** : [Google Cloud Console](https://console.cloud.google.com/)
- **API OpenAI** : [platform.openai.com](https://platform.openai.com/)
- **Nominatim** : [nominatim.openstreetmap.org](https://nominatim.openstreetmap.org/)
- **Leaflet** : [leafletjs.com](https://leafletjs.com/)
- **D3.js** : [d3js.org](https://d3js.org/)
