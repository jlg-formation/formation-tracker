/**
 * Service de géocodage avec cache IndexedDB
 * Utilise le pattern Adapter pour supporter plusieurs providers
 */

import type { GeocodingAdapter, GeocodingResult } from "./adapter";
import { nominatimAdapter } from "./nominatim";
import { googleAdapter } from "./google";
import { mapboxAdapter } from "./mapbox";
import { db } from "../../stores/db";
import type { GeocacheEntry, CoordonneesGPS } from "../../types";

// Ré-export des types et adapters
export type { GeocodingAdapter, GeocodingResult } from "./adapter";
export { nominatimAdapter } from "./nominatim";
export { googleAdapter } from "./google";
export { mapboxAdapter } from "./mapbox";

/**
 * Map des adapters disponibles
 */
const adapters: Record<string, GeocodingAdapter> = {
  nominatim: nominatimAdapter,
  google: googleAdapter,
  mapbox: mapboxAdapter
};

/**
 * Normalise une adresse pour la clé de cache
 */
export function normalizeAddress(address: string): string {
  // Normalisation destinée aux clés de cache (pas au rendu UI)
  // Objectifs : stabilité (accents, ponctuation) + déduplication.
  return (
    address
      .trim()
      .toLowerCase()
      .normalize("NFD")
      // Retire les diacritiques (ex: allée -> allee)
      .replace(/[\u0300-\u036f]/g, "")
      // Remplace la ponctuation par des espaces pour éviter de coller les mots
      .replace(/[.,;:()[\]{}]/g, " ")
      .replace(/["“”]/g, " ")
      .replace(/['’]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Récupère le provider de géocodage configuré
 */
export async function getGeocodingProvider(): Promise<GeocodingAdapter> {
  try {
    const settingsEntry = await db.settings.get("config");
    const providerName =
      settingsEntry?.settings?.geocodingProvider || "nominatim";
    return adapters[providerName] || nominatimAdapter;
  } catch {
    return nominatimAdapter;
  }
}

/**
 * Géocode une adresse avec cache
 * @param address Adresse à géocoder
 * @returns Coordonnées GPS ou null si non trouvé
 */
export async function geocodeAddress(
  address: string
): Promise<CoordonneesGPS | null> {
  // Normaliser l'adresse pour la clé de cache
  const normalizedAddress = normalizeAddress(address);
  const requestAddress = address.trim().replace(/\s+/g, " ");

  if (!normalizedAddress) {
    return null;
  }

  // Vérifier le cache
  try {
    const cached = await db.geocache.get(normalizedAddress);
    if (cached) {
      console.log(`Geocache hit: ${normalizedAddress}`);
      return cached.gps;
    }
  } catch (error) {
    console.error("Error reading geocache:", error);
  }

  // Appeler le provider
  const adapter = await getGeocodingProvider();
  const result = await adapter.geocode(requestAddress || normalizedAddress);

  // Mettre en cache (même si null, pour éviter de re-tenter)
  try {
    const cacheEntry: GeocacheEntry = {
      adresse: normalizedAddress,
      gps: result.gps,
      provider: adapter.name,
      cachedAt: new Date().toISOString()
    };
    await db.geocache.put(cacheEntry);
  } catch (error) {
    console.error("Error writing geocache:", error);
  }

  return result.gps;
}

/**
 * Géocode une adresse sans utiliser le cache (pour tests)
 */
export async function geocodeAddressNoCache(
  address: string
): Promise<GeocodingResult> {
  const adapter = await getGeocodingProvider();
  return adapter.geocode(address);
}

/**
 * Géocode plusieurs adresses en batch avec rate limiting
 * @param addresses Liste d'adresses à géocoder
 * @param onProgress Callback de progression
 * @returns Map adresse → coordonnées
 */
export async function geocodeBatch(
  addresses: string[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, CoordonneesGPS | null>> {
  const results = new Map<string, CoordonneesGPS | null>();

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    const gps = await geocodeAddress(address);
    results.set(address, gps);
    onProgress?.(i + 1, addresses.length);
  }

  return results;
}

/**
 * Vide le cache de géocodage
 */
export async function clearGeocache(): Promise<void> {
  await db.geocache.clear();
}

/**
 * Supprime les entrées en échec du cache de géocodage (gps === null)
 * Permet de retenter le géocodage pour ces adresses
 * @returns Nombre d'entrées supprimées
 */
export async function clearFailedGeocacheEntries(): Promise<number> {
  const failedEntries = await db.geocache
    .filter((entry) => entry.gps === null)
    .toArray();
  const addresses = failedEntries.map((e) => e.adresse);

  if (addresses.length > 0) {
    await db.geocache.bulkDelete(addresses);
    console.log(`Cleared ${addresses.length} failed geocache entries`);
  }

  return addresses.length;
}

/**
 * Récupère les statistiques du cache
 */
export async function getGeocacheStats(): Promise<{
  total: number;
  withCoords: number;
  withoutCoords: number;
}> {
  const all = await db.geocache.toArray();
  const withCoords = all.filter((e) => e.gps !== null).length;

  return {
    total: all.length,
    withCoords,
    withoutCoords: all.length - withCoords
  };
}

// =============================================================================
// ADRESSES CONNUES (PRÉ-CACHÉES)
// =============================================================================

/**
 * Adresses ORSYS fréquentes avec coordonnées pré-définies
 */
const KNOWN_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  "centre de formation orsys paroi nord grande arche 1 parvis de la défense 92044 paris la defense":
    { lat: 48.8925, lng: 2.2356 },
  "orsys paris la défense": { lat: 48.8925, lng: 2.2356 },
  "orsys la défense": { lat: 48.8925, lng: 2.2356 },
  "orsys lyon": { lat: 45.764, lng: 4.8357 },
  "orsys aix-en-provence": { lat: 43.5297, lng: 5.4474 },
  "orsys sophia antipolis": { lat: 43.6163, lng: 7.0551 },
  "orsys strasbourg": { lat: 48.5734, lng: 7.7521 },
  "orsys toulouse": { lat: 43.6047, lng: 1.4442 },
  "orsys nantes": { lat: 47.2184, lng: -1.5536 },
  "orsys lille": { lat: 50.6292, lng: 3.0573 },
  "orsys bordeaux": { lat: 44.8378, lng: -0.5792 }
};

/**
 * Précharge les adresses connues dans le cache
 */
export async function preloadKnownLocations(): Promise<number> {
  let count = 0;

  for (const [address, gps] of Object.entries(KNOWN_LOCATIONS)) {
    const normalizedKey = normalizeAddress(address);
    try {
      const existing = await db.geocache.get(normalizedKey);
      if (!existing) {
        await db.geocache.put({
          adresse: normalizedKey,
          gps,
          provider: "nominatim", // Fictif (données pré-définies)
          cachedAt: new Date().toISOString()
        });
        count++;
      }
    } catch (error) {
      console.error(`Error preloading ${address}:`, error);
    }
  }

  console.log(`Preloaded ${count} known locations`);
  return count;
}
