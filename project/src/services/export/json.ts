/**
 * Export JSON service
 * Exporte les formations au format JSON pour sauvegarde/réimport
 */

import type { Formation, ExportData, ExtractionMetadata } from "../../types";
import { db } from "../../stores/db";
import { downloadFile } from "./utils";

/**
 * Génère les métadonnées d'export
 */
export async function generateExportMetadata(
  formations: Formation[]
): Promise<ExtractionMetadata> {
  const annulees = formations.filter((f) => f.statut === "annulée").length;
  let emailsTraites = 0;

  try {
    emailsTraites = await db.emails.count();
  } catch {
    // Si la table n'existe pas encore
    emailsTraites = 0;
  }

  return {
    dateExtraction: new Date().toISOString(),
    totalFormations: formations.length,
    formationsAnnulees: annulees,
    emailsTraites,
    emailsIgnores: 0
  };
}

/**
 * Exporte les formations au format JSON
 * @param formations Liste des formations à exporter
 * @param filename Nom du fichier (défaut: orsys-formations.json)
 */
export async function exportToJson(
  formations: Formation[],
  filename = "orsys-formations.json"
): Promise<void> {
  const metadata = await generateExportMetadata(formations);

  const exportData: ExportData = {
    metadata,
    formations
  };

  const json = JSON.stringify(exportData, null, 2);
  downloadFile(json, filename, "application/json");
}

/**
 * Génère le contenu JSON sans téléchargement (pour tests)
 */
export async function generateJsonContent(
  formations: Formation[]
): Promise<string> {
  const metadata = await generateExportMetadata(formations);

  const exportData: ExportData = {
    metadata,
    formations
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Parse un fichier JSON d'export et valide sa structure
 */
export function parseExportJson(content: string): ExportData {
  const data = JSON.parse(content);

  // Validation basique de la structure
  if (!data.metadata || !Array.isArray(data.formations)) {
    throw new Error("Format JSON invalide: metadata ou formations manquants");
  }

  if (typeof data.metadata.totalFormations !== "number") {
    throw new Error("Format JSON invalide: totalFormations manquant");
  }

  return data as ExportData;
}
