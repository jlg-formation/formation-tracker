/**
 * Prompts LLM pour la classification des emails ORSYS
 * Source: docs/03-llm-prompts.md
 */

/**
 * Prompt système pour la classification d'emails
 */
export const CLASSIFICATION_SYSTEM_PROMPT = `Tu es un assistant spécialisé dans la classification d'emails professionnels provenant d'ORSYS, un organisme de formation.

Ton rôle est d'identifier le type d'email parmi les catégories suivantes :

- "demande-intra" : Demande initiale de formation intra (ne vaut pas confirmation)
- "convocation-inter" : Confirmation d'une formation inter-entreprise (dans les locaux ORSYS)
- "convocation-intra" : Confirmation d'une formation intra-entreprise (chez le client)
- "emargements" : Suivi des émargements / signatures (preuve forte qu'une session a eu lieu)
- "accuse-reception" : Accusé de réception de documents administratifs (preuve forte qu'une session a eu lieu)
- "annulation" : Annulation d'une session de formation
- "bon-commande" : Confirmation anticipée d'une commande de formation (avant la convocation)
- "info-facturation" : Informations pour établir la facture après la formation
- "rappel" : Rappel concernant une formation à venir
- "autre" : Email non pertinent pour le suivi des formations

Important : certains emails ORSYS sont des relances ou messages administratifs. Si l'email parle de feuille d'émargement / signatures ou d'accusé de réception de documents, classer en "emargements" ou "accuse-reception" (pas en "autre").

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après.`;

/**
 * Génère le prompt utilisateur pour la classification
 * @param subject Sujet de l'email
 * @param body Corps de l'email
 */
export function buildClassificationUserPrompt(
  subject: string,
  body: string
): string {
  return `Classifie l'email suivant :

---
Sujet : ${subject}
---
${body}
---

Réponds avec ce format JSON :
{
  "type": "demande-intra|convocation-inter|convocation-intra|emargements|accuse-reception|annulation|bon-commande|info-facturation|rappel|autre",
  "confidence": 0.0 à 1.0,
  "reason": "Explication courte de la classification"
}`;
}

/**
 * Types d'emails valides pour la classification
 */
export const VALID_EMAIL_TYPES = [
  "demande-intra",
  "convocation-inter",
  "convocation-intra",
  "emargements",
  "accuse-reception",
  "annulation",
  "bon-commande",
  "info-facturation",
  "rappel",
  "autre"
] as const;

/**
 * Vérifie si un type est valide
 */
export function isValidEmailType(
  type: string
): type is (typeof VALID_EMAIL_TYPES)[number] {
  return VALID_EMAIL_TYPES.includes(type as (typeof VALID_EMAIL_TYPES)[number]);
}

// =============================================================================
// PROMPTS D'EXTRACTION
// =============================================================================

/**
 * Prompt système pour l'extraction de données
 */
export const EXTRACTION_SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'extraction de données structurées à partir d'emails ORSYS (organisme de formation professionnelle).

Extrais les informations demandées et retourne un objet JSON valide.

Règles :
- Si une information n'est pas présente dans l'email, utilise null
- Les dates doivent être au format ISO 8601 (YYYY-MM-DD)
- Les codes formation ORSYS font généralement 6 caractères (ex: GIAPA1)
- Sois précis et ne devine pas les informations manquantes

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après.`;

/**
 * Génère le prompt d'extraction pour une convocation inter
 */
export function buildExtractionPromptInter(body: string): string {
  return `Extrais les informations de cette convocation de formation inter-entreprise :

---
${body}
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
}`;
}

/**
 * Génère le prompt d'extraction pour une convocation intra
 */
export function buildExtractionPromptIntra(body: string): string {
  return `Extrais les informations de cette convocation de formation intra-entreprise :

---
${body}
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
}`;
}

/**
 * Génère le prompt d'extraction pour une annulation
 */
export function buildExtractionPromptAnnulation(body: string): string {
  return `Extrais les informations de cette annulation de formation :

---
${body}
---

Format de réponse :
{
  "codeEtendu": "Code formation (ex: IHMPA1)",
  "titre": "Intitulé de la formation",
  "dateDebut": "YYYY-MM-DD",
  "dateFin": "YYYY-MM-DD",
  "lieu": "Lieu de la formation annulée",
  "raisonAnnulation": "Raison si précisée (ex: faute de participants)"
}`;
}

/**
 * Génère le prompt d'extraction pour un bon de commande
 * Un bon de commande peut contenir plusieurs formations ("parties")
 */
export function buildExtractionPromptBonCommande(body: string): string {
  return `Extrais les informations de ce bon de commande de formation :

---
${body}
---

Règles importantes :
- Si l'email contient plusieurs "parties" (ex: "1ère partie", "2ème partie"), crée UNE formation par partie avec ses dates propres.
- Sinon, retourne une seule formation.
- Retourne TOUJOURS un tableau (même pour une seule formation).

Format de réponse :
{
  "formations": [
    {
      "titre": "Intitulé complet de la formation",
      "codeEtendu": "Code formation",
      "referenceIntra": "Numéro de référence intra",
      "referenceCommande": "Référence de commande",
      "client": "Nom de l'entreprise",
      "dateDebut": "YYYY-MM-DD",
      "dateFin": "YYYY-MM-DD",
      "dates": ["YYYY-MM-DD", ...],
      "nombreJours": nombre,
      "nombreHeures": nombre (si précisé),
      "partieNumero": numéro de la partie (1, 2, 3...),
      "lieu": {
        "nom": "Description du lieu",
        "adresse": "Adresse si précisée"
      },
      "nombreParticipants": nombre,
      "niveauPersonnalisation": "standard|spécifique|ultra-spécifique",
      "entiteFacturation": "Entité à facturer (ORSYS, ORSYS INSTITUT, etc.)"
    }
  ]
}`;
}

/**
 * Génère le prompt d'extraction pour info facturation
 */
export function buildExtractionPromptFacturation(body: string): string {
  return `Extrais les informations de facturation de cet email :

---
${body}
---

Format de réponse :
{
  "codeEtendu": "Code formation",
  "titre": "Intitulé de la formation",
  "dateDebut": "YYYY-MM-DD",
  "dateFin": "YYYY-MM-DD",
  "nombreJours": nombre,
  "entiteFacturation": "Entité du groupe ORSYS à facturer"
}`;
}
