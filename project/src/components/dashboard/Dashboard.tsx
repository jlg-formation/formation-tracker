/**
 * Composant Dashboard - Affiche le tableau de bord principal
 */

import { useMemo } from "react";
import { useFormations } from "../../hooks/useFormations";
import { calculateStats, getEmptyStats } from "../../utils/stats";
import { StatsCards } from "./StatsCards";

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Placeholder Timeline par année */}
          <div className="p-6 bg-gray-800/50 border border-dashed border-indigo-600/50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-300 mb-4">
              📈 Timeline par année
            </h3>
            <p className="text-sm text-gray-500">
              Graphique D3.js à venir (Étape 13)
            </p>
            {stats.total > 0 && (
              <div className="mt-4 space-y-2">
                {Object.entries(stats.parAnnee)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([year, count]) => (
                    <div key={year} className="flex items-center gap-2">
                      <span className="text-gray-400 w-12">{year}</span>
                      <div
                        className="h-4 bg-indigo-600 rounded"
                        style={{
                          width: `${(count / Math.max(...Object.values(stats.parAnnee))) * 100}%`,
                          minWidth: "8px"
                        }}
                      ></div>
                      <span className="text-gray-500 text-sm">{count}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Placeholder Top 10 formations */}
          <div className="p-6 bg-gray-800/50 border border-dashed border-indigo-600/50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-300 mb-4">
              🏆 Top 10 formations
            </h3>
            <p className="text-sm text-gray-500">
              Graphique D3.js à venir (Étape 13)
            </p>
            {stats.parCode.length > 0 && (
              <div className="mt-4 space-y-2">
                {stats.parCode.slice(0, 5).map((item, index) => (
                  <div key={item.code} className="flex items-center gap-2">
                    <span className="text-gray-500 w-6">{index + 1}.</span>
                    <span className="text-gray-300 font-mono text-sm w-20">
                      {item.code}
                    </span>
                    <div
                      className="h-4 bg-green-600 rounded flex-1"
                      style={{
                        width: `${(item.count / stats.parCode[0].count) * 100}%`,
                        minWidth: "8px"
                      }}
                    ></div>
                    <span className="text-gray-500 text-sm w-6 text-right">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Placeholder répartition Inter/Intra */}
      {stats.total > 0 && (
        <div className="p-6 bg-gray-800/50 border border-dashed border-indigo-600/50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-300 mb-4">
            🥧 Répartition Inter / Intra
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Pie chart D3.js à venir (Étape 13)
          </p>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex h-6 rounded-lg overflow-hidden">
                <div
                  className="bg-blue-600 flex items-center justify-center text-xs text-white font-medium"
                  style={{
                    width: `${stats.total > 0 ? (stats.inter / stats.total) * 100 : 50}%`
                  }}
                >
                  {stats.inter > 0 &&
                    `${Math.round((stats.inter / stats.total) * 100)}%`}
                </div>
                <div
                  className="bg-purple-600 flex items-center justify-center text-xs text-white font-medium"
                  style={{
                    width: `${stats.total > 0 ? (stats.intra / stats.total) * 100 : 50}%`
                  }}
                >
                  {stats.intra > 0 &&
                    `${Math.round((stats.intra / stats.total) * 100)}%`}
                </div>
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-600 rounded"></div>
                <span className="text-gray-400">Inter ({stats.inter})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-600 rounded"></div>
                <span className="text-gray-400">Intra ({stats.intra})</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
