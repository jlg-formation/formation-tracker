/**
 * Utilitaires de calcul des statistiques pour le Dashboard
 */

import type { Formation } from "../types";
import { StatutFormation, TypeSession } from "../types";

/**
 * Statistiques globales des formations
 */
export interface FormationStats {
  /** Nombre total de formations */
  total: number;
  /** Nombre de formations annulées */
  annulees: number;
  /** Nombre total de jours de formation */
  totalJours: number;
  /** Nombre total de participants */
  totalParticipants: number;
  /** Nombre de formations inter */
  inter: number;
  /** Nombre de formations intra */
  intra: number;
  /** Répartition par année */
  parAnnee: Record<number, number>;
  /** Répartition par code formation (top 10) */
  parCode: Array<{ code: string; count: number; titre: string }>;
}

/**
 * Calcule toutes les statistiques à partir des formations
 */
export function calculateStats(formations: Formation[]): FormationStats {
  const stats: FormationStats = {
    total: formations.length,
    annulees: 0,
    totalJours: 0,
    totalParticipants: 0,
    inter: 0,
    intra: 0,
    parAnnee: {},
    parCode: []
  };

  // Map pour compter par code formation
  const codeCount = new Map<string, { count: number; titre: string }>();

  for (const formation of formations) {
    // Comptage des annulations
    if (formation.statut === StatutFormation.ANNULEE) {
      stats.annulees++;
    }

    // Total des jours (uniquement formations confirmées)
    if (formation.statut === StatutFormation.CONFIRMEE) {
      stats.totalJours += formation.nombreJours || 0;
    }

    // Total des participants
    stats.totalParticipants += formation.nombreParticipants || 0;

    // Répartition inter/intra
    if (formation.typeSession === TypeSession.INTER) {
      stats.inter++;
    } else if (formation.typeSession === TypeSession.INTRA) {
      stats.intra++;
    }

    // Répartition par année
    if (formation.dateDebut) {
      const year = new Date(formation.dateDebut).getFullYear();
      if (!isNaN(year)) {
        stats.parAnnee[year] = (stats.parAnnee[year] || 0) + 1;
      }
    }

    // Comptage par code formation
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
 */
export function calculateCancellationRate(stats: FormationStats): number {
  if (stats.total === 0) return 0;
  return Math.round((stats.annulees / stats.total) * 100);
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
 * Calcule la moyenne de jours par formation
 */
export function calculateAvgDaysPerFormation(stats: FormationStats): number {
  const confirmed = stats.total - stats.annulees;
  if (confirmed === 0) return 0;
  return Math.round((stats.totalJours / confirmed) * 10) / 10;
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
