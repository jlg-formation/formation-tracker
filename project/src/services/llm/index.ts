/**
 * Service LLM - Classification et extraction d'emails via OpenAI
 */

// Types
export type {
  ClassificationResult,
  EmailInput,
  OpenAIConfig,
  LLMError,
  LLMErrorCode
} from "./types";
export { createLLMError, isLLMError } from "./types";

// Fonctions de classification
export { classifyEmail, classifyEmailBatch } from "./parser";

// Prompts (pour les tests)
export {
  CLASSIFICATION_SYSTEM_PROMPT,
  buildClassificationUserPrompt,
  isValidEmailType,
  VALID_EMAIL_TYPES
} from "./prompts";

// Configuration
export { DEFAULT_OPENAI_CONFIG, MIN_CONFIDENCE_THRESHOLD } from "./config";
