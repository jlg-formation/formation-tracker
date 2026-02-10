/**
 * Configuration du service Gmail OAuth
 */

// =============================================================================
// Configuration principale
// =============================================================================

/** Configuration Gmail par défaut */
export const GMAIL_CONFIG = {
  /** Scopes nécessaires (lecture seule) */
  scopes: ["https://www.googleapis.com/auth/gmail.readonly"],

  /** URL de base de l'API Gmail */
  apiBase: "https://gmail.googleapis.com/gmail/v1",

  /** Query pour filtrer les emails ORSYS depuis 2014 */
  query: "from:orsys.fr after:2014/01/01",

  /** Nombre max de messages par requête */
  maxResults: 100,

  /** Délai entre les requêtes (ms) pour rate limiting */
  requestDelay: 100
};

// =============================================================================
// Filtrage des emails par sujet (optimisation coûts LLM)
// Clarification 010 : éviter les appels LLM inutiles
// =============================================================================

/**
 * Patterns regex pour exclure certains emails avant l'analyse LLM.
 * Ces emails sont stockés en cache mais marqués comme traités avec type "autre".
 */
export const EXCLUDED_SUBJECT_PATTERNS: RegExp[] = [
  /Planning ORSYS Réactualisé/i,
  /Demande Intra /i
];

/**
 * Vérifie si un email doit être exclu de l'analyse LLM en fonction de son sujet.
 * @param subject Sujet de l'email
 * @returns true si l'email doit être exclu (ne pas envoyer au LLM)
 */
export function shouldExcludeEmail(subject: string): boolean {
  return EXCLUDED_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject));
}

// =============================================================================
// Clés localStorage
// =============================================================================

/** Clé localStorage pour le Client ID Google */
export const GOOGLE_CLIENT_ID_KEY = "google_client_id";

/** Clé localStorage pour le token Gmail */
export const GMAIL_TOKEN_KEY = "gmail_token";

/** Clé localStorage pour l'expiration du token */
export const GMAIL_TOKEN_EXPIRY_KEY = "gmail_token_expiry";

/**
 * Récupère le Client ID Google
 * Priorité : localStorage > variable d'environnement
 */
export function getGoogleClientId(): string | null {
  // Priorité au localStorage (configuré par l'utilisateur)
  const storedClientId = localStorage.getItem(GOOGLE_CLIENT_ID_KEY);
  if (storedClientId) {
    return storedClientId;
  }

  // Fallback sur la variable d'environnement
  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (envClientId) {
    return envClientId;
  }

  return null;
}

/**
 * Sauvegarde le Client ID Google
 */
export function setGoogleClientId(clientId: string): void {
  localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId);
}

/**
 * Supprime le Client ID Google
 */
export function clearGoogleClientId(): void {
  localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
}
