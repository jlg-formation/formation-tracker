/**
 * Adapter Nominatim (OpenStreetMap) pour le géocodage
 * Gratuit mais limité à 1 requête par seconde
 */

import type { GeocodingAdapter, GeocodingResult } from "./adapter";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "OrsysTrainingTracker/1.0";

// Rate limiting : 1 requête par seconde max
let lastRequestTime = 0;
const MIN_DELAY_MS = 1000;

/**
 * Attend le délai nécessaire pour respecter le rate limiting
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;

  if (elapsed < MIN_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }

  lastRequestTime = Date.now();
}

/**
 * Réinitialise le rate limiter (utile pour les tests)
 */
export function resetRateLimiter(): void {
  lastRequestTime = 0;
}

/**
 * Adapter Nominatim pour le géocodage
 */
export const nominatimAdapter: GeocodingAdapter = {
  name: "nominatim",

  isConfigured(): boolean {
    // Nominatim est toujours disponible, pas de clé API requise
    return true;
  },

  async geocode(address: string): Promise<GeocodingResult> {
    await waitForRateLimit();

    const params = new URLSearchParams({
      q: address,
      format: "json",
      limit: "1",
      addressdetails: "1",
    });

    try {
      const response = await fetch(`${NOMINATIM_BASE_URL}?${params}`, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.error(`Nominatim error: ${response.status}`);
        return { gps: null };
      }

      const results = await response.json();

      if (!Array.isArray(results) || results.length === 0) {
        return { gps: null };
      }

      const result = results[0];

      return {
        gps: {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
        },
        formattedAddress: result.display_name,
        confidence: parseFloat(result.importance) || 0.5,
      };
    } catch (error) {
      console.error("Nominatim geocoding error:", error);
      return { gps: null };
    }
  },
};
