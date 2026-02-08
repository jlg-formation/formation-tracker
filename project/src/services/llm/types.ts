/**
 * Types pour le service LLM
 */

import type { TypeEmail } from "../../types";

/**
 * Résultat de la classification d'un email
 */
export interface ClassificationResult {
  /** Type d'email identifié */
  type: TypeEmail;
  /** Niveau de confiance (0.0 à 1.0) */
  confidence: number;
  /** Explication de la classification */
  reason: string;
}

/**
 * Configuration pour l'API OpenAI
 */
export interface OpenAIConfig {
  /** Clé API OpenAI */
  apiKey: string;
  /** Modèle à utiliser */
  model: string;
  /** Température (0.0 à 2.0) */
  temperature: number;
  /** Nombre maximum de tokens en sortie */
  maxTokens: number;
}

/**
 * Paramètres d'un email pour la classification/extraction
 */
export interface EmailInput {
  /** ID unique de l'email */
  id: string;
  /** Sujet de l'email */
  subject: string;
  /** Corps de l'email (texte brut) */
  body: string;
}

/**
 * Réponse brute de l'API OpenAI pour le chat
 */
export interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Type de code d'erreur LLM
 */
export type LLMErrorCode = "API_ERROR" | "PARSE_ERROR" | "CONFIG_ERROR";

/**
 * Erreur LLM personnalisée
 */
export interface LLMError {
  name: "LLMError";
  message: string;
  code: LLMErrorCode;
  cause?: unknown;
}

/**
 * Crée une erreur LLM
 */
export function createLLMError(
  message: string,
  code: LLMErrorCode,
  cause?: unknown
): LLMError & Error {
  const error = new Error(message) as LLMError & Error;
  error.name = "LLMError";
  error.code = code;
  error.cause = cause;
  return error;
}

/**
 * Vérifie si une erreur est une LLMError
 */
export function isLLMError(error: unknown): error is LLMError {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "LLMError" &&
    "code" in error
  );
}

// =============================================================================
// EXTRACTION
// =============================================================================

import type { Formation } from "../../types";

/**
 * Résultat brut de l'extraction d'une convocation inter
 */
export interface ExtractionResultInter {
  titre: string | null;
  codeEtendu: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  dates: string[] | null;
  nombreJours: number | null;
  lieu: { nom: string; adresse: string } | null;
  nombreParticipants: number | null;
  participants: Array<{ nom: string; email: string }> | null;
  motDePasseDocadmin: string | null;
  motDePasseParticipants: string | null;
}

/**
 * Résultat brut de l'extraction d'une convocation intra
 */
export interface ExtractionResultIntra {
  titre: string | null;
  codeEtendu: string | null;
  referenceIntra: string | null;
  client: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  dates: string[] | null;
  nombreJours: number | null;
  lieu: { nom: string; adresse: string; salle?: string } | null;
  nombreParticipants: number | null;
  niveauPersonnalisation: string | null;
  motDePasseDocadmin: string | null;
  motDePasseParticipants: string | null;
  contactEntreprise: { nom?: string; telephone?: string } | null;
}

/**
 * Résultat brut de l'extraction d'une annulation
 */
export interface ExtractionResultAnnulation {
  codeEtendu: string | null;
  titre: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  lieu: string | null;
  raisonAnnulation: string | null;
}

/**
 * Résultat brut de l'extraction d'un bon de commande
 */
export interface ExtractionResultBonCommande {
  titre: string | null;
  codeEtendu: string | null;
  referenceIntra: string | null;
  referenceCommande: string | null;
  client: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  nombreJours: number | null;
  nombreHeures: number | null;
  lieu: { nom: string; adresse?: string } | null;
  nombreParticipants: number | null;
  niveauPersonnalisation: string | null;
  entiteFacturation: string | null;
}

/**
 * Résultat brut de l'extraction d'info facturation
 */
export interface ExtractionResultFacturation {
  codeEtendu: string | null;
  titre: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  nombreJours: number | null;
  entiteFacturation: string | null;
}

/**
 * Union de tous les résultats d'extraction
 */
export type ExtractionResultRaw =
  | ExtractionResultInter
  | ExtractionResultIntra
  | ExtractionResultAnnulation
  | ExtractionResultBonCommande
  | ExtractionResultFacturation;

/**
 * Résultat structuré de l'extraction
 */
export interface ExtractionResult {
  /** Formation extraite (partielle) */
  formation: Partial<Formation>;
  /** Champs extraits avec succès */
  fieldsExtracted: string[];
  /** Champs manquants */
  fieldsMissing: string[];
  /** Avertissements */
  warnings: string[];
}
