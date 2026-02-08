/**
 * Composant Dashboard - Affiche le tableau de bord principal
 */

import { useMemo } from "react";
import { useFormations } from "../../hooks/useFormations";
import { calculateStats, getEmptyStats } from "../../utils/stats";
import { StatsCards } from "./StatsCards";
import { YearlyChart } from "./YearlyChart";
import { TopCoursesChart } from "./TopCoursesChart";
import { TypePieChart } from "./TypePieChart";

/**
 * Dashboard principal avec statistiques et graphiques
 */
export function Dashboard() {
  const { formations, loading, error } = useFormations();

  // Calcul des statistiques
  const stats = useMemo(() => {
    if (formations.length === 0) {
      return getEmptyStats();
    }
    return calculateStats(formations);
  }, [formations]);

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
