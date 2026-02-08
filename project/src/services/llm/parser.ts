/**
 * Service de parsing d'emails via LLM (OpenAI GPT-4o)
 * Étape 8 : Classification des emails
 * Étape 9 : Extraction des formations
 */

import {
  TypeEmail,
  TypeSession,
  StatutFormation,
  NiveauPersonnalisation,
  generateFormationId
} from "../../types";
import type { Formation } from "../../types";
import { getSettings } from "../../stores/settingsStore";
import {
  getLLMCacheEntry,
  cacheClassification,
  cacheExtraction,
  cacheLLMResult
} from "../../stores/llmCacheStore";
import {
  DEFAULT_OPENAI_CONFIG,
  OPENAI_API_BASE_URL,
  MIN_CONFIDENCE_THRESHOLD,
  RATE_LIMIT_RETRY_CONFIG
} from "./config";
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  buildClassificationUserPrompt,
  isValidEmailType,
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionPromptInter,
  buildExtractionPromptIntra,
  buildExtractionPromptAnnulation,
  buildExtractionPromptBonCommande,
  buildExtractionPromptFacturation
} from "./prompts";
import type {
  ClassificationResult,
  EmailInput,
  OpenAIChatResponse,
  OpenAIConfig,
  ExtractionResult,
  ExtractionResultInter,
  ExtractionResultIntra,
  ExtractionResultAnnulation,
  ExtractionResultBonCommande,
  ExtractionResultFacturation
} from "./types";
import { createLLMError, type LLMErrorCode } from "./types";

/**
 * Interface pour les erreurs OpenAI
 */
interface OpenAIErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

/**
 * Parse une erreur OpenAI et retourne le code d'erreur approprié
 */
function parseOpenAIError(
  httpStatus: number,
  errorBody: string
): {
  code: LLMErrorCode;
  userMessage: string;
  retryAfter?: number;
  openAIError?: string;
} {
  let parsed: OpenAIErrorResponse | null = null;

  try {
    parsed = JSON.parse(errorBody);
  } catch {
    // Non-JSON, on continue avec le texte brut
  }

  const openAICode = parsed?.error?.code || parsed?.error?.type || "";
  const openAIMessage = parsed?.error?.message || errorBody;

  // Erreur de quota/facturation (plus d'argent)
  if (
    openAICode === "insufficient_quota" ||
    openAICode === "billing_hard_limit_reached" ||
    openAIMessage.includes("exceeded your current quota") ||
    openAIMessage.includes("billing")
  ) {
    return {
      code: "INSUFFICIENT_QUOTA",
      userMessage:
        "💳 Crédit OpenAI épuisé. Rechargez votre compte sur platform.openai.com.",
      openAIError: openAICode
    };
  }

  // Rate limit (quota par minute/heure/jour)
  if (httpStatus === 429 || openAICode === "rate_limit_exceeded") {
    // Essayer d'extraire le temps d'attente du message
    const retryMatch = openAIMessage.match(
      /try again in (\d+(?:\.\d+)?)(ms|s|m|h)?/i
    );
    let retryAfter: number | undefined;
    if (retryMatch) {
      const value = parseFloat(retryMatch[1]);
      const unit = retryMatch[2]?.toLowerCase() || "s";
      switch (unit) {
        case "ms":
          retryAfter = Math.ceil(value / 1000);
          break;
        case "s":
          retryAfter = Math.ceil(value);
          break;
        case "m":
          retryAfter = Math.ceil(value * 60);
          break;
        case "h":
          retryAfter = Math.ceil(value * 3600);
          break;
        default:
          retryAfter = Math.ceil(value);
      }
    }

    let userMessage = "⏱️ Limite de requêtes dépassée.";
    if (retryAfter) {
      if (retryAfter < 60) {
        userMessage += ` Réessayez dans ${retryAfter} secondes.`;
      } else if (retryAfter < 3600) {
        userMessage += ` Réessayez dans ${Math.ceil(retryAfter / 60)} minutes.`;
      } else {
        userMessage += ` Réessayez dans ${Math.ceil(retryAfter / 3600)} heures.`;
      }
    } else {
      userMessage += " Attendez quelques secondes avant de reprendre.";
    }

    return {
      code: "RATE_LIMIT",
      userMessage,
      retryAfter,
      openAIError: openAICode
    };
  }

  // Clé API invalide
  if (httpStatus === 401 || openAICode === "invalid_api_key") {
    return {
      code: "INVALID_API_KEY",
      userMessage:
        "🔑 Clé API OpenAI invalide. Vérifiez votre clé dans les Paramètres.",
      openAIError: openAICode
    };
  }

  // Erreur serveur OpenAI
  if (httpStatus >= 500) {
    return {
      code: "SERVER_ERROR",
      userMessage:
        "🔧 Serveur OpenAI temporairement indisponible. Réessayez dans quelques minutes.",
      openAIError: openAICode
    };
  }

  // Erreur générique
  return {
    code: "API_ERROR",
    userMessage: `❌ Erreur API OpenAI (${httpStatus}): ${openAIMessage.substring(0, 100)}`,
    openAIError: openAICode
  };
}

/**
 * Attend un certain temps (pour le rate limiting)
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Appelle l'API OpenAI Chat Completions avec retry automatique sur erreur 429
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
  let lastError: Error | null = null;

  for (
    let attempt = 0;
    attempt <= RATE_LIMIT_RETRY_CONFIG.maxRetries;
    attempt++
  ) {
    try {
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
        const errorInfo = parseOpenAIError(response.status, errorBody);

        // Si c'est une erreur rate limit et qu'on peut retry
        if (
          errorInfo.code === "RATE_LIMIT" &&
          attempt < RATE_LIMIT_RETRY_CONFIG.maxRetries
        ) {
          // Calculer le délai avec backoff exponentiel
          const baseDelay = errorInfo.retryAfter
            ? errorInfo.retryAfter * 1000
            : RATE_LIMIT_RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
          const delayMs = Math.min(
            baseDelay,
            RATE_LIMIT_RETRY_CONFIG.maxDelayMs
          );

          console.warn(
            `Rate limit atteint (tentative ${attempt + 1}/${RATE_LIMIT_RETRY_CONFIG.maxRetries + 1}). ` +
              `Attente de ${Math.round(delayMs / 1000)}s avant retry...`
          );

          await sleep(delayMs);
          continue; // Retry
        }

        throw createLLMError(
          `Erreur API OpenAI (${response.status}): ${errorBody}`,
          errorInfo.code,
          {
            userMessage: errorInfo.userMessage,
            details: {
              httpStatus: response.status,
              retryAfter: errorInfo.retryAfter,
              openAIError: errorInfo.openAIError
            }
          }
        );
      }

      const data: OpenAIChatResponse = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw createLLMError("Réponse OpenAI vide", "API_ERROR");
      }

      return data.choices[0].message.content;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Si l'erreur n'est pas une LLMError rate limit, on ne retry pas
      if (
        !(
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "RATE_LIMIT"
        )
      ) {
        throw error;
      }
    }
  }

  // Si on arrive ici, tous les retries ont échoué
  throw (
    lastError ||
    createLLMError("Échec après plusieurs tentatives", "RATE_LIMIT")
  );
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
  // Récupérer les settings
  const settings = await getSettings();

  // Récupérer la clé API si non fournie
  const key = apiKey || settings.openaiApiKey;

  if (!key) {
    throw createLLMError(
      "Clé API OpenAI non configurée. Allez dans Paramètres pour la configurer.",
      "CONFIG_ERROR"
    );
  }

  const config: OpenAIConfig = {
    ...DEFAULT_OPENAI_CONFIG,
    apiKey: key,
    model: settings.openaiModel || DEFAULT_OPENAI_CONFIG.model
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

// =============================================================================
// EXTRACTION
// =============================================================================

/**
 * Sélectionne le prompt d'extraction selon le type d'email
 */
function getExtractionPrompt(type: TypeEmail, body: string): string | null {
  switch (type) {
    case TypeEmail.CONVOCATION_INTER:
      return buildExtractionPromptInter(body);
    case TypeEmail.CONVOCATION_INTRA:
      return buildExtractionPromptIntra(body);
    case TypeEmail.ANNULATION:
      return buildExtractionPromptAnnulation(body);
    case TypeEmail.BON_COMMANDE:
      return buildExtractionPromptBonCommande(body);
    case TypeEmail.INFO_FACTURATION:
      return buildExtractionPromptFacturation(body);
    case TypeEmail.RAPPEL:
    case TypeEmail.AUTRE:
    default:
      return null;
  }
}

/**
 * Convertit le résultat d'extraction inter en Formation partielle
 */
function convertInterToFormation(
  raw: ExtractionResultInter,
  emailId: string
): ExtractionResult {
  const fieldsExtracted: string[] = [];
  const fieldsMissing: string[] = [];
  const warnings: string[] = [];
  const now = new Date().toISOString();

  const formation: Partial<Formation> = {
    typeSession: TypeSession.INTER,
    statut: StatutFormation.CONFIRMEE,
    niveauPersonnalisation: NiveauPersonnalisation.STANDARD,
    emailIds: [emailId],
    createdAt: now,
    updatedAt: now
  };

  // Titre
  if (raw.titre) {
    formation.titre = raw.titre;
    fieldsExtracted.push("titre");
  } else {
    fieldsMissing.push("titre");
  }

  // Code étendu
  if (raw.codeEtendu) {
    formation.codeEtendu = raw.codeEtendu;
    fieldsExtracted.push("codeEtendu");
  } else {
    fieldsMissing.push("codeEtendu");
  }

  // Dates
  if (raw.dateDebut) {
    formation.dateDebut = raw.dateDebut;
    fieldsExtracted.push("dateDebut");
  } else {
    fieldsMissing.push("dateDebut");
  }

  if (raw.dateFin) {
    formation.dateFin = raw.dateFin;
    fieldsExtracted.push("dateFin");
  } else {
    fieldsMissing.push("dateFin");
  }

  if (raw.dates && raw.dates.length > 0) {
    formation.dates = raw.dates;
    fieldsExtracted.push("dates");
  } else {
    fieldsMissing.push("dates");
  }

  if (raw.nombreJours) {
    formation.nombreJours = raw.nombreJours;
    fieldsExtracted.push("nombreJours");
  } else {
    fieldsMissing.push("nombreJours");
  }

  // Lieu
  if (raw.lieu) {
    formation.lieu = {
      nom: raw.lieu.nom || "",
      adresse: raw.lieu.adresse || "",
      gps: null
    };
    fieldsExtracted.push("lieu");
  } else {
    fieldsMissing.push("lieu");
  }

  // Participants
  if (raw.nombreParticipants) {
    formation.nombreParticipants = raw.nombreParticipants;
    fieldsExtracted.push("nombreParticipants");
  } else {
    formation.nombreParticipants = 0;
    fieldsMissing.push("nombreParticipants");
  }

  if (raw.participants && raw.participants.length > 0) {
    formation.participants = raw.participants.map((p) => ({
      nom: p.nom || "",
      email: p.email || ""
    }));
    fieldsExtracted.push("participants");
  } else {
    formation.participants = [];
    fieldsMissing.push("participants");
  }

  // Mots de passe
  if (raw.motDePasseDocadmin) {
    formation.motDePasseDocadmin = raw.motDePasseDocadmin;
    fieldsExtracted.push("motDePasseDocadmin");
  }

  if (raw.motDePasseParticipants) {
    formation.motDePasseParticipants = raw.motDePasseParticipants;
    fieldsExtracted.push("motDePasseParticipants");
  }

  // Générer l'ID
  if (formation.codeEtendu && formation.dateDebut) {
    formation.id = generateFormationId(
      formation.codeEtendu,
      formation.dateDebut
    );
  }

  return { formation, fieldsExtracted, fieldsMissing, warnings };
}

/**
 * Convertit le résultat d'extraction intra en Formation partielle
 */
function convertIntraToFormation(
  raw: ExtractionResultIntra,
  emailId: string
): ExtractionResult {
  const fieldsExtracted: string[] = [];
  const fieldsMissing: string[] = [];
  const warnings: string[] = [];
  const now = new Date().toISOString();

  const formation: Partial<Formation> = {
    typeSession: TypeSession.INTRA,
    statut: StatutFormation.CONFIRMEE,
    emailIds: [emailId],
    createdAt: now,
    updatedAt: now
  };

  // Titre
  if (raw.titre) {
    formation.titre = raw.titre;
    fieldsExtracted.push("titre");
  } else {
    fieldsMissing.push("titre");
  }

  // Code étendu
  if (raw.codeEtendu) {
    formation.codeEtendu = raw.codeEtendu;
    fieldsExtracted.push("codeEtendu");
  } else {
    fieldsMissing.push("codeEtendu");
  }

  // Référence intra
  if (raw.referenceIntra) {
    formation.facturation = {
      entite: "ORSYS",
      referenceIntra: raw.referenceIntra
    };
    fieldsExtracted.push("referenceIntra");
  }

  // Client
  if (raw.client) {
    formation.client = raw.client;
    fieldsExtracted.push("client");
  }

  // Dates
  if (raw.dateDebut) {
    formation.dateDebut = raw.dateDebut;
    fieldsExtracted.push("dateDebut");
  } else {
    fieldsMissing.push("dateDebut");
  }

  if (raw.dateFin) {
    formation.dateFin = raw.dateFin;
    fieldsExtracted.push("dateFin");
  } else {
    fieldsMissing.push("dateFin");
  }

  if (raw.dates && raw.dates.length > 0) {
    formation.dates = raw.dates;
    fieldsExtracted.push("dates");
  } else {
    fieldsMissing.push("dates");
  }

  if (raw.nombreJours) {
    formation.nombreJours = raw.nombreJours;
    fieldsExtracted.push("nombreJours");
  } else {
    fieldsMissing.push("nombreJours");
  }

  // Lieu
  if (raw.lieu) {
    formation.lieu = {
      nom: raw.lieu.nom || "",
      adresse: raw.lieu.adresse || "",
      gps: null,
      salle: raw.lieu.salle
    };
    fieldsExtracted.push("lieu");
  } else {
    fieldsMissing.push("lieu");
  }

  // Participants
  if (raw.nombreParticipants) {
    formation.nombreParticipants = raw.nombreParticipants;
    fieldsExtracted.push("nombreParticipants");
  } else {
    formation.nombreParticipants = 0;
    fieldsMissing.push("nombreParticipants");
  }

  formation.participants = [];

  // Niveau personnalisation
  if (raw.niveauPersonnalisation) {
    const niveau = raw.niveauPersonnalisation.toLowerCase();
    if (niveau.includes("ultra")) {
      formation.niveauPersonnalisation =
        NiveauPersonnalisation.ULTRA_SPECIFIQUE;
    } else if (niveau.includes("spécifique") || niveau.includes("specifique")) {
      formation.niveauPersonnalisation = NiveauPersonnalisation.SPECIFIQUE;
    } else {
      formation.niveauPersonnalisation = NiveauPersonnalisation.STANDARD;
    }
    fieldsExtracted.push("niveauPersonnalisation");
  } else {
    formation.niveauPersonnalisation = NiveauPersonnalisation.STANDARD;
  }

  // Contact entreprise
  if (
    raw.contactEntreprise &&
    (raw.contactEntreprise.nom || raw.contactEntreprise.telephone)
  ) {
    formation.contactEntreprise = {
      nom: raw.contactEntreprise.nom,
      telephone: raw.contactEntreprise.telephone
    };
    fieldsExtracted.push("contactEntreprise");
  }

  // Mots de passe
  if (raw.motDePasseDocadmin) {
    formation.motDePasseDocadmin = raw.motDePasseDocadmin;
    fieldsExtracted.push("motDePasseDocadmin");
  }

  if (raw.motDePasseParticipants) {
    formation.motDePasseParticipants = raw.motDePasseParticipants;
    fieldsExtracted.push("motDePasseParticipants");
  }

  // Générer l'ID
  if (formation.codeEtendu && formation.dateDebut) {
    formation.id = generateFormationId(
      formation.codeEtendu,
      formation.dateDebut
    );
  }

  return { formation, fieldsExtracted, fieldsMissing, warnings };
}

/**
 * Convertit le résultat d'extraction annulation en Formation partielle
 */
function convertAnnulationToFormation(
  raw: ExtractionResultAnnulation,
  emailId: string
): ExtractionResult {
  const fieldsExtracted: string[] = [];
  const fieldsMissing: string[] = [];
  const warnings: string[] = [];
  const now = new Date().toISOString();

  const formation: Partial<Formation> = {
    statut: StatutFormation.ANNULEE,
    emailIds: [emailId],
    createdAt: now,
    updatedAt: now,
    participants: [],
    nombreParticipants: 0
  };

  // Titre
  if (raw.titre) {
    formation.titre = raw.titre;
    fieldsExtracted.push("titre");
  } else {
    fieldsMissing.push("titre");
  }

  // Code étendu
  if (raw.codeEtendu) {
    formation.codeEtendu = raw.codeEtendu;
    fieldsExtracted.push("codeEtendu");
  } else {
    fieldsMissing.push("codeEtendu");
  }

  // Dates
  if (raw.dateDebut) {
    formation.dateDebut = raw.dateDebut;
    fieldsExtracted.push("dateDebut");
  } else {
    fieldsMissing.push("dateDebut");
  }

  if (raw.dateFin) {
    formation.dateFin = raw.dateFin;
    fieldsExtracted.push("dateFin");
  } else {
    fieldsMissing.push("dateFin");
  }

  formation.dates =
    raw.dateDebut && raw.dateFin ? [raw.dateDebut, raw.dateFin] : [];

  // Lieu
  if (raw.lieu) {
    formation.lieu = {
      nom: raw.lieu,
      adresse: raw.lieu,
      gps: null
    };
    fieldsExtracted.push("lieu");
  } else {
    fieldsMissing.push("lieu");
  }

  // Raison annulation (stockée dans un warning)
  if (raw.raisonAnnulation) {
    warnings.push(`Raison annulation: ${raw.raisonAnnulation}`);
    fieldsExtracted.push("raisonAnnulation");
  }

  // Générer l'ID
  if (formation.codeEtendu && formation.dateDebut) {
    formation.id = generateFormationId(
      formation.codeEtendu,
      formation.dateDebut
    );
  }

  return { formation, fieldsExtracted, fieldsMissing, warnings };
}

/**
 * Convertit le résultat d'extraction bon de commande en Formation partielle
 */
function convertBonCommandeToFormation(
  raw: ExtractionResultBonCommande,
  emailId: string
): ExtractionResult {
  const fieldsExtracted: string[] = [];
  const fieldsMissing: string[] = [];
  const warnings: string[] = [];
  const now = new Date().toISOString();

  const formation: Partial<Formation> = {
    typeSession: TypeSession.INTRA,
    statut: StatutFormation.CONFIRMEE,
    emailIds: [emailId],
    createdAt: now,
    updatedAt: now,
    participants: []
  };

  // Titre
  if (raw.titre) {
    formation.titre = raw.titre;
    fieldsExtracted.push("titre");
  } else {
    fieldsMissing.push("titre");
  }

  // Code étendu
  if (raw.codeEtendu) {
    formation.codeEtendu = raw.codeEtendu;
    fieldsExtracted.push("codeEtendu");
  } else {
    fieldsMissing.push("codeEtendu");
  }

  // Références et facturation
  if (raw.referenceIntra || raw.referenceCommande || raw.entiteFacturation) {
    formation.facturation = {
      entite: raw.entiteFacturation || "ORSYS",
      referenceIntra: raw.referenceIntra || undefined,
      referenceCommande: raw.referenceCommande || undefined
    };
    if (raw.referenceIntra) fieldsExtracted.push("referenceIntra");
    if (raw.referenceCommande) fieldsExtracted.push("referenceCommande");
    if (raw.entiteFacturation) fieldsExtracted.push("entiteFacturation");
  }

  // Client
  if (raw.client) {
    formation.client = raw.client;
    fieldsExtracted.push("client");
  }

  // Dates
  if (raw.dateDebut) {
    formation.dateDebut = raw.dateDebut;
    fieldsExtracted.push("dateDebut");
  } else {
    fieldsMissing.push("dateDebut");
  }

  if (raw.dateFin) {
    formation.dateFin = raw.dateFin;
    fieldsExtracted.push("dateFin");
  } else {
    fieldsMissing.push("dateFin");
  }

  formation.dates =
    raw.dateDebut && raw.dateFin ? [raw.dateDebut, raw.dateFin] : [];

  if (raw.nombreJours) {
    formation.nombreJours = raw.nombreJours;
    fieldsExtracted.push("nombreJours");
  } else {
    fieldsMissing.push("nombreJours");
  }

  if (raw.nombreHeures) {
    formation.nombreHeures = raw.nombreHeures;
    fieldsExtracted.push("nombreHeures");
  }

  // Lieu
  if (raw.lieu) {
    formation.lieu = {
      nom: raw.lieu.nom || "",
      adresse: raw.lieu.adresse || "",
      gps: null
    };
    fieldsExtracted.push("lieu");
  }

  // Participants
  if (raw.nombreParticipants) {
    formation.nombreParticipants = raw.nombreParticipants;
    fieldsExtracted.push("nombreParticipants");
  } else {
    formation.nombreParticipants = 0;
  }

  // Niveau personnalisation
  if (raw.niveauPersonnalisation) {
    const niveau = raw.niveauPersonnalisation.toLowerCase();
    if (niveau.includes("ultra")) {
      formation.niveauPersonnalisation =
        NiveauPersonnalisation.ULTRA_SPECIFIQUE;
    } else if (niveau.includes("spécifique") || niveau.includes("specifique")) {
      formation.niveauPersonnalisation = NiveauPersonnalisation.SPECIFIQUE;
    } else {
      formation.niveauPersonnalisation = NiveauPersonnalisation.STANDARD;
    }
    fieldsExtracted.push("niveauPersonnalisation");
  } else {
    formation.niveauPersonnalisation = NiveauPersonnalisation.STANDARD;
  }

  // Générer l'ID
  if (formation.codeEtendu && formation.dateDebut) {
    formation.id = generateFormationId(
      formation.codeEtendu,
      formation.dateDebut
    );
  }

  return { formation, fieldsExtracted, fieldsMissing, warnings };
}

/**
 * Convertit le résultat d'extraction facturation en Formation partielle
 */
function convertFacturationToFormation(
  raw: ExtractionResultFacturation,
  emailId: string
): ExtractionResult {
  const fieldsExtracted: string[] = [];
  const fieldsMissing: string[] = [];
  const warnings: string[] = [];
  const now = new Date().toISOString();

  const formation: Partial<Formation> = {
    emailIds: [emailId],
    createdAt: now,
    updatedAt: now,
    participants: [],
    nombreParticipants: 0
  };

  // Titre
  if (raw.titre) {
    formation.titre = raw.titre;
    fieldsExtracted.push("titre");
  } else {
    fieldsMissing.push("titre");
  }

  // Code étendu
  if (raw.codeEtendu) {
    formation.codeEtendu = raw.codeEtendu;
    fieldsExtracted.push("codeEtendu");
  } else {
    fieldsMissing.push("codeEtendu");
  }

  // Dates
  if (raw.dateDebut) {
    formation.dateDebut = raw.dateDebut;
    fieldsExtracted.push("dateDebut");
  } else {
    fieldsMissing.push("dateDebut");
  }

  if (raw.dateFin) {
    formation.dateFin = raw.dateFin;
    fieldsExtracted.push("dateFin");
  } else {
    fieldsMissing.push("dateFin");
  }

  formation.dates =
    raw.dateDebut && raw.dateFin ? [raw.dateDebut, raw.dateFin] : [];

  if (raw.nombreJours) {
    formation.nombreJours = raw.nombreJours;
    fieldsExtracted.push("nombreJours");
  } else {
    fieldsMissing.push("nombreJours");
  }

  // Entité facturation
  if (raw.entiteFacturation) {
    formation.facturation = {
      entite: raw.entiteFacturation
    };
    fieldsExtracted.push("entiteFacturation");
  }

  // Générer l'ID
  if (formation.codeEtendu && formation.dateDebut) {
    formation.id = generateFormationId(
      formation.codeEtendu,
      formation.dateDebut
    );
  }

  return { formation, fieldsExtracted, fieldsMissing, warnings };
}

/**
 * Extrait les données de formation d'un email
 * @param email Email à traiter
 * @param type Type d'email (classification préalable)
 * @param apiKey Clé API OpenAI (optionnel)
 * @returns Résultat de l'extraction avec formation partielle
 */
export async function extractFormation(
  email: EmailInput,
  type: TypeEmail,
  apiKey?: string
): Promise<ExtractionResult> {
  // Vérifier si le type est extractible
  const userPrompt = getExtractionPrompt(type, email.body);
  if (!userPrompt) {
    return {
      formation: {},
      fieldsExtracted: [],
      fieldsMissing: [],
      warnings: [`Type d'email non extractible: ${type}`]
    };
  }

  // Récupérer les settings
  const settings = await getSettings();

  // Récupérer la clé API si non fournie
  const key = apiKey || settings.openaiApiKey;

  if (!key) {
    throw createLLMError(
      "Clé API OpenAI non configurée. Allez dans Paramètres pour la configurer.",
      "CONFIG_ERROR"
    );
  }

  const config: OpenAIConfig = {
    ...DEFAULT_OPENAI_CONFIG,
    apiKey: key,
    model: settings.openaiModel || DEFAULT_OPENAI_CONFIG.model
  };

  // Appeler l'API
  const responseText = await callOpenAI(
    EXTRACTION_SYSTEM_PROMPT,
    userPrompt,
    config
  );

  // Parser la réponse JSON
  let rawResult: unknown;
  try {
    rawResult = JSON.parse(responseText);
  } catch (error) {
    throw createLLMError(
      `Réponse JSON invalide: ${responseText}`,
      "PARSE_ERROR",
      error
    );
  }

  // Convertir selon le type
  switch (type) {
    case TypeEmail.CONVOCATION_INTER:
      return convertInterToFormation(
        rawResult as ExtractionResultInter,
        email.id
      );
    case TypeEmail.CONVOCATION_INTRA:
      return convertIntraToFormation(
        rawResult as ExtractionResultIntra,
        email.id
      );
    case TypeEmail.ANNULATION:
      return convertAnnulationToFormation(
        rawResult as ExtractionResultAnnulation,
        email.id
      );
    case TypeEmail.BON_COMMANDE:
      return convertBonCommandeToFormation(
        rawResult as ExtractionResultBonCommande,
        email.id
      );
    case TypeEmail.INFO_FACTURATION:
      return convertFacturationToFormation(
        rawResult as ExtractionResultFacturation,
        email.id
      );
    default:
      return {
        formation: {},
        fieldsExtracted: [],
        fieldsMissing: [],
        warnings: [`Type d'email non supporté: ${type}`]
      };
  }
}

/**
 * Extrait les formations de plusieurs emails en batch
 * @param emails Liste d'emails avec leur classification
 * @param apiKey Clé API OpenAI (optionnel)
 * @param onProgress Callback de progression
 * @returns Map des résultats d'extraction par ID d'email
 */
export async function extractFormationBatch(
  emails: Array<{ email: EmailInput; type: TypeEmail }>,
  apiKey?: string,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, ExtractionResult>> {
  const results = new Map<string, ExtractionResult>();

  for (let i = 0; i < emails.length; i++) {
    const { email, type } = emails[i];

    try {
      const result = await extractFormation(email, type, apiKey);
      results.set(email.id, result);
    } catch (error) {
      console.error(`Erreur extraction email ${email.id}:`, error);
      results.set(email.id, {
        formation: {},
        fieldsExtracted: [],
        fieldsMissing: [],
        warnings: [error instanceof Error ? error.message : "Erreur inconnue"]
      });
    }

    onProgress?.(i + 1, emails.length);
  }

  return results;
}

// =============================================================================
// FONCTIONS AVEC CACHE
// =============================================================================

/**
 * Classifie un email en utilisant le cache si disponible
 * @param email Email à classifier
 * @param apiKey Clé API OpenAI (optionnel)
 * @param useCache Utiliser le cache (true par défaut)
 * @returns Résultat de la classification et indicateur si cache utilisé
 */
export async function classifyEmailWithCache(
  email: EmailInput,
  apiKey?: string,
  useCache: boolean = true
): Promise<{ result: ClassificationResult; fromCache: boolean }> {
  // Vérifier le cache d'abord
  if (useCache) {
    const cached = await getLLMCacheEntry(email.id);
    if (cached?.classification) {
      return { result: cached.classification, fromCache: true };
    }
  }

  // Pas en cache, appeler le LLM
  const result = await classifyEmail(email, apiKey);

  // Sauvegarder dans le cache
  await cacheClassification(email.id, result);

  return { result, fromCache: false };
}

/**
 * Extrait les données de formation d'un email en utilisant le cache si disponible
 * @param email Email à traiter
 * @param type Type d'email (classification préalable)
 * @param apiKey Clé API OpenAI (optionnel)
 * @param useCache Utiliser le cache (true par défaut)
 * @returns Résultat de l'extraction et indicateur si cache utilisé
 */
export async function extractFormationWithCache(
  email: EmailInput,
  type: TypeEmail,
  apiKey?: string,
  useCache: boolean = true
): Promise<{ result: ExtractionResult; fromCache: boolean }> {
  // Vérifier le cache d'abord
  if (useCache) {
    const cached = await getLLMCacheEntry(email.id);
    if (cached?.extraction) {
      return { result: cached.extraction, fromCache: true };
    }
  }

  // Pas en cache, appeler le LLM
  const result = await extractFormation(email, type, apiKey);

  // Sauvegarder dans le cache
  await cacheExtraction(email.id, result);

  return { result, fromCache: false };
}

/**
 * Résultat de l'analyse complète d'un email (classification + extraction)
 */
export interface AnalyzeEmailResult {
  classification: ClassificationResult;
  extraction: ExtractionResult | null;
  fromCache: {
    classification: boolean;
    extraction: boolean;
  };
  /** Message d'erreur si l'analyse a échoué (email ne doit pas être marqué comme traité) */
  error?: string;
}

/**
 * Analyse complète d'un email avec cache (classification + extraction)
 * @param email Email à analyser
 * @param apiKey Clé API OpenAI (optionnel)
 * @param useCache Utiliser le cache (true par défaut)
 * @param delayBetweenCalls Délai en ms entre les appels LLM (pour respecter rate limits)
 * @returns Résultat complet de l'analyse
 */
export async function analyzeEmailWithCache(
  email: EmailInput,
  apiKey?: string,
  useCache: boolean = true,
  delayBetweenCalls: number = 0
): Promise<AnalyzeEmailResult> {
  // Vérifier le cache
  let classificationFromCache = false;
  let extractionFromCache = false;
  let classification: ClassificationResult;
  let extraction: ExtractionResult | null = null;
  let didClassificationLLMCall = false;

  if (useCache) {
    const cached = await getLLMCacheEntry(email.id);
    if (cached?.classification) {
      classification = cached.classification;
      classificationFromCache = true;

      if (cached.extraction) {
        extraction = cached.extraction;
        extractionFromCache = true;
      }
    } else {
      // Classification non en cache, la faire
      classification = await classifyEmail(email, apiKey);
      didClassificationLLMCall = true;
    }
  } else {
    classification = await classifyEmail(email, apiKey);
    didClassificationLLMCall = true;
  }

  // Si extraction pas encore faite et type extractible
  if (!extraction) {
    const isExtractible =
      classification.type !== TypeEmail.AUTRE &&
      classification.type !== TypeEmail.RAPPEL &&
      classification.confidence >= MIN_CONFIDENCE_THRESHOLD;

    if (isExtractible) {
      // Appliquer le délai entre classification et extraction si on a fait un appel LLM
      if (didClassificationLLMCall && delayBetweenCalls > 0) {
        await sleep(delayBetweenCalls);
      }
      extraction = await extractFormation(email, classification.type, apiKey);
    }
  }

  // Sauvegarder dans le cache
  if (!classificationFromCache || !extractionFromCache) {
    await cacheLLMResult(email.id, classification, extraction);
  }

  return {
    classification,
    extraction,
    fromCache: {
      classification: classificationFromCache,
      extraction: extractionFromCache
    }
  };
}

/**
 * Type pour le signal d'interruption
 */
export interface AnalysisAbortSignal {
  aborted: boolean;
}

/**
 * Callback de progression avec statistiques de cache
 */
export interface AnalysisProgressCallback {
  (
    current: number,
    total: number,
    stats: {
      fromCache: number;
      fromLLM: number;
      errors: number;
    }
  ): void;
}

/**
 * Callback appelé immédiatement après le traitement de chaque email
 * Permet de marquer l'email comme traité dans la base de données
 */
export interface OnEmailProcessedCallback {
  (emailId: string, result: AnalyzeEmailResult): Promise<void>;
}

/**
 * Analyse plusieurs emails en batch avec support cache et interruption
 * @param emails Liste d'emails à analyser
 * @param apiKey Clé API OpenAI (optionnel)
 * @param options Options d'analyse
 * @returns Map des résultats et statistiques
 */
export async function analyzeEmailBatchWithCache(
  emails: EmailInput[],
  apiKey?: string,
  options?: {
    useCache?: boolean;
    abortSignal?: AnalysisAbortSignal;
    onProgress?: AnalysisProgressCallback;
    onEmailProcessed?: OnEmailProcessedCallback;
    delayBetweenCalls?: number;
  }
): Promise<{
  results: Map<string, AnalyzeEmailResult>;
  stats: {
    total: number;
    processed: number;
    fromCache: number;
    fromLLM: number;
    errors: number;
    aborted: boolean;
  };
}> {
  const results = new Map<string, AnalyzeEmailResult>();
  const useCache = options?.useCache ?? true;
  const delayMs = options?.delayBetweenCalls ?? 3000;

  let fromCache = 0;
  let fromLLM = 0;
  let errors = 0;

  for (let i = 0; i < emails.length; i++) {
    // Vérifier le signal d'interruption
    if (options?.abortSignal?.aborted) {
      return {
        results,
        stats: {
          total: emails.length,
          processed: i,
          fromCache,
          fromLLM,
          errors,
          aborted: true
        }
      };
    }

    const email = emails[i];

    try {
      const result = await analyzeEmailWithCache(
        email,
        apiKey,
        useCache,
        delayMs
      );
      results.set(email.id, result);

      // Appeler le callback immédiatement après le traitement
      if (options?.onEmailProcessed) {
        await options.onEmailProcessed(email.id, result);
      }

      if (result.fromCache.classification && result.fromCache.extraction) {
        fromCache++;
      } else {
        fromLLM++;
        // Délai après le dernier appel LLM de cet email avant de passer au suivant
        if (i < emails.length - 1 && delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    } catch (error) {
      console.error(`Erreur analyse email ${email.id}:`, error);
      errors++;

      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";

      // Résultat par défaut en cas d'erreur - NE PAS marquer comme traité
      const errorResult: AnalyzeEmailResult = {
        classification: {
          type: TypeEmail.AUTRE,
          confidence: 0,
          reason: errorMessage
        },
        extraction: null,
        fromCache: { classification: false, extraction: false },
        error: errorMessage
      };
      results.set(email.id, errorResult);

      // Notifier mais l'email ne sera pas marqué comme traité
      if (options?.onEmailProcessed) {
        await options.onEmailProcessed(email.id, errorResult);
      }

      // Appliquer un délai après une erreur pour éviter d'aggraver le rate limit
      if (i < emails.length - 1 && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    options?.onProgress?.(i + 1, emails.length, { fromCache, fromLLM, errors });
  }

  return {
    results,
    stats: {
      total: emails.length,
      processed: emails.length,
      fromCache,
      fromLLM,
      errors,
      aborted: false
    }
  };
}
