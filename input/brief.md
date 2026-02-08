# ORSYS Training Tracker

## 📋 Contexte et objectif

Développer un outil permettant d'extraire et d'analyser l'historique complet des formations dispensées pour ORSYS (organisme de formation professionnelle) depuis 2014, à partir des emails Gmail.

---

## 🏗️ Architecture de la solution

L'outil est une **application web unique** (SPA React) intégrant :

| Fonctionnalité    | Description                                             |
| ----------------- | ------------------------------------------------------- |
| **Extraction**    | Module d'extraction Gmail intégré, déclenché via bouton |
| **Cache**         | Stockage IndexedDB pour économiser les appels API       |
| **Visualisation** | Tableaux de bord, statistiques et cartographie          |
| **Export**        | Export des données en JSON, CSV et PDF                  |

---

## 📊 Modèle de données : Formation

Chaque formation extraite contiendra les informations suivantes :

### Informations générales

| Champ           | Description                      | Exemple                   |
| --------------- | -------------------------------- | ------------------------- |
| `titre`         | Intitulé complet de la formation | "Architecture logicielle" |
| `codeFormation` | Code court de la formation       | `BOA`                     |
| `codeEtendu`    | Code étendu de la formation      | `AGUPA1`                  |
| `statut`        | État de la formation             | `confirmée` / `annulée`   |

### Dates

| Champ         | Description                                           |
| ------------- | ----------------------------------------------------- |
| `dateDebut`   | Date de démarrage de la session                       |
| `dates`       | Ensemble des dates de la session (jours de formation) |
| `nombreJours` | Durée totale de la formation en jours                 |

### Localisation

| Champ            | Description                                  |
| ---------------- | -------------------------------------------- |
| `lieu`           | Nom du lieu (ex: "ORSYS Paris La Défense")   |
| `adresse`        | Adresse postale complète                     |
| `coordonneesGPS` | Latitude / Longitude (géocodage automatique) |

### Type de formation

| Champ                    | Description               | Valeurs possibles                              |
| ------------------------ | ------------------------- | ---------------------------------------------- |
| `typeSession`            | Intra ou inter-entreprise | `intra` / `inter`                              |
| `niveauPersonnalisation` | Degré de personnalisation | `standard` / `spécifique` / `ultra-spécifique` |

### Participants et accès

| Champ                | Description                                     |
| -------------------- | ----------------------------------------------- |
| `nombreParticipants` | Nombre total de participants                    |
| `participants`       | Liste des participants (nom + email)            |
| `motDePasseDocadmin` | Mot de passe formateur pour le portail DocAdmin |

### Contact (formations intra chez le client)

| Champ               | Description                     |
| ------------------- | ------------------------------- |
| `contactEntreprise` | Coordonnées du contact sur site |

### Facturation

| Champ               | Description                               | Valeurs possibles                                    |
| ------------------- | ----------------------------------------- | ---------------------------------------------------- |
| `entiteFacturation` | Entité du groupe ORSYS à facturer         | `ORSYS` / `ORSYS INSTITUT` / `ORSYS BELGIQUE` / etc. |
| `referenceIntra`    | Numéro de référence intra (si applicable) | ex: `81982/1`                                        |
| `referenceCommande` | Référence de commande                     | ex: `GIAZZ1-2026-05-04`                              |

---

## ⚠️ Règles métier

- **Formations annulées** : Certaines formations sont annulées avant leur tenue. Un email d'annulation permet d'identifier ces cas. Ces formations doivent être marquées avec le statut `annulée` et exclues des statistiques de formations dispensées.

---

## 🖥️ Front-end : Fonctionnalités attendues

### Cartographie interactive

- Affichage d'une carte géographique (Leaflet.js)
- Marqueurs pour chaque lieu de formation
- Clustering des marqueurs si plusieurs formations au même endroit
- Popup avec détails au clic sur un marqueur

### Tableaux de bord et statistiques

- **Nombre total** de formations dispensées
- **Répartition par code de formation** (histogramme ou tableau)
- **Timeline** des formations par année
- Filtres par période, type de session, statut

---

## 📁 Format de sortie JSON

```json
{
  "metadata": {
    "dateExtraction": "2026-02-08T10:00:00Z",
    "totalFormations": 150,
    "formationsAnnulees": 12
  },
  "formations": [
    {
      "id": "unique-id",
      "titre": "...",
      "codeFormation": "BOA",
      "codeEtendu": "AGUPA1",
      "statut": "confirmée",
      "dateDebut": "2024-03-15",
      "dates": ["2024-03-15", "2024-03-16", "2024-03-17"],
      "nombreJours": 3,
      "lieu": {
        "nom": "ORSYS Paris",
        "adresse": "...",
        "gps": { "lat": 48.8566, "lng": 2.3522 }
      },
      "typeSession": "inter",
      "niveauPersonnalisation": "standard",
      "nombreParticipants": 8,
      "participants": [
        { "nom": "Dupont Jean", "email": "j.dupont@example.com" }
      ],
      "motDePasseDocadmin": "xxxxx",
      "contactEntreprise": null
    }
  ]
}
```

---

## 🛠️ Stack technique

| Composant    | Technologie                                             |
| ------------ | ------------------------------------------------------- |
| Runtime      | Bun                                                     |
| Front-end    | Vite + React + TypeScript                               |
| Graphiques   | D3.js                                                   |
| Cartographie | Leaflet.js                                              |
| Géocodage    | Adapter pattern (Nominatim / Google Geocoding / Mapbox) |
| Auth Gmail   | OAuth 2.0 interactif (popup Google)                     |
| Cache        | IndexedDB (économie d'appels API Gmail)                 |
| **Parsing**  | **LLM API (extraction structurée des emails)**          |
| Déploiement  | GitHub Pages (statique)                                 |
| Langue UI    | Français uniquement                                     |

---

## 🔧 Spécifications techniques complémentaires

### Architecture

- **Extraction intégrée** : L'extracteur Gmail est intégré au front-end (pas de script séparé)
- **Bouton d'extraction** : Déclenchement manuel via l'interface utilisateur
- **Cache IndexedDB** : Stockage local des emails déjà récupérés pour éviter les appels API redondants

### Identification des emails ORSYS

- **Domaine expéditeur** : `*@orsys.fr`
- **Query Gmail** : `from:orsys.fr` combiné avec mots-clés dans le sujet si besoin

### Parsing des emails via LLM

Les emails ORSYS n'ont pas un format fixe. Un LLM est utilisé pour classifier et extraire les informations :

#### Étape 1 : Classification automatique

Le LLM identifie le **type d'email** parmi :

| Type                | Description                             | Action                           |
| ------------------- | --------------------------------------- | -------------------------------- |
| `convocation-inter` | Confirmation formation inter-entreprise | Extraire formation               |
| `convocation-intra` | Confirmation formation intra-entreprise | Extraire formation               |
| `annulation`        | Annulation de session                   | Extraire + marquer annulée       |
| `bon-commande`      | Confirmation anticipée (J-30+)          | Créer formation, fusionner après |
| `info-facturation`  | Infos post-formation pour facturer      | Enrichir entité facturation      |
| `rappel`            | Rappel de formation à venir             | Ignorer ou fusionner             |
| `autre`             | Email non pertinent                     | Ignorer                          |

#### Étape 2 : Extraction structurée

Selon le type détecté, le LLM extrait les données pertinentes en JSON conforme au schéma `Formation`.

#### Configuration

- **API LLM** : OpenAI (GPT-4o)
- **Avantages** : Robuste aux variations de format, pas de regex à maintenir, évolutif

### Gestion des doublons

- **Fusion intelligente** : En cas de plusieurs emails pour la même session, fusion des informations (priorité aux données les plus récentes/complètes)

### Export des données

| Format | Description                     |
| ------ | ------------------------------- |
| JSON   | Format natif, réimportable      |
| CSV    | Compatible Excel/tableurs       |
| PDF    | Rapport formaté pour impression |
