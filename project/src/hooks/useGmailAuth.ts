/**
 * Hook React pour gérer l'authentification Gmail
 */

import { useState, useEffect, useCallback } from "react";
import {
  initGoogleAuth,
  requestAccessToken,
  logout,
  getConnectionState,
  tryRestoreSession,
  getGoogleClientId,
  setGoogleClientId,
  type GmailConnectionState
} from "../services/gmail";

export interface UseGmailAuthReturn {
  /** État de connexion actuel */
  connectionState: GmailConnectionState;
  /** Client ID Google configuré */
  clientId: string | null;
  /** Indique si une opération est en cours */
  loading: boolean;
  /** Message d'erreur éventuel */
  error: string | null;
  /** Connecte l'utilisateur à Gmail */
  connect: () => Promise<void>;
  /** Déconnecte l'utilisateur */
  disconnect: () => Promise<void>;
  /** Configure le Client ID Google */
  setClientId: (clientId: string) => void;
}

/**
 * Hook pour gérer l'authentification Gmail
 */
export function useGmailAuth(): UseGmailAuthReturn {
  const [connectionState, setConnectionState] = useState<GmailConnectionState>({
    status: "disconnected"
  });
  const [clientId, setClientIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialisation au montage
  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);

      try {
        // Charger le Client ID
        const storedClientId = getGoogleClientId();
        setClientIdState(storedClientId);

        // Essayer de restaurer une session existante
        if (storedClientId) {
          const restored = await tryRestoreSession();
          if (restored) {
            setConnectionState(getConnectionState());
          }
        }
      } catch (err) {
        // Ignorer les erreurs de restauration
        console.warn("Impossible de restaurer la session Gmail:", err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  // Connexion à Gmail
  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Vérifier que le Client ID est configuré
      if (!getGoogleClientId()) {
        throw new Error("Veuillez d'abord configurer votre Client ID Google.");
      }

      // Initialiser le client OAuth
      await initGoogleAuth();

      // Demander le token (ouvre la popup)
      await requestAccessToken();

      // Mettre à jour l'état
      setConnectionState(getConnectionState());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur de connexion";
      setError(message);
      setConnectionState({ status: "error", error: message });
    } finally {
      setLoading(false);
    }
  }, []);

  // Déconnexion
  const disconnect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await logout();
      setConnectionState({ status: "disconnected" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur de déconnexion";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Configuration du Client ID
  const saveClientId = useCallback((newClientId: string) => {
    setGoogleClientId(newClientId);
    setClientIdState(newClientId);
    // Reset de l'état de connexion si le Client ID change
    setConnectionState({ status: "disconnected" });
  }, []);

  return {
    connectionState,
    clientId,
    loading,
    error,
    connect,
    disconnect,
    setClientId: saveClientId
  };
}
