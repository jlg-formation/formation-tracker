/**
 * Service de parsing d'emails via LLM (OpenAI GPT-4o)
 * Étape 8 : Classification des emails
 */

import { TypeEmail } from "../../types";
import { getSettings } from "../../stores/settingsStore";
import {
  DEFAULT_OPENAI_CONFIG,
  OPENAI_API_BASE_URL,
  MIN_CONFIDENCE_THRESHOLD
} from "./config";
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  buildClassificationUserPrompt,
  isValidEmailType
} from "./prompts";
import type {
  ClassificationResult,
  EmailInput,
  OpenAIChatResponse,
  OpenAIConfig
} from "./types";
import { createLLMError } from "./types";

/**
 * Appelle l'API OpenAI Chat Completions
 * @param systemPrompt Prompt système
 * @param userPrompt Prompt utilisateur
 * @param config Configuration OpenAI
 * @returns La réponse texte du modèle
 */
async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  config: OpenAIConfig
): Promise<string> {
  const response = await fetch(`${OPENAI_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw createLLMError(
      `Erreur API OpenAI (${response.status}): ${errorBody}`,
      "API_ERROR"
    );
  }

  const data: OpenAIChatResponse = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw createLLMError("Réponse OpenAI vide", "API_ERROR");
  }

  return data.choices[0].message.content;
}

/**
 * Parse la réponse JSON de classification
 * @param jsonString Chaîne JSON retournée par le LLM
 * @returns Résultat de classification validé
 */
function parseClassificationResponse(jsonString: string): ClassificationResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw createLLMError(
      `Réponse JSON invalide: ${jsonString}`,
      "PARSE_ERROR",
      error
    );
  }

  // Validation de la structure
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("type" in parsed) ||
    !("confidence" in parsed) ||
    !("reason" in parsed)
  ) {
    throw createLLMError(
      `Structure de réponse invalide: ${jsonString}`,
      "PARSE_ERROR"
    );
  }

  const { type, confidence, reason } = parsed as Record<string, unknown>;

  // Validation du type
  if (typeof type !== "string" || !isValidEmailType(type)) {
    throw createLLMError(`Type d'email invalide: ${type}`, "PARSE_ERROR");
  }

  // Validation de la confiance
  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
    throw createLLMError(
      `Niveau de confiance invalide: ${confidence}`,
      "PARSE_ERROR"
    );
  }

  // Validation de la raison
  if (typeof reason !== "string") {
    throw createLLMError(`Raison invalide: ${reason}`, "PARSE_ERROR");
  }

  return {
    type: type as TypeEmail,
    confidence,
    reason
  };
}

/**
 * Classifie un email en utilisant le LLM
 * @param email Email à classifier
 * @param apiKey Clé API OpenAI (optionnel, utilise les settings si non fourni)
 * @returns Résultat de la classification
 */
export async function classifyEmail(
  email: EmailInput,
  apiKey?: string
): Promise<ClassificationResult> {
  // Récupérer la clé API si non fournie
  let key = apiKey;
  if (!key) {
    const settings = await getSettings();
    key = settings.openaiApiKey;
  }

  if (!key) {
    throw createLLMError(
      "Clé API OpenAI non configurée. Allez dans Paramètres pour la configurer.",
      "CONFIG_ERROR"
    );
  }

  const config: OpenAIConfig = {
    ...DEFAULT_OPENAI_CONFIG,
    apiKey: key
  };

  // Construire les prompts
  const userPrompt = buildClassificationUserPrompt(email.subject, email.body);

  // Appeler l'API
  const responseText = await callOpenAI(
    CLASSIFICATION_SYSTEM_PROMPT,
    userPrompt,
    config
  );

  // Parser la réponse
  const result = parseClassificationResponse(responseText);

  // Appliquer le seuil de confiance
  if (result.confidence < MIN_CONFIDENCE_THRESHOLD) {
    console.warn(
      `Classification avec confiance faible (${result.confidence}): ${email.id} - ${result.type}`
    );
    return {
      type: TypeEmail.AUTRE,
      confidence: result.confidence,
      reason: `Confiance insuffisante (${result.confidence.toFixed(2)} < ${MIN_CONFIDENCE_THRESHOLD}). Type suggéré: ${result.type}. ${result.reason}`
    };
  }

  return result;
}

/**
 * Classifie plusieurs emails en batch
 * @param emails Liste d'emails à classifier
 * @param apiKey Clé API OpenAI (optionnel)
 * @param onProgress Callback de progression
 * @returns Map des résultats de classification par ID d'email
 */
export async function classifyEmailBatch(
  emails: EmailInput[],
  apiKey?: string,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>();

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];

    try {
      const result = await classifyEmail(email, apiKey);
      results.set(email.id, result);
    } catch (error) {
      // Logger l'erreur mais continuer avec les autres emails
      console.error(`Erreur classification email ${email.id}:`, error);
      results.set(email.id, {
        type: TypeEmail.AUTRE,
        confidence: 0,
        reason: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }

    onProgress?.(i + 1, emails.length);
  }

  return results;
}
