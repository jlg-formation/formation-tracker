/**
 * Service Gmail - Export centralisé
 */

// Configuration
export {
  GMAIL_CONFIG,
  GOOGLE_CLIENT_ID_KEY,
  GMAIL_TOKEN_KEY,
  GMAIL_TOKEN_EXPIRY_KEY,
  getGoogleClientId,
  setGoogleClientId,
  clearGoogleClientId,
  EXCLUDED_SUBJECT_PATTERNS,
  shouldExcludeEmail
} from "./config";

// Authentification
export {
  initGoogleAuth,
  requestAccessToken,
  getAccessToken,
  isAuthenticated,
  loadStoredToken,
  logout,
  getConnectionState,
  tryRestoreSession
} from "./auth";

// API Gmail
export {
  listMessages,
  getMessage,
  getMessageMetadata,
  extractEmailBody,
  extractEmailHeaders,
  fetchAllMessageIds,
  type ProgressCallback
} from "./api";

// Types
export type {
  TokenResponse,
  TokenClient,
  GmailMessageRef,
  GmailListResponse,
  GmailFullMessage,
  GmailHeader,
  GmailMessagePart,
  ExtractedHeaders,
  ExtractedBody,
  GmailConnectionStatus,
  GmailConnectionState
} from "./types";
