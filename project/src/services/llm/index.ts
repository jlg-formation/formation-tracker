/**
 * Service LLM - Classification et extraction d'emails via OpenAI
 */

// Types
export type {
  ClassificationResult,
  EmailInput,
  OpenAIConfig,
  LLMError,
  LLMErrorCode,
  ExtractionResult,
  ExtractionResultRaw,
  ExtractionResultInter,
  ExtractionResultIntra,
  ExtractionResultAnnulation,
  ExtractionResultBonCommande,
  ExtractionResultFacturation
} from "./types";
export { createLLMError, isLLMError } from "./types";

// Types de cache et analyse
export type {
  AnalyzeEmailResult,
  AnalysisAbortSignal,
  AnalysisProgressCallback,
  OnEmailProcessedCallback
} from "./parser";

// Fonctions de classification
export { classifyEmail, classifyEmailBatch } from "./parser";

// Fonctions d'extraction
export { extractFormation, extractFormationBatch } from "./parser";

// Fonctions avec cache
export {
  classifyEmailWithCache,
  extractFormationWithCache,
  analyzeEmailWithCache,
  analyzeEmailBatchWithCache
} from "./parser";

// Prompts (pour les tests)
export {
  CLASSIFICATION_SYSTEM_PROMPT,
  buildClassificationUserPrompt,
  isValidEmailType,
  VALID_EMAIL_TYPES,
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionPromptInter,
  buildExtractionPromptIntra,
  buildExtractionPromptAnnulation,
  buildExtractionPromptBonCommande,
  buildExtractionPromptFacturation
} from "./prompts";

// Configuration
export { DEFAULT_OPENAI_CONFIG, MIN_CONFIDENCE_THRESHOLD } from "./config";
