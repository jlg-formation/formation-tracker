/**
 * Store pour la gestion du cache de géocodage (geocache) dans IndexedDB.
 */

import { db } from "./db";
import type { CoordonneesGPS, Formation, GeocacheEntry } from "../types";
import { StatutFormation } from "../types";
import { normalizeAddress } from "../services/geocoding";
import { updateFormation } from "./formationsStore";

/**
 * Récupère toutes les entrées du cache de géocodage.
 */
export async function getAllGeocacheEntries(): Promise<GeocacheEntry[]> {
  return await db.geocache.toArray();
}

/**
 * Met à jour les coordonnées GPS d'une entrée du cache.
 */
export async function updateGeocacheEntryGps(
  adresse: string,
  gps: CoordonneesGPS
): Promise<void> {
  const existing = await db.geocache.get(adresse);
  if (!existing) {
    throw new Error("Entrée geocache introuvable.");
  }

  const updated: GeocacheEntry = {
    ...existing,
    gps,
    cachedAt: new Date().toISOString()
  };

  await db.geocache.put(updated);
}

function buildFormationGeocacheKey(formation: Formation): string {
  const address = formation.lieu?.adresse || formation.lieu?.nom || "";
  return normalizeAddress(address);
}

/**
 * Réapplique les données du cache de géocodage à toutes les formations.
 *
 * - Ne modifie pas les formations annulées.
 * - Applique uniquement les entrées dont le GPS est non-null.
 * - Met à jour uniquement si la valeur diffère.
 *
 * @returns Nombre de formations mises à jour.
 */
export async function reapplyGeocacheToAllFormations(): Promise<number> {
  const formations = await db.formations.toArray();

  let updatedCount = 0;

  for (const formation of formations) {
    if (formation.statut === StatutFormation.ANNULEE) {
      continue;
    }

    const key = buildFormationGeocacheKey(formation);
    if (!key) {
      continue;
    }

    const cacheEntry = await db.geocache.get(key);
    if (!cacheEntry || cacheEntry.gps === null) {
      continue;
    }

    const current = formation.lieu?.gps;
    const next = cacheEntry.gps;

    const isSame =
      current?.lat === next.lat &&
      current?.lng === next.lng &&
      Boolean(current?.lat) &&
      Boolean(current?.lng);

    if (isSame) {
      continue;
    }

    await updateFormation(formation.id, {
      lieu: {
        ...formation.lieu,
        gps: next
      }
    });
    updatedCount++;
  }

  return updatedCount;
}
