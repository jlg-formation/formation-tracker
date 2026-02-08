/**
 * Configuration pour l'API OpenAI
 */

import type { OpenAIConfig } from "./types";

/**
 * Configuration par défaut pour l'API OpenAI
 */
export const DEFAULT_OPENAI_CONFIG: Omit<OpenAIConfig, "apiKey"> = {
  model: "gpt-5-nano",
  temperature: 0.1, // Faible pour extraction précise
  maxTokens: 2000
};

/**
 * URL de base de l'API OpenAI
 */
export const OPENAI_API_BASE_URL = "https://api.openai.com/v1";

/**
 * Seuil de confiance minimum pour accepter une classification
 * En dessous, l'email sera classé comme "autre"
 */
export const MIN_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Configuration du retry automatique pour les erreurs rate limit (429)
 */
export const RATE_LIMIT_RETRY_CONFIG = {
  /** Nombre maximum de tentatives */
  maxRetries: 3,
  /** Délai de base en ms (sera multiplié par 2^attempt) */
  baseDelayMs: 2000,
  /** Délai maximum en ms */
  maxDelayMs: 30000
};

/**
 * Délai par défaut entre les appels LLM (en ms)
 * Peut être configuré par l'utilisateur dans les paramètres
 */
export const DEFAULT_LLM_DELAY_MS = 3000;
