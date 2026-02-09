# ORSYS Training Tracker

Application web SPA pour extraire, analyser et visualiser l'historique des formations ORSYS à partir des emails Gmail.

![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-teal)
![Vite](https://img.shields.io/badge/Vite-7-orange)

## 🎯 Fonctionnalités

- **Extraction automatique** des emails ORSYS depuis Gmail (depuis 2014)
- **Classification par IA** (OpenAI GPT-4o-mini) : convocations, annulations, bons de commande...
- **Extraction structurée** des données de formation (dates, lieux, participants...)
- **Géocodage automatique** des lieux de formation (Nominatim)
- **Tableau de bord** avec statistiques et graphiques D3.js
- **Carte interactive** (Leaflet) avec tous les lieux de formation
- **Liste filtrable** des formations avec recherche avancée
- **Export** en JSON, CSV et PDF

## 🚀 Installation

### Prérequis

- [Bun](https://bun.sh/) ≥ 1.0

### Installation des dépendances

```bash
cd project
bun install
```

### Démarrage en mode développement

```bash
bun run dev
```

L'application sera accessible sur http://localhost:5173

## ⚙️ Configuration

Au premier lancement, accédez à la page **Paramètres** pour configurer :

1. **Clé API OpenAI** : Nécessaire pour la classification et l'extraction des emails
   - Créez une clé sur [platform.openai.com](https://platform.openai.com/)
   - Utilisez le bouton "Tester la connexion" pour valider

2. **Connexion Gmail** : Autorisez l'accès à votre compte Gmail
   - Seuls les emails provenant de `@orsys.fr` sont traités
   - Les données restent sur votre machine (stockage IndexedDB local)

3. **Provider de géocodage** : Nominatim (par défaut, gratuit)

## 📖 Utilisation

### 1. Extraction des emails

1. Connectez-vous avec Gmail sur la page **Paramètres**
2. Cliquez sur **Extraire les emails** sur le panneau d'extraction
3. Attendez la fin de l'extraction (barre de progression)

### 2. Traitement automatique

- Les emails sont automatiquement classifiés par type (convocation, annulation...)
- Les données de formation sont extraites (dates, lieux, participants)
- Les adresses sont géocodées pour affichage sur la carte

### 3. Consultation des données

- **Tableau de bord** : Vue d'ensemble avec KPI et graphiques
- **Carte** : Visualisation géographique des formations
- **Formations** : Liste détaillée avec filtres et recherche

### 4. Export

Depuis le tableau de bord, exportez vos données en :

- **JSON** : Sauvegarde complète avec métadonnées
- **CSV** : Import dans Excel/Google Sheets
- **PDF** : Rapport imprimable

## 🧪 Tests

```bash
# Tests unitaires (watch mode)
bun run test

# Tests unitaires (exécution unique)
bun run test:run

# Couverture de tests
bun run test:coverage
```

## 🏗️ Build Production

```bash
bun run build
```

Les fichiers produits sont dans le dossier `dist/`.

### Déploiement GitHub Pages

Le build est configuré pour GitHub Pages avec le préfixe `/orsys-gmail/`.

## 📁 Structure du projet

```
project/
├── src/
│   ├── components/      # Composants React
│   │   ├── dashboard/   # Tableau de bord + graphiques D3
│   │   ├── extraction/  # Panneau d'extraction emails
│   │   ├── formations/  # Liste et cartes de formation
│   │   ├── layout/      # Header, Footer, Layout
│   │   ├── map/         # Carte Leaflet
│   │   └── pages/       # Pages de l'application
│   ├── hooks/           # Hooks React personnalisés
│   ├── services/        # Services métier
│   │   ├── export/      # Export JSON/CSV/PDF
│   │   ├── geocoding/   # Géocodage Nominatim
│   │   ├── gmail/       # API Gmail + OAuth
│   │   └── llm/         # Classification/extraction OpenAI
│   ├── stores/          # IndexedDB via Dexie.js
│   ├── types/           # Types TypeScript
│   └── utils/           # Utilitaires (fusion, stats...)
└── public/              # Fichiers statiques
```

## 🔒 Sécurité et confidentialité

- **Aucun serveur** : Application 100% côté client
- **Données locales** : Stockage IndexedDB dans le navigateur
- **Clés API** : Stockées dans localStorage (jamais transmises à des tiers)
- **OAuth Gmail** : Connexion directe via Google Identity Services

## 📚 Documentation

Consultez le dossier `docs/` à la racine du projet pour la documentation technique détaillée.

## 📄 Licence

Ce projet est à usage privé.
