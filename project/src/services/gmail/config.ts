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

  /**
   * Query Gmail (paramètre `q`) pour filtrer les emails ORSYS depuis 2014.
   * IMPORTANT (clarification 010) : les exclusions doivent se faire ici, dès la recherche,
   * afin que les emails filtrés ne soient jamais listés/récupérés ni stockés.
   */
  query: "",

  /** Nombre max de messages par requête */
  maxResults: 100,

  /** Délai entre les requêtes (ms) pour rate limiting */
  requestDelay: 100
};

// =============================================================================
// Filtrage des emails à la source (clarification 010)
// Les emails exclus ne sont JAMAIS récupérés ni stockés
// =============================================================================

/**
 * Sous-chaînes à exclure si le sujet CONTIENT le texte.
 * La recherche Gmail ne supportant pas les regex côté serveur, on utilise `-subject:"..."`.
 */
export const EXCLUDED_SUBJECT_CONTAINS = [
  "Planning ORSYS Réactualisé",
  "Demande Intra "
];

function escapeGmailQuotedTerm(term: string): string {
  return term.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

/**
 * Construit la query Gmail avec exclusions à la source.
 * @param afterDate Date minimale au format YYYY/MM/DD (défaut: 2014/01/01)
 */
export function buildGmailQuery(afterDate: string = "2014/01/01"): string {
  const baseQuery = `from:orsys.fr after:${afterDate}`;
  const exclusions = EXCLUDED_SUBJECT_CONTAINS.map(
    (s) => `-subject:"${escapeGmailQuotedTerm(s)}"`
  ).join(" ");

  return exclusions ? `${baseQuery} ${exclusions}` : baseQuery;
}

// Initialiser la query par défaut (2014/01/01)
GMAIL_CONFIG.query = buildGmailQuery();

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
