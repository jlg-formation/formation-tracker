# 03 - Prompts LLM

## Vue d'ensemble

Le parsing des emails ORSYS se fait en **deux étapes** via l'API OpenAI (GPT-4o) :

1. **Classification** : Identifier le type d'email
2. **Extraction** : Extraire les données structurées selon le type

---

## Étape 1 : Classification

### Prompt système

```
Tu es un assistant spécialisé dans la classification d'emails professionnels provenant d'ORSYS, un organisme de formation.

Ton rôle est d'identifier le type d'email parmi les catégories suivantes :

- "convocation-inter" : Confirmation d'une formation inter-entreprise (dans les locaux ORSYS)
- "convocation-intra" : Confirmation d'une formation intra-entreprise (chez le client)
- "annulation" : Annulation d'une session de formation
- "bon-commande" : Confirmation anticipée d'une commande de formation (avant la convocation)
- "info-facturation" : Informations pour établir la facture après la formation
- "rappel" : Rappel concernant une formation à venir
- "autre" : Email non pertinent pour le suivi des formations

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après.
```

### Prompt utilisateur

```
Classifie l'email suivant :

---
Sujet : {subject}
---
{body}
---

Réponds avec ce format JSON :
{
  "type": "convocation-inter|convocation-intra|annulation|bon-commande|info-facturation|rappel|autre",
  "confidence": 0.0 à 1.0,
  "reason": "Explication courte de la classification"
}
```

### Exemples de réponses attendues

**Email de convocation inter :**

```json
{
  "type": "convocation-inter",
  "confidence": 0.95,
  "reason": "Contient 'animation inter', liste de participants, lieu ORSYS La Défense"
}
```

**Email d'annulation :**

```json
{
  "type": "annulation",
  "confidence": 0.98,
  "reason": "Contient 'SESSION ANNULEE' et 'faute de participants'"
}
```

---

## Étape 2 : Extraction

### Prompt système (commun)

```
Tu es un assistant spécialisé dans l'extraction de données structurées à partir d'emails ORSYS (organisme de formation professionnelle).

Extrais les informations demandées et retourne un objet JSON valide.

Règles :
- Si une information n'est pas présente dans l'email, utilise null
- Les dates doivent être au format ISO 8601 (YYYY-MM-DD)
- Les codes formation ORSYS font généralement 6 caractères (ex: GIAPA1)
- Sois précis et ne devine pas les informations manquantes

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après.
```

### Prompt extraction : Convocation Inter

```
Extrais les informations de cette convocation de formation inter-entreprise :

---
{body}
---

Format de réponse :
{
  "titre": "Intitulé complet de la formation",
  "codeEtendu": "Code 6 caractères (ex: GIAPA1)",
  "dateDebut": "YYYY-MM-DD",
  "dateFin": "YYYY-MM-DD",
  "dates": ["YYYY-MM-DD", ...],
  "nombreJours": nombre,
  "lieu": {
    "nom": "Nom du centre",
    "adresse": "Adresse complète"
  },
  "nombreParticipants": nombre,
  "participants": [
    {"nom": "NOM Prénom", "email": "email@example.com"}
  ],
  "motDePasseDocadmin": "mot de passe formateur",
  "motDePasseParticipants": "mot de passe participants"
}
```

### Prompt extraction : Convocation Intra

```
Extrais les informations de cette convocation de formation intra-entreprise :

---
{body}
---

Format de réponse :
{
  "titre": "Intitulé complet de la formation",
  "codeEtendu": "Code formation (ex: XXXZZ3)",
  "referenceIntra": "Numéro de référence intra (ex: 79757)",
  "client": "Nom de l'entreprise cliente",
  "dateDebut": "YYYY-MM-DD (première date)",
  "dateFin": "YYYY-MM-DD (dernière date)",
  "dates": ["YYYY-MM-DD", ...],
  "nombreJours": nombre,
  "lieu": {
    "nom": "Nom du lieu",
    "adresse": "Adresse complète",
    "salle": "Nom/numéro de salle si précisé"
  },
  "nombreParticipants": nombre,
  "niveauPersonnalisation": "standard|spécifique|ultra-spécifique",
  "motDePasseDocadmin": "mot de passe formateur",
  "motDePasseParticipants": "mot de passe participants",
  "contactEntreprise": {
    "nom": "Nom du contact si présent",
    "telephone": "Téléphone si présent"
  }
}
```

### Prompt extraction : Annulation

```
Extrais les informations de cette annulation de formation :

---
{body}
---

Format de réponse :
{
  "codeEtendu": "Code formation (ex: IHMPA1)",
  "titre": "Intitulé de la formation",
  "dateDebut": "YYYY-MM-DD",
  "dateFin": "YYYY-MM-DD",
  "lieu": "Lieu de la formation annulée",
  "raisonAnnulation": "Raison si précisée (ex: faute de participants)"
}
```

### Prompt extraction : Bon de commande

```
Extrais les informations de ce bon de commande de formation :

---
{body}
---

Format de réponse :
{
  "titre": "Intitulé complet de la formation",
  "codeEtendu": "Code formation",
  "referenceIntra": "Numéro de référence intra",
  "referenceCommande": "Référence de commande",
  "client": "Nom de l'entreprise",
  "dateDebut": "YYYY-MM-DD",
  "dateFin": "YYYY-MM-DD",
  "nombreJours": nombre,
  "nombreHeures": nombre (si précisé),
  "lieu": {
    "nom": "Description du lieu",
    "adresse": "Adresse si précisée"
  },
  "nombreParticipants": nombre,
  "niveauPersonnalisation": "standard|spécifique|ultra-spécifique",
  "facturation": {
    "entite": "Entité à facturer (ORSYS, ORSYS INSTITUT, etc.)",
    "tarifAnimation": nombre (HT),
    "plafondFrais": nombre (TTC)
  }
}
```

### Prompt extraction : Info facturation

```
Extrais les informations de facturation de cet email :

---
{body}
---

Format de réponse :
{
  "codeEtendu": "Code formation",
  "titre": "Intitulé de la formation",
  "dateDebut": "YYYY-MM-DD",
  "dateFin": "YYYY-MM-DD",
  "nombreJours": nombre,
  "entiteFacturation": "Entité du groupe ORSYS à facturer"
}
```

---

## Configuration API OpenAI

```typescript
const OPENAI_CONFIG = {
  model: "gpt-4o",
  temperature: 0.1, // Faible pour extraction précise
  max_tokens: 2000,
  response_format: { type: "json_object" }
};
```

---

## Gestion des erreurs

### Réponse invalide

Si le LLM ne retourne pas un JSON valide :

1. Logger l'erreur avec l'email ID
2. Marquer l'email comme `processed: false`
3. Permettre un retry manuel

### Confiance faible

Si `confidence < 0.7` sur la classification :

1. Logger un warning
2. Classer comme `autre` par sécurité
3. Permettre une revue manuelle ultérieure

---

## Optimisation des coûts

### Tokens estimés par email

| Étape          | Input | Output | Total     |
| -------------- | ----- | ------ | --------- |
| Classification | ~500  | ~50    | ~550      |
| Extraction     | ~800  | ~300   | ~1100     |
| **Total**      | ~1300 | ~350   | **~1650** |

### Coût estimé (GPT-4o, février 2026)

- Input : $2.50 / 1M tokens
- Output : $10.00 / 1M tokens

Pour 1000 emails :

- Input : 1.3M tokens × $2.50 = $3.25
- Output : 350K tokens × $10 = $3.50
- **Total ≈ $7 pour 1000 emails**

### Stratégies d'optimisation

1. **Cache** : Ne pas retraiter les emails déjà traités
2. **Batch** : Possibilité de regrouper plusieurs emails (si API le supporte)
3. **Pré-filtrage** : Ignorer les emails clairement non pertinents avant LLM
