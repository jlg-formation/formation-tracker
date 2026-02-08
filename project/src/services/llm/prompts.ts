/**
 * Prompts LLM pour la classification des emails ORSYS
 * Source: docs/03-llm-prompts.md
 */

/**
 * Prompt système pour la classification d'emails
 */
export const CLASSIFICATION_SYSTEM_PROMPT = `Tu es un assistant spécialisé dans la classification d'emails professionnels provenant d'ORSYS, un organisme de formation.

Ton rôle est d'identifier le type d'email parmi les catégories suivantes :

- "convocation-inter" : Confirmation d'une formation inter-entreprise (dans les locaux ORSYS)
- "convocation-intra" : Confirmation d'une formation intra-entreprise (chez le client)
- "annulation" : Annulation d'une session de formation
- "bon-commande" : Confirmation anticipée d'une commande de formation (avant la convocation)
- "info-facturation" : Informations pour établir la facture après la formation
- "rappel" : Rappel concernant une formation à venir
- "autre" : Email non pertinent pour le suivi des formations

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
  "type": "convocation-inter|convocation-intra|annulation|bon-commande|info-facturation|rappel|autre",
  "confidence": 0.0 à 1.0,
  "reason": "Explication courte de la classification"
}`;
}

/**
 * Types d'emails valides pour la classification
 */
export const VALID_EMAIL_TYPES = [
  "convocation-inter",
  "convocation-intra",
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
