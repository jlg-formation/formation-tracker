/**
 * Composant StatsCards - Affiche les 4 KPI principaux
 */

import type { FormationStats } from "../../utils/stats";

interface StatCardProps {
  /** Icône (emoji) */
  icon: string;
  /** Valeur à afficher */
  value: number | string;
  /** Label descriptif */
  label: string;
  /** Sous-label optionnel */
  sublabel?: string;
  /** Couleur de l'icône (classes Tailwind) */
  iconColor?: string;
}

function StatCard({
  icon,
  value,
  label,
  sublabel,
  iconColor = "text-blue-400"
}: StatCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 md:p-6 shadow-md">
      <div className="flex items-center gap-3 md:gap-4">
        <div
          className={`text-2xl md:text-3xl ${iconColor}`}
          role="img"
          aria-hidden="true"
        >
          {icon}
        </div>
        <div>
          <div className="text-2xl md:text-3xl font-bold text-white">
            {value}
          </div>
          <div className="text-sm md:text-base text-gray-400">{label}</div>
          {sublabel && (
            <div className="text-xs text-gray-500 mt-1">{sublabel}</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatsCardsProps {
  /** Statistiques à afficher */
  stats: FormationStats;
  /** Indicateur de chargement */
  loading?: boolean;
}

/**
 * Affiche les 4 cartes KPI principales du dashboard
 */
export function StatsCards({ stats, loading = false }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-800 rounded-lg p-4 md:p-6 shadow-md animate-pulse"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-700 rounded-lg"></div>
              <div className="flex-1">
                <div className="h-8 bg-gray-700 rounded w-16 mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-24"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Calcul du taux de réussite (formations non annulées)
  const tauxReussite =
    stats.total > 0
      ? Math.round(((stats.total - stats.annulees) / stats.total) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon="📊"
        value={stats.total}
        label="Formations"
        sublabel="Depuis 2014"
        iconColor="text-blue-400"
      />
      <StatCard
        icon="📅"
        value={stats.totalJours}
        label="Jours de formation"
        sublabel={`${stats.total - stats.annulees} sessions réalisées`}
        iconColor="text-green-400"
      />
      <StatCard
        icon="👥"
        value={stats.totalParticipants}
        label="Participants"
        sublabel={
          stats.total > 0
            ? `~${Math.round(stats.totalParticipants / stats.total)} par session`
            : undefined
        }
        iconColor="text-purple-400"
      />
      <StatCard
        icon={stats.annulees > 0 ? "❌" : "✅"}
        value={`${tauxReussite}%`}
        label="Taux de réussite"
        sublabel={`${stats.annulees} annulation${stats.annulees > 1 ? "s" : ""}`}
        iconColor={stats.annulees > 0 ? "text-red-400" : "text-green-400"}
      />
    </div>
  );
}
