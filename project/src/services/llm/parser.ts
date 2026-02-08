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
  DEFAULT_OPENAI_CONFIG,
  OPENAI_API_BASE_URL,
  MIN_CONFIDENCE_THRESHOLD
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
