# 05 - Géocodage

## Vue d'ensemble

Le géocodage convertit les adresses textuelles en coordonnées GPS pour affichage sur la carte Leaflet.

L'application utilise un **Adapter Pattern** permettant de switcher facilement entre :

- **Nominatim** (OpenStreetMap) - Gratuit, limité
- **Google Geocoding API** - Fiable, payant
- **Mapbox Geocoding** - Bon compromis

---

## Interface Adapter

```typescript
// project/src/services/geocoding/adapter.ts

import { CoordonneesGPS } from "../../types";

export interface GeocodingResult {
  gps: CoordonneesGPS | null;
  formattedAddress?: string;
  confidence?: number;
}

export interface GeocodingAdapter {
  /** Nom du provider */
  name: string;

  /** Géocode une adresse */
  geocode(address: string): Promise<GeocodingResult>;

  /** Vérifie si le provider est configuré */
  isConfigured(): boolean;
}
```

---

## Implémentation Nominatim (OpenStreetMap)

```typescript
// project/src/services/geocoding/nominatim.ts

import { GeocodingAdapter, GeocodingResult } from "./adapter";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "OrsysTrainingTracker/1.0";

// Rate limiting : 1 requête par seconde max
let lastRequestTime = 0;
const MIN_DELAY_MS = 1000;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;

  if (elapsed < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - elapsed));
  }

  lastRequestTime = Date.now();
}

export const nominatimAdapter: GeocodingAdapter = {
  name: "nominatim",

  isConfigured(): boolean {
    return true; // Toujours disponible, pas de clé API
  },

  async geocode(address: string): Promise<GeocodingResult> {
    await waitForRateLimit();

    const params = new URLSearchParams({
      q: address,
      format: "json",
      limit: "1",
      addressdetails: "1"
    });

    try {
      const response = await fetch(`${NOMINATIM_BASE_URL}?${params}`, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        console.error(`Nominatim error: ${response.status}`);
        return { gps: null };
      }

      const results = await response.json();

      if (results.length === 0) {
        return { gps: null };
      }

      const result = results[0];

      return {
        gps: {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon)
        },
        formattedAddress: result.display_name,
        confidence: parseFloat(result.importance) || 0.5
      };
    } catch (error) {
      console.error("Nominatim geocoding error:", error);
      return { gps: null };
    }
  }
};
```

---

## Implémentation Google Geocoding

```typescript
// project/src/services/geocoding/google.ts

import { GeocodingAdapter, GeocodingResult } from "./adapter";
import { db } from "../../stores/db";

const GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

async function getApiKey(): Promise<string | null> {
  const settings = await db.settings.get(1);
  return settings?.googleApiKey || null;
}

export const googleAdapter: GeocodingAdapter = {
  name: "google",

  isConfigured(): boolean {
    // Vérifié de manière asynchrone, mais pour l'interface sync
    // on peut juste retourner true et gérer l'erreur dans geocode()
    return true;
  },

  async geocode(address: string): Promise<GeocodingResult> {
    const apiKey = await getApiKey();

    if (!apiKey) {
      console.error("Google API key not configured");
      return { gps: null };
    }

    const params = new URLSearchParams({
      address: address,
      key: apiKey
    });

    try {
      const response = await fetch(`${GOOGLE_GEOCODE_URL}?${params}`);
      const data = await response.json();

      if (data.status !== "OK" || data.results.length === 0) {
        console.warn(`Google geocoding: ${data.status}`);
        return { gps: null };
      }

      const result = data.results[0];
      const location = result.geometry.location;

      return {
        gps: {
          lat: location.lat,
          lng: location.lng
        },
        formattedAddress: result.formatted_address,
        confidence: result.geometry.location_type === "ROOFTOP" ? 1 : 0.7
      };
    } catch (error) {
      console.error("Google geocoding error:", error);
      return { gps: null };
    }
  }
};
```

---

## Implémentation Mapbox

```typescript
// project/src/services/geocoding/mapbox.ts

import { GeocodingAdapter, GeocodingResult } from "./adapter";
import { db } from "../../stores/db";

const MAPBOX_GEOCODE_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

async function getApiKey(): Promise<string | null> {
  const settings = await db.settings.get(1);
  return settings?.mapboxApiKey || null;
}

export const mapboxAdapter: GeocodingAdapter = {
  name: "mapbox",

  isConfigured(): boolean {
    return true;
  },

  async geocode(address: string): Promise<GeocodingResult> {
    const apiKey = await getApiKey();

    if (!apiKey) {
      console.error("Mapbox API key not configured");
      return { gps: null };
    }

    const encodedAddress = encodeURIComponent(address);

    try {
      const response = await fetch(
        `${MAPBOX_GEOCODE_URL}/${encodedAddress}.json?access_token=${apiKey}&limit=1`
      );
      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        return { gps: null };
      }

      const feature = data.features[0];
      const [lng, lat] = feature.center;

      return {
        gps: { lat, lng },
        formattedAddress: feature.place_name,
        confidence: feature.relevance || 0.5
      };
    } catch (error) {
      console.error("Mapbox geocoding error:", error);
      return { gps: null };
    }
  }
};
```

---

## Service de géocodage avec cache

```typescript
// project/src/services/geocoding/index.ts

import { GeocodingAdapter, GeocodingResult } from "./adapter";
import { nominatimAdapter } from "./nominatim";
import { googleAdapter } from "./google";
import { mapboxAdapter } from "./mapbox";
import { db } from "../../stores/db";
import { GeocacheEntry, CoordonneesGPS } from "../../types";

const adapters: Record<string, GeocodingAdapter> = {
  nominatim: nominatimAdapter,
  google: googleAdapter,
  mapbox: mapboxAdapter
};

export async function getGeocodingProvider(): Promise<GeocodingAdapter> {
  const settings = await db.settings.get(1);
  const providerName = settings?.geocodingProvider || "nominatim";
  return adapters[providerName] || nominatimAdapter;
}

export async function geocodeAddress(
  address: string
): Promise<CoordonneesGPS | null> {
  // Normaliser l'adresse
  const normalizedAddress = normalizeAddress(address);

  // Vérifier le cache
  const cached = await db.geocache.get(normalizedAddress);
  if (cached) {
    console.log(`Geocache hit: ${normalizedAddress}`);
    return cached.gps;
  }

  // Appeler le provider
  const adapter = await getGeocodingProvider();
  const result = await adapter.geocode(normalizedAddress);

  // Mettre en cache (même si null, pour éviter de re-tenter)
  const cacheEntry: GeocacheEntry = {
    adresse: normalizedAddress,
    gps: result.gps,
    provider: adapter.name as "nominatim" | "google" | "mapbox",
    cachedAt: new Date().toISOString()
  };
  await db.geocache.put(cacheEntry);

  return result.gps;
}

function normalizeAddress(address: string): string {
  return address
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;]/g, "");
}

// Géocodage en batch avec rate limiting
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
```

---

## Adresses connues (pré-cachées)

Pour les lieux ORSYS fréquents, on peut pré-remplir le cache :

```typescript
// project/src/services/geocoding/known-locations.ts

import { db } from "../../stores/db";

const KNOWN_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  "centre de formation orsys paroi nord grande arche 1 parvis de la défense 92044 paris la defense":
    {
      lat: 48.8925,
      lng: 2.2356
    },
  "orsys paris la défense": {
    lat: 48.8925,
    lng: 2.2356
  },
  "orsys lyon": {
    lat: 45.764,
    lng: 4.8357
  },
  "orsys aix-en-provence": {
    lat: 43.5297,
    lng: 5.4474
  },
  "orsys sophia antipolis": {
    lat: 43.6163,
    lng: 7.0551
  },
  "orsys strasbourg": {
    lat: 48.5734,
    lng: 7.7521
  },
  "orsys toulouse": {
    lat: 43.6047,
    lng: 1.4442
  },
  "orsys nantes": {
    lat: 47.2184,
    lng: -1.5536
  },
  "orsys lille": {
    lat: 50.6292,
    lng: 3.0573
  },
  "orsys bordeaux": {
    lat: 44.8378,
    lng: -0.5792
  }
};

export async function preloadKnownLocations(): Promise<void> {
  for (const [address, gps] of Object.entries(KNOWN_LOCATIONS)) {
    const existing = await db.geocache.get(address);
    if (!existing) {
      await db.geocache.put({
        adresse: address,
        gps,
        provider: "nominatim", // Fictif
        cachedAt: new Date().toISOString()
      });
    }
  }
  console.log("Known locations preloaded");
}
```

---

## Comparaison des providers

| Provider      | Gratuit       | Limite gratuite  | Précision  | Latence |
| ------------- | ------------- | ---------------- | ---------- | ------- |
| **Nominatim** | ✅ Oui        | 1 req/sec        | ⭐⭐⭐     | ~500ms  |
| **Google**    | ❌ Non        | 200$/mois credit | ⭐⭐⭐⭐⭐ | ~100ms  |
| **Mapbox**    | Partiellement | 100k/mois        | ⭐⭐⭐⭐   | ~150ms  |

### Recommandation

1. **Développement** : Nominatim (gratuit, suffisant)
2. **Production** : Google ou Mapbox si budget disponible
3. **Fallback** : Pré-cacher les adresses ORSYS connues

---

## Configuration UI

L'utilisateur peut changer de provider dans les paramètres :

```typescript
interface GeocodingSettings {
  provider: "nominatim" | "google" | "mapbox";
  googleApiKey?: string;
  mapboxApiKey?: string;
}
```
