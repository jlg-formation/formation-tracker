# TODO — Audit ORSYS Training Tracker

Audit “Spécifs/Docs vs Code” (inputs: `input/*`, docs: `docs/*`, code: `project/*`).

## Critique

### Incohérences

- [ ] id001 (Stats) Les KPI + graphiques du Dashboard doivent être calculés **hors formations annulées** (les annulées comptées séparément), mais le calcul actuel inclut les annulées dans `total`, `parAnnee`, `parCode`, `inter/intra`, `totalParticipants`.
  - Source: `docs/06-ui-specs.md` (règle annulations Dashboard), `input/clarifications/004-annulation.md`
  - Code: `project/src/utils/stats.ts` (fonction `calculateStats`), `project/src/components/dashboard/StatsCards.tsx`, `project/src/components/dashboard/YearlyChart.tsx`, `project/src/components/dashboard/TopCoursesChart.tsx`, `project/src/components/dashboard/TypePieChart.tsx`
  - Action: refactorer `calculateStats()` pour ne compter que `StatutFormation.CONFIRMEE` dans les totaux/graphes, garder `annulees` séparé, puis adapter les composants.

- [ ] id002 (Export JSON) `metadata.totalFormations` doit représenter le nombre de formations **hors** statut `annulée` (les annulées dans `metadata.formationsAnnulees`), mais l’export actuel met `totalFormations = formations.length`.
  - Source: `docs/07-export.md`
  - Code: `project/src/services/export/json.ts` (fonction `generateExportMetadata`)
  - Action: calculer `totalFormations = formations.length - annulees` et ajouter/mettre à jour les tests associés dans `project/src/services/export/export.test.ts`.

### Fonctionnalités manquantes

- [x] id003 (Carte/GPS) La **correction manuelle des coordonnées GPS** “un clic pour positionner l’endroit exact” n’est pas implémentée.
  - Source: `docs/05-geocoding.md`, `docs/01-architecture.md` (correction GPS), `docs/06-ui-specs.md` ("Correction GPS"), `input/clarifications/005-gps.md`
  - Code: `project/src/components/map/MapView.tsx`, `project/src/components/pages/MapPage.tsx`, `project/src/components/pages/FormationDetailPage.tsx`, `project/src/stores/formationsStore.ts`
  - Action: ajouter un mode “corriger GPS” (sélection formation → clic carte → `updateFormation(id, { lieu: { ...lieu, gps }})`) + persister dans IndexedDB.

- [ ] id004 (Cohérence données) Le contrôle de **recouvrement de dates** (deux formations ne peuvent pas se chevaucher) et l’affichage dans une section **ERREURS** des Paramètres ne sont pas présents.
  - Source: `docs/01-architecture.md` (contrôles de cohérence), `docs/06-ui-specs.md` (section Paramètres), `input/clarifications/003-recouvrement-de-date.md`
  - Code: `project/src/components/pages/SettingsPage.tsx` (pas de section), aucun util dédié trouvé dans `project/src/utils/*`
  - Action: créer un util (ex: `project/src/utils/coherence.ts`) pour détecter les overlaps sur `dates[]` ou `[dateDebut,dateFin]`, puis afficher une liste des conflits dans `SettingsPage`.

## Important

### Fonctionnalités manquantes

- [ ] id005 (Carte) La page Carte est spécifiée avec des **filtres** (Année/Type/Statut) + bouton Réinitialiser + option “Voir toutes →” dans la popup. L’implémentation actuelle n’a ni filtres ni CTA “Voir toutes”.
  - Source: `docs/06-ui-specs.md`
  - Code: `project/src/components/pages/MapPage.tsx`, `project/src/components/map/MapView.tsx`
  - Action: ajouter des filtres (state + UI) et filtrer `formations` avant rendu; dans la popup, ajouter un lien/bouton “Voir toutes” qui navigue vers `/formations` avec filtres pré-remplis (ou au minimum vers la liste).

- [ ] id006 (Liste) La page Liste doit proposer les boutons **Export JSON/CSV/PDF** en bas. Actuellement, les exports sont présents sur le Dashboard uniquement.
  - Source: `input/brief.md` (Export), `docs/06-ui-specs.md` (Liste → boutons export)
  - Code: `project/src/components/formations/FormationList.tsx`, `project/src/components/dashboard/Dashboard.tsx`
  - Action: déplacer ou dupliquer les boutons d’export dans la page Liste (en réutilisant `services/export/*`).

- [ ] id007 (Liste) Les filtres attendus incluent au moins Code et Lieu (spec: multi-filtres), et la présentation est spécifiée en **table triable** + pagination. L’implémentation actuelle est une grille de cartes avec filtres partiels (année/type/statut + recherche).
  - Source: `docs/06-ui-specs.md`
  - Code: `project/src/components/formations/Filters.tsx`, `project/src/components/formations/FormationList.tsx`
  - Action: compléter les filtres (code/lieu) et aligner la UI (table + tri) ou mettre à jour la doc si le choix “cards” est assumé.

### Incohérences

- [ ] id008 (Footer) Le footer est spécifié avec “Dernière extraction : …” + version. Le footer actuel n’affiche pas la date de dernière extraction.
  - Source: `docs/06-ui-specs.md`
  - Code: `project/src/components/layout/Footer.tsx`
  - Action: stocker et afficher une date “dernière extraction” (ex: via IndexedDB/settings ou via un enregistrement metadata), puis l’afficher dans le footer.

- [ ] id009 (Dashboard) Les 4 KPI attendus sont: Formations (hors annulées), Annulées, Jours total (hors annulées), Participants (hors annulées). L’UI actuelle affiche “Taux de réussite” au lieu de “Annulées” et la valeur “Formations” inclut les annulées.
  - Source: `docs/06-ui-specs.md`
  - Code: `project/src/components/dashboard/StatsCards.tsx`, `project/src/utils/stats.ts`
  - Action: modifier `StatsCards` pour afficher le KPI “Annulées” et prendre les valeurs hors annulées.

### Erreurs techniques

- [ ] id010 (Export JSON) `exportToJson(formations?)` accepte un tableau optionnel, mais exporte toujours `emails/geocache/llmCache` depuis la DB et calcule `metadata` depuis la DB: incohérent si on exporte un sous-ensemble de formations.
  - Source: `docs/07-export.md` (export des données)
  - Code: `project/src/services/export/json.ts`, `project/src/components/dashboard/Dashboard.tsx`, `project/src/components/pages/SettingsPage.tsx`
  - Action: clarifier l’intention (export “backup complet” vs export “formations uniquement”) et harmoniser la signature + métadonnées + noms de fichiers.

- [ ] id011 (Export CSV) L’export CSV ne contient pas certains champs attendus côté facturation (ex: `referenceCommande`).
  - Source: `input/brief.md` (référence commande), `docs/07-export.md`
  - Code: `project/src/services/export/csv.ts`
  - Action: ajouter les colonnes manquantes (ex: `Reference Commande`) + tests d’export.

## Mineur

### Incohérences

- [ ] id012 (Langue UI) La spec demande une UI en français uniquement, mais certains libellés restent en anglais (“Dashboard”).
  - Source: `input/brief.md`, `docs/06-ui-specs.md`
  - Code: `project/src/components/pages/DashboardPage.tsx`
  - Action: renommer en “Tableau de bord” dans les titres/labels.

- [ ] id013 (Carte) Le contrôle “📍 Ma position” est mentionné dans la spec, mais n’est pas implémenté.
  - Source: `docs/06-ui-specs.md`
  - Code: `project/src/components/map/MapView.tsx`
  - Action: ajouter un bouton qui centre la carte sur la géolocalisation navigateur (avec gestion d’erreurs).

### Suggestions d’amélioration

- [ ] id014 (UX/Perf) Éviter de recalculer/filtrer intégralement côté client pour de gros volumes: exploiter davantage les indexes Dexie (`formations: dateDebut/statut/typeSession`) via `formationsStore.getFormations(filters)`.
  - Code: `project/src/components/formations/FormationList.tsx`, `project/src/hooks/useFormations.ts`, `project/src/stores/formationsStore.ts`
  - Action: faire passer les filtres “liste” par le store (requêtes IndexedDB) au lieu du filtrage en mémoire.

- [ ] id015 (Tests) Après correction de `calculateStats`, ajouter/ajuster les tests pour garantir l’exclusion des annulées dans les KPI/graphes.
  - Code: `project/src/utils/stats.test.ts`
