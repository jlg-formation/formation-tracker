/**
 * Utilitaires de calcul des statistiques pour le Dashboard
 */

import type { Formation } from "../types";
import { StatutFormation, TypeSession } from "../types";

/**
 * Statistiques globales des formations
 * Note: Tous les comptages sont hors formations annulées, sauf `annulees`
 */
export interface FormationStats {
  /** Nombre total de formations (hors annulées) */
  total: number;
  /** Nombre de formations annulées */
  annulees: number;
  /** Nombre total de jours de formation (hors annulées) */
  totalJours: number;
  /** Nombre total de participants (hors annulées) */
  totalParticipants: number;
  /** Nombre de formations inter (hors annulées) */
  inter: number;
  /** Nombre de formations intra (hors annulées) */
  intra: number;
  /** Répartition par année (hors annulées) */
  parAnnee: Record<number, number>;
  /** Répartition par code formation (top 10, hors annulées) */
  parCode: Array<{ code: string; count: number; titre: string }>;
}

/**
 * Calcule toutes les statistiques à partir des formations
 * Note: Les formations annulées sont exclues de tous les comptages sauf `annulees`
 */
export function calculateStats(formations: Formation[]): FormationStats {
  const stats: FormationStats = {
    total: 0,
    annulees: 0,
    totalJours: 0,
    totalParticipants: 0,
    inter: 0,
    intra: 0,
    parAnnee: {},
    parCode: []
  };

  // Map pour compter par code formation (hors annulées)
  const codeCount = new Map<string, { count: number; titre: string }>();

  for (const formation of formations) {
    // Comptage des annulations (séparé)
    if (formation.statut === StatutFormation.ANNULEE) {
      stats.annulees++;
      // Les formations annulées ne sont pas comptées dans les autres stats
      continue;
    }

    // Total des formations (hors annulées)
    stats.total++;

    // Total des jours (hors annulées)
    stats.totalJours += formation.nombreJours || 0;

    // Total des participants (hors annulées)
    stats.totalParticipants += formation.nombreParticipants || 0;

    // Répartition inter/intra (hors annulées)
    if (formation.typeSession === TypeSession.INTER) {
      stats.inter++;
    } else if (formation.typeSession === TypeSession.INTRA) {
      stats.intra++;
    }

    // Répartition par année (hors annulées)
    if (formation.dateDebut) {
      const year = new Date(formation.dateDebut).getFullYear();
      if (!isNaN(year)) {
        stats.parAnnee[year] = (stats.parAnnee[year] || 0) + 1;
      }
    }

    // Comptage par code formation (hors annulées)
    const code = formation.codeEtendu || formation.codeFormation || "INCONNU";
    const existing = codeCount.get(code);
    if (existing) {
      existing.count++;
    } else {
      codeCount.set(code, { count: 1, titre: formation.titre });
    }
  }

  // Tri et extraction du top 10 des codes
  stats.parCode = Array.from(codeCount.entries())
    .map(([code, data]) => ({ code, count: data.count, titre: data.titre }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return stats;
}

/**
 * Calcule le pourcentage de formations annulées
 * Note: Basé sur le total incluant les annulées (total + annulees)
 */
export function calculateCancellationRate(stats: FormationStats): number {
  const totalWithCancelled = stats.total + stats.annulees;
  if (totalWithCancelled === 0) return 0;
  return Math.round((stats.annulees / totalWithCancelled) * 100);
}

/**
 * Calcule le pourcentage de formations inter
 */
export function calculateInterRate(stats: FormationStats): number {
  if (stats.total === 0) return 0;
  return Math.round((stats.inter / stats.total) * 100);
}

/**
 * Calcule le pourcentage de formations intra
 */
export function calculateIntraRate(stats: FormationStats): number {
  if (stats.total === 0) return 0;
  return Math.round((stats.intra / stats.total) * 100);
}

/**
 * Calcule la moyenne de jours par formation (hors annulées)
 */
export function calculateAvgDaysPerFormation(stats: FormationStats): number {
  if (stats.total === 0) return 0;
  return Math.round((stats.totalJours / stats.total) * 10) / 10;
}

/**
 * Calcule la moyenne de participants par formation
 */
export function calculateAvgParticipantsPerFormation(
  stats: FormationStats
): number {
  if (stats.total === 0) return 0;
  return Math.round((stats.totalParticipants / stats.total) * 10) / 10;
}

/**
 * Retourne les années triées
 */
export function getSortedYears(parAnnee: Record<number, number>): number[] {
  return Object.keys(parAnnee)
    .map(Number)
    .sort((a, b) => a - b);
}

/**
 * Statistiques vides (pour l'état initial)
 */
export function getEmptyStats(): FormationStats {
  return {
    total: 0,
    annulees: 0,
    totalJours: 0,
    totalParticipants: 0,
    inter: 0,
    intra: 0,
    parAnnee: {},
    parCode: []
  };
}
