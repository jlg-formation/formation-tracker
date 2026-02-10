import type { Formation } from "../types";

export type PeriodeCarte = "passees" | "futures" | "les-deux";

type TemporalStatus = "passee" | "future" | "en-cours" | "inconnue";

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function parseIsoDateAsLocalMidnight(dateStr?: string): Date | null {
  if (!dateStr) return null;
  // Dates attendues: YYYY-MM-DD
  const [y, m, d] = dateStr.split("-").map((v) => Number(v));
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getFormationTemporalStatus(
  formation: Pick<Formation, "dateDebut" | "dateFin">,
  now: Date = new Date()
): TemporalStatus {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const debut = parseIsoDateAsLocalMidnight(formation.dateDebut);
  const fin = parseIsoDateAsLocalMidnight(
    formation.dateFin || formation.dateDebut
  );

  if (!debut || !fin) return "inconnue";

  if (fin.getTime() < today.getTime()) return "passee";
  if (debut.getTime() > today.getTime()) return "future";
  return "en-cours";
}

export function filterFormationsByPeriode(
  formations: Formation[],
  periode: PeriodeCarte,
  now: Date = startOfToday()
): Formation[] {
  if (periode === "les-deux") return formations;

  return formations.filter((f) => {
    const status = getFormationTemporalStatus(f, now);
    if (periode === "passees") return status === "passee";
    if (periode === "futures") return status === "future";
    return true;
  });
}
