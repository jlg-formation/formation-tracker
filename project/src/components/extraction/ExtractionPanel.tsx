/**
 * Panneau d'extraction des emails Gmail ORSYS
 * Permet d'extraire et stocker les emails Gmail dans IndexedDB
 * puis de les analyser via LLM pour créer des formations
 */

import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { useGmailAuth } from "../../hooks/useGmailAuth";
import {
  fetchAllMessageIds,
  getMessage,
  extractEmailHeaders,
  extractEmailBody
} from "../../services/gmail/api";
import {
  classifyEmail,
  extractFormation,
  type ClassificationResult,
  type ExtractionResult
} from "../../services/llm";
import { fusionnerEmails, type FusionInput } from "../../utils/fusion";
import { db } from "../../stores/db";
import { getSettings } from "../../stores/settingsStore";
import type { EmailRaw } from "../../types";
import { TypeEmail } from "../../types";

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

/** État de l'analyse LLM */
interface AnalysisState {
  status: "idle" | "analyzing" | "done" | "error";
  currentCount: number;
  totalCount: number;
  message: string;
  formationsCreees: number;
  formationsMisesAJour: number;
  emailsIgnores: number;
  emailsEnErreur: number;
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

const initialAnalysisState: AnalysisState = {
  status: "idle",
  currentCount: 0,
  totalCount: 0,
  message: "",
  formationsCreees: 0,
  formationsMisesAJour: 0,
  emailsIgnores: 0,
  emailsEnErreur: 0
};

export function ExtractionPanel() {
  const { connectionState } = useGmailAuth();
  const [state, setState] = useState<ExtractionState>(initialState);
  const [analysisState, setAnalysisState] =
    useState<AnalysisState>(initialAnalysisState);
  const [existingCount, setExistingCount] = useState<number | null>(null);
  const [unprocessedCount, setUnprocessedCount] = useState<number | null>(null);
  const [formationsCount, setFormationsCount] = useState<number | null>(null);

  // Charger les compteurs au montage et après les opérations
  const refreshCounts = useCallback(async () => {
    const emailCount = await db.emails.count();
    const unprocessed = await db.emails
      .filter((e) => e.processed === false)
      .count();
    const formations = await db.formations.count();
    setExistingCount(emailCount);
    setUnprocessedCount(unprocessed);
    setFormationsCount(formations);
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  const isConnected = connectionState.status === "connected";
  const isExtracting =
    state.status === "fetching-ids" || state.status === "fetching-content";
  const isAnalyzing = analysisState.status === "analyzing";

  /**
   * Lance l'extraction des emails ORSYS
   * Optimisation : ne charge que les emails depuis le dernier email stocké (-1 jour)
   */
  const startExtraction = useCallback(async () => {
    if (!isConnected) return;

    setState({
      ...initialState,
      status: "fetching-ids",
      message: "Recherche du dernier email stocké..."
    });

    try {
      // Trouver le dernier email stocké pour optimiser la requête
      let afterDate: string | undefined;
      const lastEmail = await db.emails.orderBy("date").reverse().first();

      if (lastEmail?.date) {
        // Soustraire 1 jour pour être sûr de ne rien manquer
        const lastDate = new Date(lastEmail.date);
        lastDate.setDate(lastDate.getDate() - 1);
        // Format YYYY/MM/DD pour Gmail API
        afterDate = `${lastDate.getFullYear()}/${String(lastDate.getMonth() + 1).padStart(2, "0")}/${String(lastDate.getDate()).padStart(2, "0")}`;
        setState((prev) => ({
          ...prev,
          message: `Recherche des emails depuis ${afterDate}...`
        }));
      }

      // Phase 1 : Récupérer les IDs de messages (filtrés par date si possible)
      const messageIds = await fetchAllMessageIds((current, total, message) => {
        setState((prev) => ({
          ...prev,
          currentCount: current,
          totalCount: total,
          message: message || prev.message
        }));
      }, afterDate);

      if (messageIds.length === 0) {
        setState({
          ...initialState,
          status: "done",
          message: afterDate
            ? "Aucun nouvel email ORSYS trouvé."
            : "Aucun email ORSYS trouvé."
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
      await refreshCounts();

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
  }, [isConnected, refreshCounts]);

  /**
   * Lance l'analyse des emails non traités via LLM
   * Sauvegarde incrémentale : les formations sont fusionnées et sauvegardées par batch
   * pour permettre de reprendre en cas d'interruption
   */
  const startAnalysis = useCallback(async () => {
    // Vérifier la clé API OpenAI
    const settings = await getSettings();
    if (!settings.openaiApiKey) {
      setAnalysisState({
        ...initialAnalysisState,
        status: "error",
        errorMessage: "Clé API OpenAI non configurée. Allez dans Paramètres."
      });
      return;
    }

    // Récupérer les emails non traités
    const unprocessedEmails = await db.emails
      .filter((e) => e.processed === false)
      .toArray();

    if (unprocessedEmails.length === 0) {
      setAnalysisState({
        ...initialAnalysisState,
        status: "done",
        message: "Aucun email à analyser."
      });
      return;
    }

    setAnalysisState({
      ...initialAnalysisState,
      status: "analyzing",
      totalCount: unprocessedEmails.length,
      message: "Classification des emails..."
    });

    let fusionInputs: FusionInput[] = [];
    let ignoredCount = 0;
    let errorCount = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    const BATCH_SIZE = 5; // Sauvegarder toutes les 5 analyses

    /**
     * Sauvegarde incrémentale des formations
     */
    const saveFormationsBatch = async () => {
      if (fusionInputs.length === 0) return;

      const existingFormations = await db.formations.toArray();
      const fusionResult = fusionnerEmails(fusionInputs, existingFormations);

      for (const formation of fusionResult.created) {
        await db.formations.add(formation);
      }
      for (const formation of fusionResult.updated) {
        await db.formations.put(formation);
      }

      totalCreated += fusionResult.stats.formationsCreees;
      totalUpdated += fusionResult.stats.formationsMisesAJour;

      // Vider le batch
      fusionInputs = [];
    };

    try {
      // Phase 1 : Classification et extraction de chaque email
      for (let i = 0; i < unprocessedEmails.length; i++) {
        const email = unprocessedEmails[i];

        setAnalysisState((prev) => ({
          ...prev,
          currentCount: i + 1,
          formationsCreees: totalCreated,
          formationsMisesAJour: totalUpdated,
          emailsIgnores: ignoredCount,
          emailsEnErreur: errorCount,
          message: `Analyse de l'email ${i + 1}/${unprocessedEmails.length}...`
        }));

        try {
          // Classification
          const classification: ClassificationResult = await classifyEmail({
            id: email.id,
            subject: email.subject,
            body: email.body
          });

          // Ignorer les emails "autre" ou "rappel" ou confiance faible
          if (
            classification.type === TypeEmail.AUTRE ||
            classification.type === TypeEmail.RAPPEL ||
            classification.confidence < 0.7
          ) {
            ignoredCount++;
            // Marquer comme traité même si ignoré
            await db.emails.update(email.id, { processed: true });
            continue;
          }

          // Extraction selon le type
          const extraction: ExtractionResult = await extractFormation(
            {
              id: email.id,
              subject: email.subject,
              body: email.body
            },
            classification.type as
              | "convocation-inter"
              | "convocation-intra"
              | "annulation"
              | "bon-commande"
              | "info-facturation"
          );

          fusionInputs.push({
            email,
            extraction,
            classification: {
              type: classification.type,
              confidence: classification.confidence
            }
          });

          // Marquer l'email comme traité SEULEMENT si analyse réussie
          await db.emails.update(email.id, { processed: true });
        } catch (emailError) {
          console.error(`Erreur analyse email ${email.id}:`, emailError);
          // NE PAS marquer comme traité pour permettre de réessayer
          // L'email sera réanalysé au prochain lancement
          errorCount++;
        }

        // Sauvegarde incrémentale par batch
        if ((i + 1) % BATCH_SIZE === 0) {
          setAnalysisState((prev) => ({
            ...prev,
            message: `Sauvegarde des formations (batch ${Math.floor((i + 1) / BATCH_SIZE)})...`
          }));
          await saveFormationsBatch();
          // Pause pour respecter les rate limits OpenAI
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Sauvegarder le dernier batch
      if (fusionInputs.length > 0) {
        setAnalysisState((prev) => ({
          ...prev,
          message: "Sauvegarde des dernières formations..."
        }));
        await saveFormationsBatch();
      }

      // Rafraîchir les compteurs
      await refreshCounts();

      const doneMessage =
        errorCount > 0
          ? `Analyse terminée. ${errorCount} email(s) en erreur à réessayer.`
          : "Analyse terminée.";

      setAnalysisState({
        status: "done",
        currentCount: unprocessedEmails.length,
        totalCount: unprocessedEmails.length,
        message: doneMessage,
        formationsCreees: totalCreated,
        formationsMisesAJour: totalUpdated,
        emailsIgnores: ignoredCount,
        emailsEnErreur: errorCount
      });
    } catch (error) {
      // En cas d'erreur, sauvegarder le batch en cours si possible
      if (fusionInputs.length > 0) {
        try {
          await saveFormationsBatch();
        } catch {
          // Ignorer l'erreur de sauvegarde
        }
      }
      await refreshCounts();

      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      setAnalysisState((prev) => ({
        ...prev,
        status: "error",
        formationsCreees: totalCreated,
        formationsMisesAJour: totalUpdated,
        emailsIgnores: ignoredCount,
        emailsEnErreur: errorCount,
        errorMessage: `${errorMessage}. ${totalCreated + totalUpdated} formations sauvegardées. Relancez l'analyse pour réessayer.`,
        message: `Erreur: ${errorMessage}`
      }));
    }
  }, [refreshCounts]);

  /**
   * Réinitialiser l'état
   */
  const resetState = useCallback(() => {
    setState(initialState);
    setAnalysisState(initialAnalysisState);
  }, []);

  /**
   * Supprimer tous les emails et formations stockés
   */
  const clearEmails = useCallback(async () => {
    if (
      !confirm(
        "Êtes-vous sûr de vouloir supprimer tous les emails ET formations stockés ?"
      )
    ) {
      return;
    }
    await db.emails.clear();
    await db.formations.clear();
    await refreshCounts();
    setState(initialState);
    setAnalysisState(initialAnalysisState);
  }, [refreshCounts]);

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
        <div className="mb-4 p-3 bg-gray-900/50 rounded-lg space-y-1">
          <p className="text-gray-300">
            <span className="font-medium text-white">{existingCount}</span>{" "}
            emails stockés localement
          </p>
          {unprocessedCount !== null && unprocessedCount > 0 && (
            <p className="text-yellow-400 text-sm">
              ⚠️ <span className="font-medium">{unprocessedCount}</span> emails
              non analysés
            </p>
          )}
          {formationsCount !== null && formationsCount > 0 && (
            <p className="text-green-400 text-sm">
              ✅ <span className="font-medium">{formationsCount}</span>{" "}
              formations extraites
            </p>
          )}
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

      {/* Message d'erreur extraction */}
      {state.status === "error" && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-600 rounded-lg text-red-300">
          <p className="font-medium">Erreur lors de l'extraction</p>
          <p className="text-sm mt-1">{state.errorMessage}</p>
        </div>
      )}

      {/* Barre de progression analyse */}
      {isAnalyzing && (
        <div className="mb-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
            <span>{analysisState.message}</span>
            <span>
              {analysisState.totalCount > 0
                ? Math.round(
                    (analysisState.currentCount / analysisState.totalCount) *
                      100
                  )
                : 0}
              %
            </span>
          </div>
          <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{
                width: `${
                  analysisState.totalCount > 0
                    ? (analysisState.currentCount / analysisState.totalCount) *
                      100
                    : 0
                }%`
              }}
            />
          </div>
        </div>
      )}

      {/* Message de résultat analyse */}
      {analysisState.status === "done" && (
        <div className="mb-4 p-4 bg-green-900/30 border border-green-600 rounded-lg text-green-300">
          <p className="font-medium">{analysisState.message}</p>
          <div className="text-sm mt-2 space-y-1">
            <p>✅ {analysisState.formationsCreees} formations créées</p>
            <p>
              🔄 {analysisState.formationsMisesAJour} formations mises à jour
            </p>
            <p>
              ⏭️ {analysisState.emailsIgnores} emails ignorés (rappels, autres)
            </p>
            {analysisState.emailsEnErreur > 0 && (
              <p className="text-yellow-300">
                ⚠️ {analysisState.emailsEnErreur} emails en erreur (relancez
                l'analyse pour réessayer)
              </p>
            )}
          </div>
        </div>
      )}

      {/* Message d'erreur analyse */}
      {analysisState.status === "error" && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-600 rounded-lg text-red-300">
          <p className="font-medium">Erreur lors de l'analyse</p>
          <p className="text-sm mt-1">{analysisState.errorMessage}</p>
          <div className="text-sm mt-2 space-y-1 text-red-200">
            <p>✅ {analysisState.formationsCreees} formations créées</p>
            <p>
              🔄 {analysisState.formationsMisesAJour} formations mises à jour
            </p>
            <p>⏭️ {analysisState.emailsIgnores} emails ignorés</p>
          </div>
        </div>
      )}

      {/* Boutons d'action */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={startExtraction}
          disabled={!isConnected || isExtracting || isAnalyzing}
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

        {/* Bouton Analyser */}
        {unprocessedCount !== null && unprocessedCount > 0 && (
          <button
            onClick={startAnalysis}
            disabled={isExtracting || isAnalyzing}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors flex items-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <span className="animate-spin">⏳</span>
                Analyse en cours...
              </>
            ) : (
              <>
                <span>🤖</span>
                Analyser {unprocessedCount} emails
              </>
            )}
          </button>
        )}

        {(state.status === "done" ||
          state.status === "error" ||
          analysisState.status === "done" ||
          analysisState.status === "error") && (
          <button
            onClick={resetState}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors"
          >
            Réinitialiser
          </button>
        )}

        {existingCount !== null &&
          existingCount > 0 &&
          !isExtracting &&
          !isAnalyzing && (
            <button
              onClick={clearEmails}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-md transition-colors"
            >
              Tout supprimer
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
