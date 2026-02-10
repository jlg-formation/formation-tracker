---
name: update-docs
description: À utiliser lorsque vous devez mettre à jour la documentation
---

# Mise à jour structurée de la documentation

## Rôle

Expert en documentation pour grands projets logiciels, chargé de garantir la clarté, la cohérence et la mise à jour continue des documents du projet.

## Objectif

Mettre à jour la documentation du projet en identifiant et corrigeant les incohérences, tout en structurant l'information pour une exploitation optimale par les utilisateurs et l'IA.

## Input/Output

### Input

- Les sources d'information proviennent exclusivement du dossier `/input/`.
- Toute nouvelle information doit être ajoutée via un document de clarification dans `/input/clarifications/`.
  - Exemple de nom de fichier : `017-nouvelle-regle.md`
  - Exemple de contenu :
    ```markdown
    # Nouvelle règle de nommage

    Toute nouvelle entité doit suivre le format : [type]-[date]-[slug]
    ```

### Output

- Toute la documentation produite ou modifiée doit être placée dans le dossier `/docs/`.
  - Exemple de fichier de sortie : `/docs/01-architecture.md`

## Contraintes

- Seules les informations validées par des clarifications sont considérées comme sources officielles.
- En cas de contradiction, le document de clarification le plus récent prévaut.
- Les clarifications peuvent être rédigées par l'utilisateur ou l'IA.
- Si l'IA crée une clarification, elle doit :
  1.  Être en statut "ouverte".
  2.  Contenir un QCM avec trois choix (A, B, C) proposés par l'IA, un choix D libre, et un choix E "laisser l'IA décider".
  3.  Être fermée par l'IA après reformulation et validation des réponses de l'utilisateur.
- Les identifiants de clarification suivent le format : `<numéro>-<slug>` (ex : `018-format-date.md`).

## Critères de validation

- La documentation est à jour, sans incohérence entre les fichiers.
- Les clarifications sont correctement datées, numérotées et exploitées.
- Les exemples de fichiers, contenus et formats d'identifiants sont présents pour chaque nouveau concept.
- Les étapes de création, validation et clôture des clarifications sont respectées.
- La structure Markdown est claire, avec des chapitres, listes et exemples concrets.

## Méthode recommandée

1. Lire l'ensemble des fichiers du dossier `/input/` et `/input/clarifications/`.
2. Identifier les incohérences ou besoins de clarification.
3. Si besoin, créer une clarification selon le format imposé.
4. Mettre à jour la documentation dans `/docs/` en appliquant la règle de priorité des clarifications.
5. Vérifier la cohérence globale et la présence d'exemples concrets.

### Exemple de clarification IA

```markdown
# 019-format-export.md

## Statut : ouverte

## Questions :

- A. Exporter en CSV uniquement
- B. Exporter en JSON uniquement
- C. Exporter en CSV et JSON
- D. Autre (précisez)
- E. Laisser l'IA décider
```
