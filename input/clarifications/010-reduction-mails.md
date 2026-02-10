# Filtrage des emails à la source

## Contexte

Trop d'emails sont extraits depuis Gmail, générant des appels LLM excessifs et coûteux.

## Solution

Filtrer les emails **avant récupération** via expressions régulières sur le sujet.

## Règles de filtrage

Exclure les emails dont le sujet contient :

| Pattern exact                | Raison                   |
| ---------------------------- | ------------------------ |
| `Planning ORSYS Réactualisé` | Email informatif inutile |
| `Demande Intra `             | Demande non engageante   |

## Comportement attendu

- Les emails filtrés ne doivent **jamais** être récupérés depuis Gmail.
- Aucun stockage : ni cache, ni IndexedDB, ni mémoire applicative.

Le filtre doit avoir lieu des la recherche de mails. Jamais ensuite.
