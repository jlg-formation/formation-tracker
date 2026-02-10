/**
 * Composant Dashboard - Affiche le tableau de bord principal
 */

import { useMemo, useState, useEffect, useCallback } from "react";
import { useFormations } from "../../hooks/useFormations";
import { calculateStats, getEmptyStats } from "../../utils/stats";
import { StatsCards } from "./StatsCards";
import { YearlyChart } from "./YearlyChart";
import { TopCoursesChart } from "./TopCoursesChart";
import { TypePieChart } from "./TypePieChart";
import { exportToJson, exportToCsv, exportToPdf } from "../../services/export";
import { db } from "../../stores/db";
import {
  runFusion,
  countAnalyzedEmails,
  type FusionState
} from "../../services/fusion";

/**
 * Dashboard principal avec statistiques et graphiques
 */
export function Dashboard() {
  const {
    formations,
    loading,
    error,
    refresh: refreshFormations
  } = useFormations();
  const [exporting, setExporting] = useState<"json" | "csv" | "pdf" | null>(
    null
  );
  const [resetting, setResetting] = useState(false);
  const [emailsCount, setEmailsCount] = useState<number>(0);
  const [unprocessedCount, setUnprocessedCount] = useState<number>(0);

  // État de la fusion
  const [analyzedCount, setAnalyzedCount] = useState<number>(0);
  const [fusionState, setFusionState] = useState<FusionState | null>(null);
  const [isFusing, setIsFusing] = useState(false);

  // Charger les compteurs d'emails
  const refreshEmailCounts = useCallback(async () => {
    const total = await db.emails.count();
    const unprocessed = await db.emails
      .filter((e) => e.processed === false)
      .count();
    setEmailsCount(total);
    setUnprocessedCount(unprocessed);

    // Compter les emails analysés prêts à fusionner
    const analyzed = await countAnalyzedEmails();
    setAnalyzedCount(analyzed.withCache);
  }, []);

  useEffect(() => {
    refreshEmailCounts();
  }, [refreshEmailCounts]);

  // Handler pour réinitialiser le flag processed
  const handleResetProcessed = async () => {
    if (
      !confirm(
        "Réinitialiser tous les emails comme 'non analysés' ? Cela permettra de relancer l'analyse LLM."
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      await db.emails.toCollection().modify({ processed: false });
      await refreshEmailCounts();
    } finally {
      setResetting(false);
    }
  };

  // Handler pour lancer la fusion
  const handleFusion = async () => {
    setIsFusing(true);
    setFusionState(null);
    try {
      await runFusion({
        geocode: true,
        onProgress: (state) => {
          setFusionState(state);
        }
      });
      // Rafraîchir les formations après fusion
      await refreshFormations();
      await refreshEmailCounts();
    } finally {
      setIsFusing(false);
    }
  };

  // Calcul des statistiques
  const stats = useMemo(() => {
    if (formations.length === 0) {
      return getEmptyStats();
    }
    return calculateStats(formations);
  }, [formations]);

  // Handlers d'export
  const handleExportJson = async () => {
    setExporting("json");
    try {
      await exportToJson(formations);
    } finally {
      setExporting(null);
    }
  };

  const handleExportCsv = () => {
    setExporting("csv");
    try {
      exportToCsv(formations);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = () => {
    setExporting("pdf");
    try {
      exportToPdf(formations, stats);
    } finally {
      setExporting(null);
    }
  };

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-600 rounded-lg text-red-400">
        <p className="font-medium">Erreur lors du chargement des formations</p>
        <p className="text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bouton de réinitialisation des emails */}
      {emailsCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-amber-900/20 border border-amber-600/50 rounded-lg">
          <div>
            <h2 className="text-lg font-medium text-amber-200">
              🔄 Réanalyser les emails
            </h2>
            <p className="text-sm text-amber-300/70 mt-1">
              {emailsCount} email{emailsCount > 1 ? "s" : ""} en cache
              {unprocessedCount > 0 && (
                <span className="ml-2 text-amber-400">
                  ({unprocessedCount} non analysé
                  {unprocessedCount > 1 ? "s" : ""})
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleResetProcessed}
            disabled={resetting || unprocessedCount === emailsCount}
            className="btn px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {resetting ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <span>🔄</span>
            )}
            {unprocessedCount === emailsCount
              ? "Tous non analysés"
              : "Marquer tous comme non analysés"}
          </button>
        </div>
      )}

      {/* Section Fusion des emails analysés */}
      {(analyzedCount > 0 || isFusing || fusionState) && (
        <div className="p-4 bg-cyan-900/20 border border-cyan-600/50 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-cyan-200">
                🔀 Fusion des emails analysés
              </h2>
              <p className="text-sm text-cyan-300/70 mt-1">
                {analyzedCount} email{analyzedCount > 1 ? "s" : ""} analysé
                {analyzedCount > 1 ? "s" : ""} prêt
                {analyzedCount > 1 ? "s" : ""} à fusionner
                {formations.length > 0 && (
                  <span className="ml-2">
                    • {formations.length} formation
                    {formations.length > 1 ? "s" : ""} existante
                    {formations.length > 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleFusion}
              disabled={isFusing || analyzedCount === 0}
              className="btn px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {isFusing ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <span>🔀</span>
              )}
              {isFusing ? "Fusion en cours..." : "Lancer la fusion"}
            </button>
          </div>

          {/* Progression de la fusion */}
          {fusionState && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-cyan-300">{fusionState.message}</p>

              {fusionState.status === "geocoding" &&
                fusionState.geocodageTotal > 0 && (
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 transition-all duration-300"
                      style={{
                        width: `${(fusionState.geocodageEnCours / fusionState.geocodageTotal) * 100}%`
                      }}
                    />
                  </div>
                )}

              {fusionState.status === "done" && (
                <div className="text-sm space-y-1 text-cyan-200">
                  <p>
                    ✅ {fusionState.formationsCreees} formation
                    {fusionState.formationsCreees > 1 ? "s" : ""} créée
                    {fusionState.formationsCreees > 1 ? "s" : ""}
                  </p>
                  <p>
                    🔄 {fusionState.formationsMisesAJour} formation
                    {fusionState.formationsMisesAJour > 1 ? "s" : ""} mise
                    {fusionState.formationsMisesAJour > 1 ? "s" : ""} à jour
                  </p>
                  <p>
                    ⏭️ {fusionState.emailsIgnores} email
                    {fusionState.emailsIgnores > 1 ? "s" : ""} ignoré
                    {fusionState.emailsIgnores > 1 ? "s" : ""}
                  </p>
                </div>
              )}

              {fusionState.status === "error" && (
                <p className="text-sm text-red-400">
                  ❌ {fusionState.errorMessage}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* En-tête avec boutons d'export */}
      {formations.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
          <div>
            <h2 className="text-lg font-medium text-gray-200">
              📊 Exporter les données
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {formations.length} formation{formations.length > 1 ? "s" : ""}{" "}
              disponible{formations.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportJson}
              disabled={exporting !== null}
              className="btn px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {exporting === "json" ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <span>📄</span>
              )}
              JSON
            </button>
            <button
              onClick={handleExportCsv}
              disabled={exporting !== null}
              className="btn px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {exporting === "csv" ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <span>📊</span>
              )}
              CSV
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting !== null}
              className="btn px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {exporting === "pdf" ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <span>📕</span>
              )}
              PDF
            </button>
          </div>
        </div>
      )}

      {/* Cartes KPI */}
      <StatsCards stats={stats} loading={loading} />

      {/* Espace réservé pour les graphiques (Étape 13) */}
      {!loading && formations.length === 0 ? (
        <div className="p-8 bg-gray-800/50 border border-dashed border-gray-600 rounded-lg text-center">
          <p className="text-gray-400 mb-2">Aucune formation enregistrée</p>
          <p className="text-sm text-gray-500">
            Utilisez le panneau d'extraction ci-dessus pour importer vos emails
            ORSYS
          </p>
        </div>
      ) : (
        <>
          {/* Graphiques principaux */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Timeline par année */}
            <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
              <h3 className="text-lg font-medium text-gray-300 mb-4">
                📈 Formations par année
              </h3>
              <YearlyChart data={stats.parAnnee} height={280} />
            </div>

            {/* Top 10 formations */}
            <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
              <h3 className="text-lg font-medium text-gray-300 mb-4">
                🏆 Top 10 formations
              </h3>
              <TopCoursesChart data={stats.parCode} height={280} />
            </div>
          </div>

          {/* Répartition Inter/Intra */}
          {(stats.inter > 0 || stats.intra > 0) && (
            <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
              <h3 className="text-lg font-medium text-gray-300 mb-4 text-center">
                🥧 Répartition Inter / Intra
              </h3>
              <div className="flex justify-center">
                <TypePieChart
                  inter={stats.inter}
                  intra={stats.intra}
                  size={280}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
