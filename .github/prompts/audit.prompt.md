---
agent: agent
---

## Audit du projet ORSYS Training Tracker

### Sources à analyser

1. **Spécifications** : Lire `/input/brief.md` et les exemples d'emails dans `/input/emails-samples/`
2. **Documentation technique** : Parcourir tous les fichiers dans `/docs/` (architecture, data-model, API, etc.)
3. **Code réalisé** : Examiner `/project/` pour comparer l'implémentation actuelle

### Objectif

Comparer les spécifications et la documentation avec le code implémenté pour identifier :

- 🔴 **Incohérences** : Écarts entre la doc et l'implémentation
- 🟡 **Fonctionnalités manquantes** : Spécifiées mais non développées
- 🟢 **Suggestions d'amélioration** : Optimisations ou ajouts pertinents
- ⚠️ **Erreurs techniques** : Violations des conventions ou bugs potentiels

### Livrable

Créer `/TODO.md` avec les items catégorisés et priorisés (critique, important, mineur).
