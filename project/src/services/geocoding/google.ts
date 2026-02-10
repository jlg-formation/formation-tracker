/**
 * Adapter Google Geocoding API
 * Fiable mais nécessite une clé API (stockée dans les settings IndexedDB)
 */

import type { GeocodingAdapter, GeocodingResult } from "./adapter";
import { getSettings } from "../../stores/settingsStore";

const GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

async function getApiKey(): Promise<string | null> {
  const settings = await getSettings();
  const apiKey = settings.googleApiKey;
  return apiKey && apiKey.trim().length > 0 ? apiKey.trim() : null;
}

function confidenceFromLocationType(locationType: unknown): number {
  switch (locationType) {
    case "ROOFTOP":
      return 1;
    case "RANGE_INTERPOLATED":
      return 0.85;
    case "GEOMETRIC_CENTER":
      return 0.7;
    case "APPROXIMATE":
      return 0.6;
    default:
      return 0.7;
  }
}

export const googleAdapter: GeocodingAdapter = {
  name: "google",

  isConfigured(): boolean {
    // L'interface est synchrone : on vérifie réellement la présence de la clé
    // dans geocode() (asynchrone).
    return true;
  },

  async geocode(address: string): Promise<GeocodingResult> {
    const apiKey = await getApiKey();

    if (!apiKey) {
      console.error("Google API key not configured");
      return { gps: null };
    }

    const trimmed = address.trim();
    if (!trimmed) {
      return { gps: null };
    }

    const params = new URLSearchParams({
      address: trimmed,
      key: apiKey
    });

    try {
      const response = await fetch(`${GOOGLE_GEOCODE_URL}?${params}`);
      if (!response.ok) {
        console.error(`Google geocoding error: ${response.status}`);
        return { gps: null };
      }

      const data: any = await response.json();

      if (data?.status !== "OK" || !Array.isArray(data?.results)) {
        console.warn(`Google geocoding: ${data?.status || "UNKNOWN"}`);
        return { gps: null };
      }

      if (data.results.length === 0) {
        return { gps: null };
      }

      const result = data.results[0];
      const location = result?.geometry?.location;
      const lat = typeof location?.lat === "number" ? location.lat : null;
      const lng = typeof location?.lng === "number" ? location.lng : null;

      if (lat === null || lng === null) {
        return { gps: null };
      }

      return {
        gps: { lat, lng },
        formattedAddress:
          typeof result?.formatted_address === "string"
            ? result.formatted_address
            : undefined,
        confidence: confidenceFromLocationType(result?.geometry?.location_type)
      };
    } catch (error) {
      console.error("Google geocoding error:", error);
      return { gps: null };
    }
  }
};
