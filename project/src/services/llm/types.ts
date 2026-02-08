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
