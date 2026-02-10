/**
 * Panneau d'extraction des emails Gmail ORSYS
 * Permet d'extraire et stocker les emails Gmail dans IndexedDB
 * puis de les analyser via LLM pour créer des formations
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useGmailAuth } from "../../hooks/useGmailAuth";
import {
  fetchAllMessageIds,
  getMessage,
  getMessageMetadata,
  extractEmailHeaders,
  extractEmailBody,
  shouldExcludeEmail
} from "../../services/gmail";
import {
  analyzeEmailBatchWithCache,
  isLLMError,
  type AnalysisAbortSignal
} from "../../services/llm";
import { db } from "../../stores/db";
import { getSettings } from "../../stores/settingsStore";
import {
  countLLMCacheEntries,
  clearLLMCache
} from "../../stores/llmCacheStore";
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
  /** Emails exclus par filtrage regex (économie LLM) */
  filteredEmails: number;
  errorMessage?: string;
}

/** État de l'analyse LLM */
interface AnalysisState {
  status: "idle" | "analyzing" | "paused" | "done" | "error";
  currentCount: number;
  totalCount: number;
  message: string;
  /** Emails analysés avec succès */
  emailsAnalyses: number;
  emailsIgnores: number;
  emailsEnErreur: number;
  /** Emails analysés depuis le cache (économie LLM) */
  fromCache: number;
  /** Emails analysés via appel LLM */
  fromLLM: number;
  errorMessage?: string;
}

const initialState: ExtractionState = {
  status: "idle",
  currentCount: 0,
  totalCount: 0,
  message: "",
  newEmails: 0,
  skippedEmails: 0,
  filteredEmails: 0
};

const initialAnalysisState: AnalysisState = {
  status: "idle",
  currentCount: 0,
  totalCount: 0,
  message: "",
  emailsAnalyses: 0,
  emailsIgnores: 0,
  emailsEnErreur: 0,
  fromCache: 0,
  fromLLM: 0
};

export function ExtractionPanel() {
  const { connectionState } = useGmailAuth();
  const [state, setState] = useState<ExtractionState>(initialState);
  const [analysisState, setAnalysisState] =
    useState<AnalysisState>(initialAnalysisState);
  const [existingCount, setExistingCount] = useState<number | null>(null);
  const [unprocessedCount, setUnprocessedCount] = useState<number | null>(null);
  const [formationsCount, setFormationsCount] = useState<number | null>(null);
  const [cacheCount, setCacheCount] = useState<number | null>(null);

  // Signal pour interrompre l'analyse
  const abortSignalRef = useRef<AnalysisAbortSignal>({ aborted: false });
  // Emails en attente pour reprise après pause
  const pendingEmailsRef = useRef<EmailRaw[]>([]);

  // Charger les compteurs au montage et après les opérations
  const refreshCounts = useCallback(async () => {
    const emailCount = await db.emails.count();
    const unprocessed = await db.emails
      .filter((e) => e.processed === false)
      .count();
    const formations = await db.formations.count();
    const cache = await countLLMCacheEntries();
    setExistingCount(emailCount);
    setUnprocessedCount(unprocessed);
    setFormationsCount(formations);
    setCacheCount(cache);
  }, []);

  // Rafraîchir uniquement le compteur des non-analysés (pour mise à jour temps réel)
  const refreshUnprocessedCount = useCallback(async () => {
    const unprocessed = await db.emails
      .filter((e) => e.processed === false)
      .count();
    setUnprocessedCount(unprocessed);
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  const isConnected = connectionState.status === "connected";
  const isExtracting =
    state.status === "fetching-ids" || state.status === "fetching-content";
  const isAnalyzing = analysisState.status === "analyzing";
  const isPaused = analysisState.status === "paused";

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
      let filteredEmails = 0;

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
          // Filtrage à la source (clarification 010) :
          // Récupérer d'abord les métadonnées (sujet) AVANT le contenu complet
          // Les emails filtrés ne sont JAMAIS récupérés en entier ni stockés
          const metadata = await getMessageMetadata(messageId);
          const isExcluded = shouldExcludeEmail(metadata.subject);

          if (isExcluded) {
            // Email filtré : ne pas récupérer le contenu, ne pas stocker
            filteredEmails++;
            setState((prev) => ({
              ...prev,
              currentCount: i + 1,
              filteredEmails,
              message: `Téléchargement des emails... (${i + 1}/${messageIds.length})`
            }));
            continue;
          }

          // Récupérer le contenu complet du message (uniquement si non filtré)
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
            filteredEmails,
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

      // Construire le message de fin
      const messageParts: string[] = [];
      if (newEmails > 0) {
        messageParts.push(`${newEmails} nouveaux emails à analyser`);
      }
      if (filteredEmails > 0) {
        messageParts.push(`${filteredEmails} emails filtrés (économie LLM)`);
      }
      const finalMessage =
        messageParts.length > 0
          ? `Extraction terminée : ${messageParts.join(", ")}.`
          : "Extraction terminée : aucun nouvel email.";

      setState({
        status: "done",
        currentCount: messageIds.length,
        totalCount: messageIds.length,
        newEmails,
        skippedEmails,
        filteredEmails,
        message: finalMessage
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
   * Utilise le cache pour éviter les appels LLM redondants
   * Supporte la pause/reprise
   */
  const startAnalysis = useCallback(
    async (resumeFromPause = false) => {
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

      // Récupérer les emails à analyser (reprise ou nouveaux)
      let emailsToAnalyze: EmailRaw[];
      if (resumeFromPause && pendingEmailsRef.current.length > 0) {
        emailsToAnalyze = pendingEmailsRef.current;
      } else {
        emailsToAnalyze = await db.emails
          .filter((e) => e.processed === false)
          .toArray();
        pendingEmailsRef.current = emailsToAnalyze;
      }

      if (emailsToAnalyze.length === 0) {
        setAnalysisState({
          ...initialAnalysisState,
          status: "done",
          message: "Aucun email à analyser."
        });
        pendingEmailsRef.current = [];
        return;
      }

      // Réinitialiser le signal d'abort
      abortSignalRef.current = { aborted: false };

      // État initial ou reprise
      const previousState = resumeFromPause
        ? analysisState
        : initialAnalysisState;
      setAnalysisState({
        ...previousState,
        status: "analyzing",
        totalCount:
          emailsToAnalyze.length +
          (resumeFromPause ? previousState.currentCount : 0),
        message: resumeFromPause
          ? "Reprise de l'analyse..."
          : "Analyse des emails..."
      });

      let analyzedCount = resumeFromPause ? previousState.emailsAnalyses : 0;
      let ignoredCount = resumeFromPause ? previousState.emailsIgnores : 0;
      let fromCacheCount = resumeFromPause ? previousState.fromCache : 0;
      let fromLLMCount = resumeFromPause ? previousState.fromLLM : 0;

      try {
        // Convertir les emails en format EmailInput
        const emailInputs = emailsToAnalyze.map((email) => ({
          id: email.id,
          subject: email.subject,
          body: email.body
        }));

        // Analyser les emails avec cache et support d'interruption
        const { results, stats } = await analyzeEmailBatchWithCache(
          emailInputs,
          settings.openaiApiKey,
          {
            useCache: true,
            abortSignal: abortSignalRef.current,
            delayBetweenCalls: settings.llmDelayMs ?? 3000,
            onProgress: (current, total, progressStats) => {
              fromCacheCount =
                (resumeFromPause ? previousState.fromCache : 0) +
                progressStats.fromCache;
              fromLLMCount =
                (resumeFromPause ? previousState.fromLLM : 0) +
                progressStats.fromLLM;

              setAnalysisState((prev) => ({
                ...prev,
                currentCount:
                  (resumeFromPause ? previousState.currentCount : 0) + current,
                fromCache: fromCacheCount,
                fromLLM: fromLLMCount,
                emailsEnErreur: progressStats.errors,
                message: `Analyse ${current}/${total}... (${progressStats.fromCache} en cache, ${progressStats.fromLLM} LLM)`
              }));
            },
            // Callback appelé immédiatement après chaque email analysé
            onEmailProcessed: async (emailId, analyzeResult) => {
              const email = emailsToAnalyze.find((e) => e.id === emailId);
              if (!email) return;

              // NE PAS marquer comme traité si erreur (ex: 429, timeout, etc.)
              // L'email sera réanalysé lors de la prochaine tentative
              if (analyzeResult.error) {
                console.warn(
                  `Email ${emailId} en erreur, ne sera pas marqué comme traité:`,
                  analyzeResult.error
                );
                return;
              }

              const classification = analyzeResult.classification;
              // Note: extraction est disponible dans analyzeResult.extraction si nécessaire

              // Marquer comme traité uniquement si l'analyse a réussi
              const emailToMark = await db.emails.get(emailId);
              if (emailToMark) {
                await db.emails.put({ ...emailToMark, processed: true });
                // Rafraîchir le compteur des emails non analysés en temps réel
                await refreshUnprocessedCount();
              }

              // Ignorer les emails non pertinents (pour le comptage)
              if (
                classification.type === TypeEmail.AUTRE ||
                classification.type === TypeEmail.RAPPEL ||
                classification.confidence < 0.7
              ) {
                ignoredCount++;
              } else {
                analyzedCount++;
              }
            }
          }
        );

        // Mettre à jour les statistiques de cache
        fromCacheCount =
          (resumeFromPause ? previousState.fromCache : 0) + stats.fromCache;
        fromLLMCount =
          (resumeFromPause ? previousState.fromLLM : 0) + stats.fromLLM;

        // Si l'analyse a été interrompue, garder les emails restants pour reprise
        if (stats.aborted) {
          const processedIds = new Set(results.keys());
          pendingEmailsRef.current = emailsToAnalyze.filter(
            (e) => !processedIds.has(e.id)
          );
        }

        // Rafraîchir les compteurs
        await refreshCounts();

        // Mise à jour finale de l'état
        if (stats.aborted) {
          setAnalysisState((prev) => ({
            ...prev,
            status: "paused",
            emailsAnalyses: analyzedCount,
            emailsIgnores: ignoredCount,
            fromCache: fromCacheCount,
            fromLLM: fromLLMCount,
            message: `Analyse en pause. ${pendingEmailsRef.current.length} emails restants.`
          }));
        } else {
          pendingEmailsRef.current = [];
          const doneMessage =
            stats.errors > 0
              ? `Analyse terminée. ${stats.errors} email(s) en erreur. Lancez la fusion depuis le Dashboard.`
              : "Analyse terminée. Lancez la fusion depuis le Dashboard pour générer les formations.";

          setAnalysisState({
            status: "done",
            currentCount: stats.processed,
            totalCount: stats.total,
            message: doneMessage,
            emailsAnalyses: analyzedCount,
            emailsIgnores: ignoredCount,
            emailsEnErreur: stats.errors,
            fromCache: fromCacheCount,
            fromLLM: fromLLMCount
          });
        }
      } catch (error) {
        await refreshCounts();

        // Extraire le message d'erreur lisible
        let errorMessage: string;
        let userFriendlyMessage: string;

        if (isLLMError(error)) {
          errorMessage = error.message;
          userFriendlyMessage = error.userMessage || error.message;
        } else if (error instanceof Error) {
          errorMessage = error.message;
          userFriendlyMessage = error.message;
        } else {
          errorMessage = "Erreur inconnue";
          userFriendlyMessage = "Erreur inconnue";
        }

        setAnalysisState((prev) => ({
          ...prev,
          status: "error",
          emailsAnalyses: analyzedCount,
          emailsIgnores: ignoredCount,
          fromCache: fromCacheCount,
          fromLLM: fromLLMCount,
          errorMessage: userFriendlyMessage,
          message: `Erreur: ${errorMessage}`
        }));
      }
    },
    [analysisState, refreshCounts, refreshUnprocessedCount]
  );

  /**
   * Met en pause l'analyse en cours
   */
  const pauseAnalysis = useCallback(() => {
    abortSignalRef.current.aborted = true;
  }, []);

  /**
   * Reprend l'analyse après une pause
   */
  const resumeAnalysis = useCallback(() => {
    startAnalysis(true);
  }, [startAnalysis]);

  /**
   * Réinitialiser l'état
   */
  const resetState = useCallback(() => {
    setState(initialState);
    setAnalysisState(initialAnalysisState);
    pendingEmailsRef.current = [];
    abortSignalRef.current = { aborted: false };
  }, []);

  /**
   * Supprimer tous les emails et formations stockés
   */
  const clearEmails = useCallback(async () => {
    if (
      !confirm(
        "Êtes-vous sûr de vouloir supprimer tous les emails, formations ET le cache d'analyse ?"
      )
    ) {
      return;
    }
    await db.emails.clear();
    await db.formations.clear();
    await clearLLMCache();
    await refreshCounts();
    setState(initialState);
    setAnalysisState(initialAnalysisState);
    pendingEmailsRef.current = [];
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
              en attente d'analyse
            </p>
          )}
          {unprocessedCount === 0 &&
            existingCount !== null &&
            existingCount > 0 && (
              <p className="text-green-400 text-sm">
                ✅ Tous les emails ont été analysés
              </p>
            )}
          {formationsCount !== null && formationsCount > 0 && (
            <p className="text-green-400 text-sm">
              ✅ <span className="font-medium">{formationsCount}</span>{" "}
              formations extraites
            </p>
          )}
          {cacheCount !== null && cacheCount > 0 && (
            <p className="text-blue-400 text-sm">
              💾 <span className="font-medium">{cacheCount}</span> analyses en
              cache (économie LLM)
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
              Filtrés :{" "}
              <span className="text-yellow-400">{state.filteredEmails}</span>
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
              `${state.skippedEmails} emails déjà présents ignorés. `}
            {state.filteredEmails > 0 &&
              `${state.filteredEmails} emails filtrés par regex (économie LLM).`}
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
      {(isAnalyzing || isPaused) && (
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
              className={`h-full transition-all duration-300 ${isPaused ? "bg-yellow-500" : "bg-green-500"}`}
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
          <div className="flex gap-4 text-xs text-gray-500">
            <span>
              Cache :{" "}
              <span className="text-blue-400">{analysisState.fromCache}</span>
            </span>
            <span>
              LLM :{" "}
              <span className="text-green-400">{analysisState.fromLLM}</span>
            </span>
            {analysisState.emailsEnErreur > 0 && (
              <span>
                Erreurs :{" "}
                <span className="text-red-400">
                  {analysisState.emailsEnErreur}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Message de pause */}
      {isPaused && (
        <div className="mb-4 p-4 bg-yellow-900/30 border border-yellow-600 rounded-lg text-yellow-300">
          <p className="font-medium">⏸️ Analyse en pause</p>
          <p className="text-sm mt-1">
            {pendingEmailsRef.current.length} emails restants à analyser.
            Cliquez sur "Reprendre" pour continuer.
          </p>
        </div>
      )}

      {/* Message de résultat analyse */}
      {analysisState.status === "done" && (
        <div className="mb-4 p-4 bg-green-900/30 border border-green-600 rounded-lg text-green-300">
          <p className="font-medium">{analysisState.message}</p>
          <div className="text-sm mt-2 space-y-1">
            <p>✅ {analysisState.emailsAnalyses} emails analysés avec succès</p>
            <p>
              ⏭️ {analysisState.emailsIgnores} emails ignorés (rappels, autres)
            </p>
            <p className="text-blue-300">
              💾 {analysisState.fromCache} depuis le cache,{" "}
              {analysisState.fromLLM} appels LLM
            </p>
            {analysisState.emailsEnErreur > 0 && (
              <p className="text-yellow-300">
                ⚠️ {analysisState.emailsEnErreur} emails en erreur (relancez
                l'analyse pour réessayer)
              </p>
            )}
            <p className="text-cyan-300 mt-2">
              🔀 Allez sur le{" "}
              <Link to="/" className="underline hover:text-cyan-100">
                Dashboard
              </Link>{" "}
              pour lancer la fusion et générer les formations.
            </p>
          </div>
        </div>
      )}

      {/* Message d'erreur analyse */}
      {analysisState.status === "error" && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-600 rounded-lg text-red-300">
          <p className="font-medium">Erreur lors de l'analyse</p>
          <p className="text-sm mt-1">{analysisState.errorMessage}</p>
          <div className="text-sm mt-2 space-y-1 text-red-200">
            <p>✅ {analysisState.emailsAnalyses} emails analysés</p>
            <p>⏭️ {analysisState.emailsIgnores} emails ignorés</p>
            <p>
              💾 {analysisState.fromCache} depuis le cache,{" "}
              {analysisState.fromLLM} appels LLM
            </p>
          </div>
        </div>
      )}

      {/* Boutons d'action */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={startExtraction}
          disabled={!isConnected || isExtracting || isAnalyzing}
          className="btn px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors flex items-center gap-2"
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

        {/* Bouton Analyser - visible pendant l'analyse ou s'il reste des emails */}
        {(isAnalyzing ||
          (unprocessedCount !== null && unprocessedCount > 0)) && (
          <button
            onClick={() => startAnalysis(false)}
            disabled={
              isExtracting || isAnalyzing || isPaused || unprocessedCount === 0
            }
            className="btn px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors flex items-center gap-2"
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

        {/* Bouton Pause */}
        {isAnalyzing && (
          <button
            onClick={pauseAnalysis}
            className="btn px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md transition-colors flex items-center gap-2"
          >
            <span>⏸️</span>
            Pause
          </button>
        )}

        {/* Bouton Reprendre */}
        {isPaused && (
          <button
            onClick={resumeAnalysis}
            className="btn px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors flex items-center gap-2"
          >
            <span>▶️</span>
            Reprendre
          </button>
        )}

        {(state.status === "done" ||
          state.status === "error" ||
          analysisState.status === "done" ||
          analysisState.status === "error" ||
          isPaused) && (
          <button
            onClick={resetState}
            className="btn px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors"
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
              className="btn px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-md transition-colors"
            >
              Tout supprimer
            </button>
          )}
      </div>

      {/* Aide */}
      <p className="mt-4 text-xs text-gray-500">
        L'extraction recherche tous les emails provenant de @orsys.fr depuis
        2014. Les emails déjà stockés sont ignorés. Les analyses LLM sont mises
        en cache pour économiser les appels API.
      </p>
    </section>
  );
}
