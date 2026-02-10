/**
 * Adapter Mapbox Geocoding API
 * Bon compromis, nécessite une clé API (stockée dans les settings IndexedDB)
 */

import type { GeocodingAdapter, GeocodingResult } from "./adapter";
import { getSettings } from "../../stores/settingsStore";

const MAPBOX_GEOCODE_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

async function getApiKey(): Promise<string | null> {
  const settings = await getSettings();
  const apiKey = settings.mapboxApiKey;
  return apiKey && apiKey.trim().length > 0 ? apiKey.trim() : null;
}

export const mapboxAdapter: GeocodingAdapter = {
  name: "mapbox",

  isConfigured(): boolean {
    // L'interface est synchrone : validation réelle dans geocode().
    return true;
  },

  async geocode(address: string): Promise<GeocodingResult> {
    const apiKey = await getApiKey();

    if (!apiKey) {
      console.error("Mapbox API key not configured");
      return { gps: null };
    }

    const trimmed = address.trim();
    if (!trimmed) {
      return { gps: null };
    }

    const encodedAddress = encodeURIComponent(trimmed);

    try {
      const response = await fetch(
        `${MAPBOX_GEOCODE_URL}/${encodedAddress}.json?access_token=${apiKey}&limit=1`
      );

      if (!response.ok) {
        console.error(`Mapbox geocoding error: ${response.status}`);
        return { gps: null };
      }

      const data: unknown = await response.json();
      const dataObj = asRecord(data);
      const featuresUnknown = dataObj?.features;
      const features = Array.isArray(featuresUnknown)
        ? (featuresUnknown as unknown[])
        : [];
      if (features.length === 0) {
        return { gps: null };
      }

      const featureObj = asRecord(features[0]);
      const centerUnknown = featureObj?.center;
      const center = Array.isArray(centerUnknown) ? centerUnknown : null;
      const lng =
        typeof center?.[0] === "number" ? (center[0] as number) : null;
      const lat =
        typeof center?.[1] === "number" ? (center[1] as number) : null;

      if (lat === null || lng === null) {
        return { gps: null };
      }

      return {
        gps: { lat, lng },
        formattedAddress:
          typeof featureObj?.place_name === "string"
            ? (featureObj.place_name as string)
            : undefined,
        confidence:
          typeof featureObj?.relevance === "number"
            ? (featureObj.relevance as number)
            : 0.5
      };
    } catch (error) {
      console.error("Mapbox geocoding error:", error);
      return { gps: null };
    }
  }
};
