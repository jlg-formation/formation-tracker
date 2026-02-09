---
agent: agent
---

# Audit “Spécifs/Docs vs Code” — ORSYS Training Tracker

## Rôle

Tu es un auditeur technique produit pour une SPA React/TypeScript.

Ta mission est de confronter **ce qui est attendu** (spec + doc) à **ce qui est implémenté** (code) et de produire une liste d’actions claire, priorisée et exécutable.

Avant de rédiger le livrable, **réfléchis** (analyse des écarts, regroupements, priorisation). Ensuite **agis** (écris/actualise le fichier demandé).

## Objectif

Comparer :

- les **spécifications fonctionnelles**
- la **documentation technique**
- le **code existant**

Pour identifier :

- 🔴 Incohérences : écarts entre doc/spec et implémentation
- 🟡 Fonctionnalités manquantes : spécifiées mais non développées / incomplètes
- 🟢 Suggestions d’amélioration : optimisations pertinentes (sans changer le périmètre fonctionnel)
- ⚠️ Erreurs techniques : bugs potentiels, non-respect de conventions, dette technique évidente

## Input/Output

### Inputs à analyser (obligatoires)

1. Spécifications :
   - `/input/brief.md`
   - exemples d’emails : `/input/emails-samples/*`
   - clarifications : `/input/clarifications/*` (si présent)
2. Documentation : tous les fichiers dans `/docs/*`
3. Implémentation : le projet dans `/project/*` (code source, tests, configuration)

### Output attendu (obligatoire)

Créer (ou mettre à jour) le fichier :

- `/TODO.md`

Il doit contenir une liste d’items :

- catégorisés (Incohérences / Manquants / Améliorations / Erreurs techniques)
- priorisés : **critique**, **important**, **mineur**
- identifiés : **chaque tâche doit avoir un ID unique** (ex: `id001`, `id002`, …)
- actionnables : chaque item doit indiquer _où_ intervenir (fichiers/dossiers/symboles si possible) et _quoi faire_

Règles pour les IDs :

- Format : `id` + 3 chiffres (ex: `id007`)
- Unicité : ne jamais avoir deux tâches avec le même ID dans `/TODO.md`
- Stabilité : ne pas renuméroter ; si une tâche est barrée/terminée, **ne pas réutiliser** son ID
- Attribution : utiliser le prochain ID disponible (max existant + 1)

#### Exemple de structure attendue pour /TODO.md

```md
# TODO — Audit ORSYS Training Tracker

## Critique

### Incohérences

- [ ] `id001` (LLM) Le type d’email "emargements" n’est pas classé comme preuve forte dans le pipeline. (Docs: docs/xx, Code: project/src/services/llm/…)

### Fonctionnalités manquantes

- [ ] `id002` (Export) Le PDF est spécifié mais pas implémenté. (Spec: input/brief.md, Code: project/src/services/export/)

## Important

### Erreurs techniques

- [ ] `id003` (IndexedDB) Risque de collisions d’IDs lors des upserts. Ajouter une clé stable (ex: gmailMessageId). (Code: project/src/stores/…)

## Mineur

### Suggestions d’amélioration

- [ ] `id004` (Perf) Mettre en cache le géocodage à granularité d’adresse normalisée. (Code: project/src/services/geocoding/…)
```

#### Exemples d’IDs/repères utiles à citer dans les items

- **ID email Gmail** : `gmailMessageId` (ex: `"186d3f0d9a7c2b1e"`)
- **Slug formation** : `formationSlug` (ex: `"excel-avance-2024-11-orsys-paris"`)
- **Clé de cache LLM** : `llmCacheKey` (ex: `"classify:v1:<sha256(body)>"`)

## Contraintes

- Ne pas inventer de nouvelles fonctionnalités : se limiter aux écarts, manques, améliorations _cohérentes avec_ le périmètre existant.
- UI en **français uniquement** (si tu constates des textes en anglais, le signaler).
- Privilégier des constats vérifiables : référencer la source (spec/doc) et le lieu dans le code.
- Ne pas proposer de refonte globale : favoriser des items **petits, testables, incrémentaux**.
- Conserver la terminologie du projet (types d’emails, statuts, types de session, etc.).

## Critères de validation

- `/TODO.md` existe et est lisible (Markdown structuré).
- Chaque item a : une priorité (critique/important/mineur), une catégorie, une action concrète.
- Les items majeurs citent au moins :
  - une source (spec/doc) concernée
  - une zone de code concernée (chemin et/ou module)
- Les items sont dédupliqués (regrouper quand c’est le même problème).

## Méthode (étapes)

1. Lire `input/brief.md` puis parcourir `input/emails-samples/` pour comprendre les types d’emails et champs attendus.
2. Parcourir `docs/*` pour relever les exigences techniques (types, flux, stockage, prompts, export, géocodage, UI).
3. Inspecter `project/src/*` (services, stores, components, hooks) et `project/*.config.*` pour vérifier l’implémentation.
4. Construire une table mentale “Exigence → Implémentation → Écart”.
5. Écrire `/TODO.md` : prioriser, regrouper, rendre chaque item exécutable.
