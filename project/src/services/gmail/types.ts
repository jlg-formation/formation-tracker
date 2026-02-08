/**
 * Types pour l'API Gmail et Google Identity Services (GIS)
 */

// =============================================================================
// Google Identity Services Types
// =============================================================================

/** Réponse du callback OAuth */
export interface TokenResponse {
  /** Token d'accès */
  access_token: string;
  /** Type de token (Bearer) */
  token_type: string;
  /** Durée de validité en secondes */
  expires_in: number;
  /** Scopes accordés */
  scope: string;
  /** Message d'erreur si échec */
  error?: string;
  /** Description de l'erreur */
  error_description?: string;
}

/** Configuration du client OAuth */
export interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string; message: string }) => void;
}

/** Client OAuth Google */
export interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

/** Namespace google.accounts.oauth2 */
export interface GoogleAccountsOAuth2 {
  initTokenClient: (config: TokenClientConfig) => TokenClient;
  revoke: (token: string, callback?: () => void) => void;
}

/** Extension de Window pour GIS */
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: GoogleAccountsOAuth2;
      };
    };
  }
}

// =============================================================================
// Gmail API Types
// =============================================================================

/** Message minimal de la liste */
export interface GmailMessageRef {
  id: string;
  threadId: string;
}

/** Réponse de la liste des messages */
export interface GmailListResponse {
  messages?: GmailMessageRef[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

/** Header d'un message */
export interface GmailHeader {
  name: string;
  value: string;
}

/** Partie d'un message (body ou pièce jointe) */
export interface GmailMessagePart {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    attachmentId?: string;
    size: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

/** Message complet Gmail */
export interface GmailFullMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: {
    partId?: string;
    mimeType: string;
    filename?: string;
    headers: GmailHeader[];
    body?: {
      size: number;
      data?: string;
    };
    parts?: GmailMessagePart[];
  };
  sizeEstimate: number;
}

/** Headers extraits d'un email */
export interface ExtractedHeaders {
  from: string;
  subject: string;
  date: string;
}

/** Corps extrait d'un email */
export interface ExtractedBody {
  text: string;
  html?: string;
}

// =============================================================================
// État de connexion
// =============================================================================

/** État de la connexion Gmail */
export type GmailConnectionStatus =
  | "disconnected"
  | "loading"
  | "connected"
  | "error";

/** Informations de connexion Gmail */
export interface GmailConnectionState {
  status: GmailConnectionStatus;
  error?: string;
  tokenExpiry?: string;
}
