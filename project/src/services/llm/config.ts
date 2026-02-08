/**
 * Configuration pour l'API OpenAI
 */

import type { OpenAIConfig } from "./types";

/**
 * Configuration par défaut pour l'API OpenAI
 */
export const DEFAULT_OPENAI_CONFIG: Omit<OpenAIConfig, "apiKey"> = {
  model: "gpt-4o-mini",
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
