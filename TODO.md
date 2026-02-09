# TODO - Audit ORSYS Training Tracker

> **Date de l'audit** : 9 février 2026  
> **État global** : L'application est fonctionnelle avec les fonctionnalités principales implémentées. Plusieurs écarts avec la documentation et des fonctionnalités manquantes identifiés.

---

## 🔴 Incohérences (Écarts doc ↔ implémentation)

### Critique

| ID    | Élément            | Documentation                                                                                                                                            | Implémentation                                          | Action requise                         |
| ----- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------- |
| id001 | Clustering carte   | [01-architecture.md](docs/01-architecture.md) mentionne `MarkerCluster.tsx` et [06-ui-specs.md](docs/06-ui-specs.md#L118) spécifie Leaflet.markercluster | Non implémenté - marqueurs simples groupés manuellement | Ajouter `leaflet.markercluster`        |
| id002 | Adapters géocodage | [05-geocoding.md](docs/05-geocoding.md) définit 3 adapters (Nominatim, Google, Mapbox)                                                                   | Seul `nominatim.ts` existe                              | Implémenter `google.ts` et `mapbox.ts` |
| id003 | Testing Library    | [08-deployment.md](docs/08-deployment.md#L126) et `setup.ts` utilisent `@testing-library/*`                                                              | Packages absents de `package.json`                      | Ajouter les dépendances                |

### Important

| ID    | Élément               | Documentation                                                 | Implémentation                                     | Action requise                 |
| ----- | --------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ------------------------------ |
| id004 | Composants extraction | Architecture définit `ProgressBar.tsx` et `ExtractionLog.tsx` | Intégrés directement dans `ExtractionPanel.tsx`    | Documenter ou refactoriser     |
| id005 | Composants export     | Architecture définit `ExportPanel.tsx` et `ExportButton.tsx`  | Export intégré dans `Dashboard.tsx`                | Documenter ou créer composants |
| id006 | `FormationDetail.tsx` | Composant modal séparé dans architecture                      | `FormationModal` inline dans `FormationList.tsx`   | Extraire en composant          |
| id007 | Hooks manquants       | Architecture définit `useExtraction.ts` et `useFilters.ts`    | Non implémentés (logique dans composants)          | Créer ou supprimer de la doc   |
| id008 | Enums → Const objects | [02-data-model.ts](docs/02-data-model.ts) utilise `enum`      | Code utilise `const objects` pour compatibilité TS | Mettre à jour la documentation |

---

## 🟡 Fonctionnalités manquantes

### Critique

| ID    | Fonctionnalité       | Spécification                                                                | État                              | Priorité |
| ----- | -------------------- | ---------------------------------------------------------------------------- | --------------------------------- | -------- |
| id009 | Import de données    | [06-ui-specs.md](docs/06-ui-specs.md) - "Importer des données" dans Settings | Message "sera disponible" affiché | Haute    |
| id010 | Export dans Settings | "Exporter toutes les données" dans Settings                                  | Non implémenté                    | Haute    |
| id011 | Purge des données    | "Vider le cache emails/formations" dans Settings                             | Non implémenté                    | Haute    |

### Important

| ID    | Fonctionnalité               | Spécification                                                                              | État                               | Priorité |
| ----- | ---------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------- | -------- |
| id012 | Filtres sur carte            | [06-ui-specs.md](docs/06-ui-specs.md#L100-L110) - Filtres année/type/statut sur page Carte | Absents                            | Moyenne  |
| id013 | Tri tableau                  | [06-ui-specs.md](docs/06-ui-specs.md#L175) - "Clic sur en-tête de colonne pour trier"      | Tri uniquement par date (hardcodé) | Moyenne  |
| id014 | Export dans liste            | UI specs montrent boutons export dans FormationsPage                                       | Export uniquement dans Dashboard   | Basse    |
| id015 | Date extraction Footer       | Footer devrait afficher "Dernière extraction"                                              | Absent du Footer                   | Basse    |
| id016 | Version dans metadata export | `ExtractionMetadata.version` défini dans types                                             | Non utilisé dans l'export JSON     | Basse    |

### Mineur

| ID    | Fonctionnalité      | Spécification                                                              | État                                   | Priorité |
| ----- | ------------------- | -------------------------------------------------------------------------- | -------------------------------------- | -------- |
| id017 | Dark mode explicite | [08-deployment.md](docs/08-deployment.md#L186) - "Classes `dark:` natives" | Non exploité (thème sombre par défaut) | Basse    |
| id018 | Recherche full-text | Brief mentionne recherche sur titre, code, lieu                            | Implémenté mais basique                | Basse    |

---

## 🟢 Suggestions d'amélioration

### Performance

| ID    | Suggestion                 | Justification                                   | Effort |
| ----- | -------------------------- | ----------------------------------------------- | ------ |
| id019 | Lazy loading des charts D3 | Réduire le bundle initial                       | Moyen  |
| id020 | Virtualisation de la liste | Améliorer les perfs avec beaucoup de formations | Moyen  |
| id021 | Service Worker / PWA       | Fonctionnement hors-ligne                       | Élevé  |

### Qualité de code

| ID    | Suggestion                | Justification                             | Effort |
| ----- | ------------------------- | ----------------------------------------- | ------ |
| id022 | Extraire `FormationModal` | Améliorer la modularité                   | Faible |
| id023 | Tests composants React    | Couverture actuelle exclut les composants | Moyen  |
| id024 | Tests E2E Playwright      | Valider les flux utilisateur complets     | Élevé  |
| id025 | Améliorer coverage export | Service export à 37.83% de couverture     | Faible |

### UX/UI

| ID    | Suggestion          | Justification                                     | Effort |
| ----- | ------------------- | ------------------------------------------------- | ------ |
| id026 | Skeleton loaders    | Meilleur feedback pendant chargement              | Faible |
| id027 | Notifications toast | Feedback utilisateur amélioré                     | Faible |
| id028 | Raccourcis clavier  | Navigation rapide (ex: Escape pour fermer modals) | Faible |

---

## ⚠️ Erreurs techniques

### Critique

| ID    | Erreur                 | Description                                                                                                            | Solution                                                                                         |
| ----- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| id029 | Dépendances manquantes | `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` absents de package.json | `bun add -d vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event` |

### Important

| ID    | Erreur                | Description                                               | Solution                                  |
| ----- | --------------------- | --------------------------------------------------------- | ----------------------------------------- |
| id030 | `generateFormationId` | Fonction utilisée dans parser mais importée depuis types  | Vérifier l'export correct                 |
| id031 | CSS z-index           | `.z-1000` utilisé dans MapView mais non standard Tailwind | Utiliser `z-[1000]` ou définir dans theme |

### Mineur

| ID    | Erreur           | Description                                 | Solution                     |
| ----- | ---------------- | ------------------------------------------- | ---------------------------- |
| id032 | Typo potentielle | `z-1000` au lieu de `z-[1000]` dans MapView | Corriger la syntaxe Tailwind |

---

## 📊 Métriques actuelles

### Couverture de tests

```
Global:        73.43% (objectif: > 70%) ✅
- hooks:       88%
- stores:      92.85%
- utils:       96.47%
- llm:         63.15%
- export:      37.83% ⚠️
- geocoding:   92.59%
```

### Composants documentés vs implémentés

| Catégorie  | Documentés | Implémentés | Écart  |
| ---------- | ---------- | ----------- | ------ |
| Layout     | 3          | 3           | ✅     |
| Dashboard  | 4          | 4           | ✅     |
| Map        | 3          | 1           | ⚠️ -2  |
| Formations | 4          | 3           | ⚠️ -1  |
| Extraction | 3          | 1           | ⚠️ -2  |
| Export     | 2          | 0           | ⚠️ -2  |
| **Total**  | **19**     | **12**      | **-7** |

---

## 📋 Plan d'action recommandé

### Sprint 1 - Corrections critiques

- [ ] `id029` Ajouter les dépendances de test manquantes
- [ ] `id009` `id010` Implémenter import/export de données dans Settings
- [ ] `id001` Ajouter le clustering Leaflet sur la carte

### Sprint 2 - Fonctionnalités manquantes

- [ ] `id012` Implémenter les filtres sur la page Carte
- [ ] `id013` Ajouter le tri par colonnes dans la liste
- [ ] `id002` Créer les adapters Google et Mapbox pour le géocodage

### Sprint 3 - Amélioration qualité

- [ ] `id006` `id022` Extraire les composants (FormationModal, ExportPanel, etc.)
- [ ] `id023` Ajouter des tests pour les composants React
- [ ] `id025` Améliorer la couverture du service export

### Sprint 4 - Documentation

- [ ] `id004` `id005` `id007` Mettre à jour la documentation d'architecture
- [ ] `id008` Synchroniser les enums de la doc avec le code
- [ ] Documenter les décisions d'implémentation divergentes

---

## 🔗 Références

- [Brief original](input/brief.md)
- [Architecture](docs/01-architecture.md)
- [Data Model](docs/02-data-model.ts)
- [UI Specs](docs/06-ui-specs.md)
- [Deployment](docs/08-deployment.md)
