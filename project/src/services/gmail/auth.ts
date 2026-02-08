/**
 * Service d'authentification Gmail via Google Identity Services (GIS)
 */

import {
  GMAIL_CONFIG,
  GMAIL_TOKEN_KEY,
  GMAIL_TOKEN_EXPIRY_KEY,
  getGoogleClientId
} from "./config";
import type { TokenClient, TokenResponse, GmailConnectionState } from "./types";

// =============================================================================
// État interne
// =============================================================================

let tokenClient: TokenClient | null = null;
let accessToken: string | null = null;
let isGisLoaded = false;
let gisLoadPromise: Promise<void> | null = null;

// =============================================================================
// Chargement du script GIS
// =============================================================================

/**
 * Charge le script Google Identity Services
 */
function loadGisScript(): Promise<void> {
  if (gisLoadPromise) return gisLoadPromise;

  if (isGisLoaded && window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  gisLoadPromise = new Promise((resolve, reject) => {
    // Vérifier si déjà chargé
    if (window.google?.accounts?.oauth2) {
      isGisLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      isGisLoaded = true;
      resolve();
    };

    script.onerror = () => {
      gisLoadPromise = null;
      reject(new Error("Impossible de charger Google Identity Services"));
    };

    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

// =============================================================================
// Initialisation OAuth
// =============================================================================

/**
 * Initialise le client OAuth Google
 * @returns Promise qui se résout quand le client est prêt
 */
export async function initGoogleAuth(): Promise<void> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error(
      "Client ID Google non configuré. Veuillez le configurer dans les paramètres."
    );
  }

  await loadGisScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services non disponible");
  }

  return new Promise((resolve, reject) => {
    try {
      tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GMAIL_CONFIG.scopes.join(" "),
        callback: (response: TokenResponse) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
          } else {
            accessToken = response.access_token;
            saveToken(response.access_token, response.expires_in);
            resolve();
          }
        },
        error_callback: (error) => {
          reject(new Error(error.message || "Erreur d'authentification"));
        }
      });
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

// =============================================================================
// Gestion du token
// =============================================================================

/**
 * Demande un nouveau token d'accès (ouvre la popup Google)
 */
export function requestAccessToken(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(
        new Error(
          "Client OAuth non initialisé. Appelez initGoogleAuth() d'abord."
        )
      );
      return;
    }

    // Reconfigurer le callback pour cette requête
    const clientId = getGoogleClientId();
    if (!clientId || !window.google?.accounts?.oauth2) {
      reject(new Error("Google OAuth non configuré"));
      return;
    }

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_CONFIG.scopes.join(" "),
      callback: (response: TokenResponse) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
        } else {
          accessToken = response.access_token;
          saveToken(response.access_token, response.expires_in);
          resolve();
        }
      },
      error_callback: (error) => {
        reject(new Error(error.message || "Erreur d'authentification"));
      }
    });

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

/**
 * Récupère le token d'accès actuel
 */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Vérifie si l'utilisateur est connecté avec un token valide
 */
export function isAuthenticated(): boolean {
  return accessToken !== null && !isTokenExpired();
}

/**
 * Vérifie si le token est expiré
 */
function isTokenExpired(): boolean {
  const expiry = localStorage.getItem(GMAIL_TOKEN_EXPIRY_KEY);
  if (!expiry) return true;
  return new Date(expiry) <= new Date();
}

/**
 * Sauvegarde le token et son expiration
 */
function saveToken(token: string, expiresIn: number): void {
  const expiry = new Date(Date.now() + expiresIn * 1000).toISOString();
  localStorage.setItem(GMAIL_TOKEN_KEY, token);
  localStorage.setItem(GMAIL_TOKEN_EXPIRY_KEY, expiry);
}

/**
 * Charge le token depuis le localStorage
 * @returns true si un token valide a été trouvé
 */
export function loadStoredToken(): boolean {
  const token = localStorage.getItem(GMAIL_TOKEN_KEY);
  const expiry = localStorage.getItem(GMAIL_TOKEN_EXPIRY_KEY);

  if (token && expiry && new Date(expiry) > new Date()) {
    accessToken = token;
    return true;
  }

  // Token expiré ou absent, nettoyer
  clearStoredToken();
  return false;
}

/**
 * Supprime le token stocké
 */
function clearStoredToken(): void {
  localStorage.removeItem(GMAIL_TOKEN_KEY);
  localStorage.removeItem(GMAIL_TOKEN_EXPIRY_KEY);
}

/**
 * Déconnexion complète
 */
export async function logout(): Promise<void> {
  const token = accessToken;
  accessToken = null;
  clearStoredToken();

  // Révoquer le token côté Google si possible
  if (token && window.google?.accounts?.oauth2) {
    return new Promise((resolve) => {
      window.google!.accounts.oauth2.revoke(token, () => {
        resolve();
      });
    });
  }
}

// =============================================================================
// État de connexion
// =============================================================================

/**
 * Récupère l'état de connexion actuel
 */
export function getConnectionState(): GmailConnectionState {
  if (accessToken && !isTokenExpired()) {
    return {
      status: "connected",
      tokenExpiry: localStorage.getItem(GMAIL_TOKEN_EXPIRY_KEY) || undefined
    };
  }

  return {
    status: "disconnected"
  };
}

/**
 * Tente de restaurer une session existante
 * @returns true si une session valide a été restaurée
 */
export async function tryRestoreSession(): Promise<boolean> {
  // Vérifier si un token valide existe
  if (loadStoredToken()) {
    // Initialiser GIS en arrière-plan pour de futures requêtes
    try {
      await initGoogleAuth();
    } catch {
      // Ignorer les erreurs d'init, le token peut encore être valide
    }
    return true;
  }
  return false;
}
