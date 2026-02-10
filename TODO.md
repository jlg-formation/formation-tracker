# TODO — Audit ORSYS Training Tracker

Audit “Spécifs/Docs vs Code” (inputs: `input/*`, docs: `docs/*`, code: `project/*`).

## Critique

### Incohérences

- [x] id001 (Stats) Les KPI + graphiques du Dashboard doivent être calculés **hors formations annulées** (les annulées comptées séparément) — c’est conforme dans le calcul.
  - Source: `docs/06-ui-specs.md` (règle annulations Dashboard), `input/clarifications/004-annulation.md`
  - Code: `project/src/utils/stats.ts` (fonction `calculateStats`: `StatutFormation.ANNULEE` est exclu de `total/parAnnee/parCode/inter/intra/participants`)
  - Action: aucune (garder les tests à jour si refactor ultérieur).

- [ ] id016 (Géocodage) Il est interdit de géocoder une formation **annulée**, mais la page Carte propose un géocodage en masse sans exclure le statut `annulée`.
  - Source: `input/clarifications/006-geocoding-statut.md`, `docs/05-geocoding.md`, `docs/01-architecture.md`
  - Code: `project/src/components/pages/MapPage.tsx` (calcul `formationsWithoutGPS` + boucle `handleGeocodeFormations`), `project/src/services/geocoding/index.ts` (`geocodeAddress`)
  - Action: filtrer `formationsWithoutGPS` pour exclure `statut === "annulée"` (et empêcher toute mise à jour GPS sur une formation annulée), + ajouter un test unitaire ciblé (ex: MapPage logic / util) ou test d'intégration léger.

- [ ] id017 (Vues) Les formations **futures** ne doivent pas être affichées par défaut (Dashboard/Carte/Liste), mais les vues chargent actuellement toutes les formations sans filtre de date.
  - Source: `input/clarifications/004-annulation.md`, `docs/01-architecture.md`, `docs/06-ui-specs.md`
  - Code: `project/src/hooks/useFormations.ts` (charge tout), `project/src/components/dashboard/Dashboard.tsx`, `project/src/components/pages/MapPage.tsx`, `project/src/components/formations/FormationList.tsx`
  - Action: appliquer un filtrage par défaut “passées uniquement” (comparaison sur `dateDebut` vs aujourd’hui) sur Dashboard/Liste/Carte, et prévoir une option explicite (au moins sur la Carte via filtre Période) pour ré-inclure les futures.

- [ ] id002 (Export JSON) `metadata.totalFormations` doit représenter le nombre de formations **hors** statut `annulée` (les annulées dans `metadata.formationsAnnulees`), mais l’export actuel met `totalFormations = formations.length`.
  - Source: `docs/07-export.md`
  - Code: `project/src/services/export/json.ts` (fonction `generateExportMetadata`)
  - Action: calculer `totalFormations = formations.length - annulees` et ajouter/mettre à jour les tests associés dans `project/src/services/export/export.test.ts`.

### Fonctionnalités manquantes

- [x] id003 (Carte/GPS) La **correction manuelle des coordonnées GPS** (mode “corriger la position”, clic sur la carte, validation) est implémentée.
  - Source: `docs/05-geocoding.md`, `docs/01-architecture.md` (correction GPS), `docs/06-ui-specs.md` ("Correction GPS"), `input/clarifications/005-gps.md`
  - Code: `project/src/components/pages/FormationDetailPage.tsx` (mode correction + clic carte + validation), `project/src/stores/formationsStore.ts` (`updateFormation`)
  - Action: aucune.

- [ ] id004 (Cohérence données) Le contrôle de **recouvrement de dates** (deux formations ne peuvent pas se chevaucher) et l’affichage dans une section **ERREURS** des Paramètres ne sont pas présents.
  - Source: `docs/01-architecture.md` (contrôles de cohérence), `docs/06-ui-specs.md` (section Paramètres), `input/clarifications/003-recouvrement-de-date.md`
  - Code: `project/src/components/pages/SettingsPage.tsx` (pas de section), aucun util dédié trouvé dans `project/src/utils/*`
  - Action: créer un util (ex: `project/src/utils/coherence.ts`) pour détecter les overlaps sur `dates[]` ou `[dateDebut,dateFin]`, puis afficher une liste des conflits dans `SettingsPage`.

## Important

### Fonctionnalités manquantes

- [ ] id005 (Carte) La page Carte est spécifiée avec des **filtres** (Période: passées/futures/les deux + Année/Type/Statut) + bouton Réinitialiser + option “Voir toutes →” dans la popup. L’implémentation actuelle n’a pas ces filtres ni le CTA “Voir toutes”, et la vue n’est pas “passées par défaut”.
  - Source: `docs/06-ui-specs.md`, `input/clarifications/006-geocoding-statut.md`, `input/clarifications/004-annulation.md`
  - Code: `project/src/components/pages/MapPage.tsx`, `project/src/components/map/MapView.tsx`
  - Action: ajouter l’UI des filtres + state (dont Période par défaut = passées), filtrer `formations` avant rendu, et ajouter un CTA “Voir toutes →” (navigation vers `/formations` avec filtres pré-remplis si possible).

### Incohérences

- [ ] id018 (Carte) La couleur des pins doit refléter la période (vert = futures, bleu = passées), mais les icônes/legend actuelles reflètent surtout le type (inter/intra) et ne distinguent pas passé/futur.
  - Source: `input/clarifications/006-geocoding-statut.md`, `docs/06-ui-specs.md`
  - Code: `project/src/components/map/MapView.tsx` (choix `interIcon/intraIcon` + légende), `project/src/index.css` (styles Leaflet/cluster)
  - Action: introduire des icônes (ou classes CSS) “passée/future” et mettre à jour la légende pour correspondre à la spec; conserver l’info inter/intra dans la popup si besoin.

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

- [ ] id009 (Dashboard) Les 4 KPI attendus sont: Formations (hors annulées), Annulées, Jours total (hors annulées), Participants (hors annulées). L’UI actuelle affiche “Taux de réussite” au lieu de “Annulées” et des sous-labels/calculs sont incohérents avec le fait que `stats.total` est déjà hors annulées.
  - Source: `docs/06-ui-specs.md`
  - Code: `project/src/components/dashboard/StatsCards.tsx`, `project/src/utils/stats.ts`
  - Action: modifier `StatsCards` pour afficher le KPI “Annulées” (et non “Taux de réussite”). Corriger les calculs/sous-labels qui supposent que `stats.total` inclut les annulées (ex: taux et “sessions réalisées”).

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

- [x] id015 (Tests) Les tests couvrent déjà l’exclusion des annulées dans les KPI/graphes.
  - Code: `project/src/utils/stats.test.ts` (tests `calculateStats` sur `StatutFormation.ANNULEE`)
