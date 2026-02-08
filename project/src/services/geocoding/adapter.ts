/**
 * Interface Adapter pour le géocodage
 * Permet de switcher facilement entre Nominatim, Google et Mapbox
 */

import type { CoordonneesGPS } from "../../types";

/**
 * Résultat d'une opération de géocodage
 */
export interface GeocodingResult {
  /** Coordonnées GPS (null si non trouvé) */
  gps: CoordonneesGPS | null;
  /** Adresse formatée retournée par le provider */
  formattedAddress?: string;
  /** Score de confiance (0-1) */
  confidence?: number;
}

/**
 * Interface commune pour tous les providers de géocodage
 */
export interface GeocodingAdapter {
  /** Nom du provider */
  readonly name: "nominatim" | "google" | "mapbox";

  /** Géocode une adresse en coordonnées GPS */
  geocode(address: string): Promise<GeocodingResult>;

  /** Vérifie si le provider est configuré (clé API disponible si nécessaire) */
  isConfigured(): boolean;
}
