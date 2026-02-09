/**
 * Export CSV service
 * Exporte les formations au format CSV pour tableurs (Excel, Google Sheets)
 */

import type { Formation } from "../../types";
import { downloadFile, escapeCsv } from "./utils";

/**
 * En-têtes CSV pour l'export des formations
 */
const CSV_HEADERS = [
  "ID",
  "Code",
  "Titre",
  "Statut",
  "Date Debut",
  "Date Fin",
  "Jours",
  "Lieu",
  "Adresse",
  "Latitude",
  "Longitude",
  "Type",
  "Niveau",
  "Participants",
  "Client",
  "Entite Facturation",
  "Reference Intra"
];

/**
 * Convertit une formation en ligne CSV
 */
function formationToCsvRow(formation: Formation): string[] {
  return [
    formation.id,
    formation.codeEtendu || "",
    escapeCsv(formation.titre),
    formation.statut,
    formation.dateDebut,
    formation.dateFin,
    String(formation.nombreJours || 0),
    escapeCsv(formation.lieu?.nom || ""),
    escapeCsv(formation.lieu?.adresse || ""),
    String(formation.lieu?.gps?.lat ?? ""),
    String(formation.lieu?.gps?.lng ?? ""),
    formation.typeSession || "",
    formation.niveauPersonnalisation || "",
    String(formation.nombreParticipants || 0),
    escapeCsv(formation.client || ""),
    escapeCsv(formation.facturation?.entite || ""),
    escapeCsv(formation.facturation?.referenceIntra || "")
  ];
}

/**
 * Génère le contenu CSV
 */
export function generateCsvContent(formations: Formation[]): string {
  const rows = formations.map(formationToCsvRow);

  const csvContent = [
    CSV_HEADERS.join(","),
    ...rows.map((row) => row.join(","))
  ].join("\n");

  // BOM UTF-8 pour Excel
  const bom = "\uFEFF";
  return bom + csvContent;
}

/**
 * Exporte les formations au format CSV
 * @param formations Liste des formations à exporter
 * @param filename Nom du fichier (défaut: orsys-formations.csv)
 */
export function exportToCsv(
  formations: Formation[],
  filename = "orsys-formations.csv"
): void {
  const csvContent = generateCsvContent(formations);
  downloadFile(csvContent, filename, "text/csv;charset=utf-8");
}

/**
 * Interface pour les options d'export CSV
 */
export interface CsvExportOptions {
  /** Inclure les formations annulées */
  includeAnnulees?: boolean;
  /** Filtrer par type de session */
  typeSession?: "inter" | "intra";
  /** Plage de dates */
  dateRange?: { start: string; end: string };
}

/**
 * Exporte les formations avec options de filtrage
 */
export function exportToCsvWithOptions(
  formations: Formation[],
  options: CsvExportOptions = {},
  filename = "orsys-formations.csv"
): void {
  let filtered = formations;

  // Filtrer les annulées si demandé
  if (options.includeAnnulees === false) {
    filtered = filtered.filter((f) => f.statut !== "annulée");
  }

  // Filtrer par type
  if (options.typeSession) {
    filtered = filtered.filter((f) => f.typeSession === options.typeSession);
  }

  // Filtrer par plage de dates
  if (options.dateRange) {
    const { start, end } = options.dateRange;
    filtered = filtered.filter((f) => {
      const date = f.dateDebut;
      return date >= start && date <= end;
    });
  }

  exportToCsv(filtered, filename);
}
