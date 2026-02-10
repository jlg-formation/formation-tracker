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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
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

      const data: unknown = await response.json();
      const dataObj = asRecord(data);
      const status = dataObj?.status;
      const resultsUnknown = dataObj?.results;

      if (status !== "OK" || !Array.isArray(resultsUnknown)) {
        console.warn(
          `Google geocoding: ${typeof status === "string" ? status : "UNKNOWN"}`
        );
        return { gps: null };
      }

      const results = resultsUnknown as unknown[];
      if (results.length === 0) {
        return { gps: null };
      }

      const resultObj = asRecord(results[0]);
      const geometryObj = asRecord(resultObj?.geometry);
      const locationObj = asRecord(geometryObj?.location);

      const lat =
        typeof locationObj?.lat === "number"
          ? (locationObj.lat as number)
          : null;
      const lng =
        typeof locationObj?.lng === "number"
          ? (locationObj.lng as number)
          : null;

      if (lat === null || lng === null) {
        return { gps: null };
      }

      return {
        gps: { lat, lng },
        formattedAddress:
          typeof resultObj?.formatted_address === "string"
            ? (resultObj.formatted_address as string)
            : undefined,
        confidence: confidenceFromLocationType(geometryObj?.location_type)
      };
    } catch (error) {
      console.error("Google geocoding error:", error);
      return { gps: null };
    }
  }
};
