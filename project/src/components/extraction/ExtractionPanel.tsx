/**
 * Panneau d'extraction des emails Gmail ORSYS
 * Permet d'extraire et stocker les emails Gmail dans IndexedDB
 */

import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useGmailAuth } from "../../hooks/useGmailAuth";
import {
  fetchAllMessageIds,
  getMessage,
  extractEmailHeaders,
  extractEmailBody
} from "../../services/gmail/api";
import { db } from "../../stores/db";
import type { EmailRaw } from "../../types";

/** État de l'extraction */
interface ExtractionState {
  status: "idle" | "fetching-ids" | "fetching-content" | "done" | "error";
  currentCount: number;
  totalCount: number;
  message: string;
  newEmails: number;
  skippedEmails: number;
  errorMessage?: string;
}

const initialState: ExtractionState = {
  status: "idle",
  currentCount: 0,
  totalCount: 0,
  message: "",
  newEmails: 0,
  skippedEmails: 0
};

export function ExtractionPanel() {
  const { connectionState } = useGmailAuth();
  const [state, setState] = useState<ExtractionState>(initialState);
  const [existingCount, setExistingCount] = useState<number | null>(null);

  // Charger le nombre d'emails existants au montage
  useState(() => {
    db.emails.count().then(setExistingCount);
  });

  const isConnected = connectionState.status === "connected";
  const isExtracting =
    state.status === "fetching-ids" || state.status === "fetching-content";

  /**
   * Lance l'extraction des emails ORSYS
   */
  const startExtraction = useCallback(async () => {
    if (!isConnected) return;

    setState({
      ...initialState,
      status: "fetching-ids",
      message: "Récupération des identifiants des emails..."
    });

    try {
      // Phase 1 : Récupérer tous les IDs de messages
      const messageIds = await fetchAllMessageIds((current, total, message) => {
        setState((prev) => ({
          ...prev,
          currentCount: current,
          totalCount: total,
          message: message || prev.message
        }));
      });

      if (messageIds.length === 0) {
        setState({
          ...initialState,
          status: "done",
          message: "Aucun email ORSYS trouvé."
        });
        return;
      }

      // Phase 2 : Récupérer le contenu de chaque email
      setState((prev) => ({
        ...prev,
        status: "fetching-content",
        currentCount: 0,
        totalCount: messageIds.length,
        message: "Téléchargement des emails..."
      }));

      let newEmails = 0;
      let skippedEmails = 0;

      for (let i = 0; i < messageIds.length; i++) {
        const messageId = messageIds[i];

        // Vérifier si l'email est déjà en base
        const existing = await db.emails.get(messageId);
        if (existing) {
          skippedEmails++;
          setState((prev) => ({
            ...prev,
            currentCount: i + 1,
            skippedEmails,
            message: `Téléchargement des emails... (${i + 1}/${messageIds.length})`
          }));
          continue;
        }

        try {
          // Récupérer le contenu du message
          const fullMessage = await getMessage(messageId);
          const headers = extractEmailHeaders(fullMessage);
          const body = extractEmailBody(fullMessage);

          // Créer l'objet EmailRaw
          const emailRaw: EmailRaw = {
            id: fullMessage.id,
            threadId: fullMessage.threadId,
            from: headers.from,
            subject: headers.subject,
            date: headers.date,
            body: body.text,
            bodyHtml: body.html,
            processed: false
          };

          // Stocker dans IndexedDB
          await db.emails.add(emailRaw);
          newEmails++;

          setState((prev) => ({
            ...prev,
            currentCount: i + 1,
            newEmails,
            message: `Téléchargement des emails... (${i + 1}/${messageIds.length})`
          }));
        } catch (fetchError) {
          // Log l'erreur mais continue avec les autres emails
          console.error(
            `Erreur lors de la récupération de l'email ${messageId}:`,
            fetchError
          );
        }

        // Petite pause pour ne pas surcharger l'API
        if ((i + 1) % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Extraction terminée
      const totalInDb = await db.emails.count();
      setExistingCount(totalInDb);

      setState({
        status: "done",
        currentCount: messageIds.length,
        totalCount: messageIds.length,
        newEmails,
        skippedEmails,
        message: `Extraction terminée : ${newEmails} nouveaux emails ajoutés.`
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      setState((prev) => ({
        ...prev,
        status: "error",
        errorMessage,
        message: `Erreur: ${errorMessage}`
      }));
    }
  }, [isConnected]);

  /**
   * Réinitialiser l'état
   */
  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  /**
   * Supprimer tous les emails stockés
   */
  const clearEmails = useCallback(async () => {
    if (
      !confirm("Êtes-vous sûr de vouloir supprimer tous les emails stockés ?")
    ) {
      return;
    }
    await db.emails.clear();
    setExistingCount(0);
    setState(initialState);
  }, []);

  // Calcul du pourcentage de progression
  const progressPercent =
    state.totalCount > 0
      ? Math.round((state.currentCount / state.totalCount) * 100)
      : 0;

  return (
    <section className="p-6 bg-gray-800/50 rounded-lg border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span>📧</span> Extraction des emails ORSYS
      </h2>

      {/* État de connexion */}
      {!isConnected && (
        <div className="mb-4 p-4 bg-yellow-900/30 border border-yellow-600 rounded-lg text-yellow-300">
          <p>
            Vous devez être connecté à Gmail pour extraire les emails. Allez
            dans{" "}
            <Link to="/parametres" className="underline hover:text-yellow-100">
              Paramètres
            </Link>{" "}
            pour vous connecter.
          </p>
        </div>
      )}

      {/* Statistiques actuelles */}
      {existingCount !== null && (
        <div className="mb-4 p-3 bg-gray-900/50 rounded-lg">
          <p className="text-gray-300">
            <span className="font-medium text-white">{existingCount}</span>{" "}
            emails stockés localement
          </p>
        </div>
      )}

      {/* Barre de progression */}
      {isExtracting && (
        <div className="mb-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
            <span>{state.message}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs text-gray-500">
            <span>
              Nouveaux :{" "}
              <span className="text-green-400">{state.newEmails}</span>
            </span>
            <span>
              Ignorés :{" "}
              <span className="text-gray-400">{state.skippedEmails}</span>
            </span>
          </div>
        </div>
      )}

      {/* Message de résultat */}
      {state.status === "done" && (
        <div className="mb-4 p-4 bg-green-900/30 border border-green-600 rounded-lg text-green-300">
          <p className="font-medium">{state.message}</p>
          <p className="text-sm mt-1">
            {state.skippedEmails > 0 &&
              `${state.skippedEmails} emails déjà présents ont été ignorés.`}
          </p>
        </div>
      )}

      {/* Message d'erreur */}
      {state.status === "error" && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-600 rounded-lg text-red-300">
          <p className="font-medium">Erreur lors de l'extraction</p>
          <p className="text-sm mt-1">{state.errorMessage}</p>
        </div>
      )}

      {/* Boutons d'action */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={startExtraction}
          disabled={!isConnected || isExtracting}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors flex items-center gap-2"
        >
          {isExtracting ? (
            <>
              <span className="animate-spin">⏳</span>
              Extraction en cours...
            </>
          ) : (
            <>
              <span>📥</span>
              Extraire les emails
            </>
          )}
        </button>

        {(state.status === "done" || state.status === "error") && (
          <button
            onClick={resetState}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors"
          >
            Réinitialiser
          </button>
        )}

        {existingCount !== null && existingCount > 0 && !isExtracting && (
          <button
            onClick={clearEmails}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-md transition-colors"
          >
            Supprimer tous les emails
          </button>
        )}
      </div>

      {/* Aide */}
      <p className="mt-4 text-xs text-gray-500">
        L'extraction recherche tous les emails provenant de @orsys.fr depuis
        2014. Les emails déjà stockés sont ignorés pour éviter les doublons.
      </p>
    </section>
  );
}
