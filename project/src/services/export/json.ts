/**
 * Export JSON service
 * Exporte la totalité de la base IndexedDB pour sauvegarde/réimport
 */

import type { Formation, ExportData, ExtractionMetadata } from "../../types";
import { db } from "../../stores/db";
import { downloadFile } from "./utils";

/**
 * Génère les métadonnées d'export
 */
export async function generateExportMetadata(): Promise<ExtractionMetadata> {
  let formations: Formation[] = [];
  let emailsCount = 0;
  let geocacheCount = 0;
  let llmCacheCount = 0;

  try {
    formations = await db.formations.toArray();
  } catch {
    formations = [];
  }

  try {
    emailsCount = await db.emails.count();
  } catch {
    emailsCount = 0;
  }

  try {
    geocacheCount = await db.geocache.count();
  } catch {
    geocacheCount = 0;
  }

  try {
    llmCacheCount = await db.llmCache.count();
  } catch {
    llmCacheCount = 0;
  }

  const annulees = formations.filter((f) => f.statut === "annulée").length;

  return {
    dateExtraction: new Date().toISOString(),
    totalFormations: formations.length,
    formationsAnnulees: annulees,
    emailsTraites: emailsCount,
    emailsIgnores: 0,
    geocacheEntries: geocacheCount,
    llmCacheEntries: llmCacheCount
  };
}

/**
 * Exporte TOUTES les données de la base IndexedDB au format JSON
 * Inclut: formations, emails, geocache, llmCache
 * @param filename Nom du fichier (défaut: orsys-backup.json)
 */
export async function exportToJson(
  formations?: Formation[],
  filename = "orsys-backup.json"
): Promise<void> {
  // Récupérer toutes les données
  const allFormations = formations || (await db.formations.toArray());
  const allEmails = await db.emails.toArray();
  const allGeocache = await db.geocache.toArray();
  const allLlmCache = await db.llmCache.toArray();

  const metadata = await generateExportMetadata();

  const exportData: ExportData = {
    metadata,
    formations: allFormations,
    emails: allEmails,
    geocache: allGeocache,
    llmCache: allLlmCache
  };

  const json = JSON.stringify(exportData, null, 2);
  downloadFile(json, filename, "application/json");
}

/**
 * Génère le contenu JSON sans téléchargement (pour tests)
 */
export async function generateJsonContent(
  formations?: Formation[]
): Promise<string> {
  const allFormations = formations || (await db.formations.toArray());
  const allEmails = await db.emails.toArray();
  const allGeocache = await db.geocache.toArray();
  const allLlmCache = await db.llmCache.toArray();

  const metadata = await generateExportMetadata();

  const exportData: ExportData = {
    metadata,
    formations: allFormations,
    emails: allEmails,
    geocache: allGeocache,
    llmCache: allLlmCache
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Parse un fichier JSON d'export et valide sa structure
 * Supporte l'ancien format (formations uniquement) et le nouveau (complet)
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

  // Valider les tableaux optionnels s'ils sont présents
  if (data.emails && !Array.isArray(data.emails)) {
    throw new Error("Format JSON invalide: emails doit être un tableau");
  }

  if (data.geocache && !Array.isArray(data.geocache)) {
    throw new Error("Format JSON invalide: geocache doit être un tableau");
  }

  if (data.llmCache && !Array.isArray(data.llmCache)) {
    throw new Error("Format JSON invalide: llmCache doit être un tableau");
  }

  return data as ExportData;
}
