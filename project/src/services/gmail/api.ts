/**
 * Service d'accès à l'API Gmail
 */

import { GMAIL_CONFIG } from "./config";
import { getAccessToken } from "./auth";
import type {
  GmailListResponse,
  GmailFullMessage,
  ExtractedHeaders,
  ExtractedBody,
  GmailMessagePart
} from "./types";

// =============================================================================
// Requêtes API Gmail
// =============================================================================

/**
 * Liste les messages Gmail correspondant à la query ORSYS
 * @param pageToken Token de pagination (optionnel)
 * @param afterDate Date minimale pour filtrer (format YYYY/MM/DD)
 */
export async function listMessages(
  pageToken?: string,
  afterDate?: string
): Promise<GmailListResponse> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Non authentifié. Veuillez vous connecter à Gmail.");
  }

  // Construire la query avec la date "after:" si fournie
  let query = GMAIL_CONFIG.query;
  if (afterDate) {
    // Remplacer la date par défaut par la nouvelle date
    query = `from:orsys.fr after:${afterDate}`;
  }

  const params = new URLSearchParams({
    q: query,
    maxResults: String(GMAIL_CONFIG.maxResults)
  });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const response = await fetch(
    `${GMAIL_CONFIG.apiBase}/users/me/messages?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Session expirée. Veuillez vous reconnecter.");
    }
    throw new Error(
      `Erreur API Gmail: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Récupère un message complet par son ID
 * @param messageId ID du message Gmail
 */
export async function getMessage(messageId: string): Promise<GmailFullMessage> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Non authentifié. Veuillez vous connecter à Gmail.");
  }

  const response = await fetch(
    `${GMAIL_CONFIG.apiBase}/users/me/messages/${messageId}?format=full`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Session expirée. Veuillez vous reconnecter.");
    }
    throw new Error(
      `Erreur API Gmail: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

// =============================================================================
// Extraction du contenu
// =============================================================================

/**
 * Décode une chaîne base64url (format Gmail)
 */
function decodeBase64Url(data: string): string {
  // Gmail utilise base64url : remplacer les caractères non-standard
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");

  try {
    // Décoder en bytes puis en UTF-8
    const bytes = atob(base64);
    const utf8 = decodeURIComponent(
      bytes
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return utf8;
  } catch {
    // Fallback si le décodage UTF-8 échoue
    return atob(base64);
  }
}

/**
 * Extrait le corps de l'email (texte et HTML)
 */
export function extractEmailBody(message: GmailFullMessage): ExtractedBody {
  let text = "";
  let html: string | undefined;

  /**
   * Parcourt récursivement les parties du message
   */
  function extractParts(parts?: GmailMessagePart[]): void {
    if (!parts) return;

    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        text = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data) {
        html = decodeBase64Url(part.body.data);
      } else if (part.parts) {
        // Récursion pour les messages multipart
        extractParts(part.parts);
      }
    }
  }

  // Corps simple (message non-multipart)
  if (message.payload.body?.data) {
    const decoded = decodeBase64Url(message.payload.body.data);
    if (message.payload.mimeType === "text/html") {
      html = decoded;
    } else {
      text = decoded;
    }
  }

  // Corps multipart
  if (message.payload.parts) {
    extractParts(message.payload.parts);
  }

  return { text, html };
}

/**
 * Extrait les headers importants d'un email
 */
export function extractEmailHeaders(
  message: GmailFullMessage
): ExtractedHeaders {
  const headers = message.payload.headers;

  const getHeader = (name: string): string => {
    const header = headers.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    );
    return header?.value || "";
  };

  return {
    from: getHeader("From"),
    subject: getHeader("Subject"),
    date: new Date(parseInt(message.internalDate)).toISOString()
  };
}

// =============================================================================
// Utilitaires
// =============================================================================

/**
 * Attend un certain nombre de millisecondes
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Callback de progression
 */
export type ProgressCallback = (
  current: number,
  total: number,
  message?: string
) => void;

/**
 * Récupère tous les IDs de messages ORSYS
 * @param onProgress Callback de progression optionnel
 * @param afterDate Date minimale pour filtrer (YYYY/MM/DD). Si non fournie, utilise 2014/01/01
 */
export async function fetchAllMessageIds(
  onProgress?: ProgressCallback,
  afterDate?: string
): Promise<string[]> {
  const allIds: string[] = [];
  let pageToken: string | undefined;
  let totalEstimate = 0;

  do {
    const response = await listMessages(pageToken, afterDate);

    if (response.messages) {
      for (const msg of response.messages) {
        allIds.push(msg.id);
      }
    }

    totalEstimate = response.resultSizeEstimate;
    onProgress?.(
      allIds.length,
      totalEstimate,
      afterDate
        ? `Récupération des nouveaux emails (après ${afterDate})...`
        : "Récupération des identifiants..."
    );

    pageToken = response.nextPageToken;

    // Rate limiting
    if (pageToken) {
      await delay(GMAIL_CONFIG.requestDelay);
    }
  } while (pageToken);

  return allIds;
}
