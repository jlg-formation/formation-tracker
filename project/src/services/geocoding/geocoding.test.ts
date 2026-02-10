/**
 * Tests du service de géocodage
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  afterAll
} from "vitest";
import "fake-indexeddb/auto";

// Mock fetch pour les appels réseau
const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

// Import après le mock
import { nominatimAdapter, resetRateLimiter } from "./nominatim";
import {
  normalizeAddress,
  geocodeAddress,
  geocodeBatch,
  clearGeocache,
  clearFailedGeocacheEntries,
  getGeocacheStats,
  preloadKnownLocations,
  googleAdapter,
  mapboxAdapter
} from "./index";
import { db } from "../../stores/db";
import { saveSettings } from "../../stores/settingsStore";

describe("Geocoding Service", () => {
  beforeEach(async () => {
    // Installer le mock fetch avant chaque test
    // (les modules appellent fetch à l'exécution, pas à l'import)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = mockFetch;

    // Réinitialiser le rate limiter avant chaque test
    resetRateLimiter();
    // Nettoyer la base de données
    await db.geocache.clear();
    await db.settings.clear();
    // Réinitialiser les mocks
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    // Restaurer fetch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = originalFetch;
  });

  // ===========================================================================
  // Tests normalizeAddress
  // ===========================================================================

  describe("normalizeAddress", () => {
    it("met en minuscules", () => {
      expect(normalizeAddress("PARIS")).toBe("paris");
    });

    it("supprime les espaces multiples", () => {
      expect(normalizeAddress("1   rue   du   test")).toBe("1 rue du test");
    });

    it("supprime les ponctuations", () => {
      expect(normalizeAddress("1, rue du test. Paris")).toBe(
        "1 rue du test paris"
      );
    });

    it("trim les espaces", () => {
      expect(normalizeAddress("  Paris  ")).toBe("paris");
    });

    it("gère une chaîne vide", () => {
      expect(normalizeAddress("")).toBe("");
    });

    it("normalise une adresse complexe", () => {
      expect(
        normalizeAddress("1, Parvis de La Défense;  92044 PARIS LA DEFENSE")
      ).toBe("1 parvis de la défense 92044 paris la defense");
    });
  });

  // ===========================================================================
  // Tests nominatimAdapter
  // ===========================================================================

  describe("nominatimAdapter", () => {
    it("retourne name = nominatim", () => {
      expect(nominatimAdapter.name).toBe("nominatim");
    });

    it("isConfigured retourne true", () => {
      expect(nominatimAdapter.isConfigured()).toBe(true);
    });

    it("geocode une adresse avec succès", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            lat: "48.8925",
            lon: "2.2356",
            display_name: "La Défense, Paris, France",
            importance: 0.85
          }
        ]
      });

      const result = await nominatimAdapter.geocode("La Défense Paris");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.gps).not.toBeNull();
      expect(result.gps?.lat).toBeCloseTo(48.8925, 4);
      expect(result.gps?.lng).toBeCloseTo(2.2356, 4);
      expect(result.formattedAddress).toBe("La Défense, Paris, France");
      expect(result.confidence).toBeCloseTo(0.85, 2);
    });

    it("retourne null si aucun résultat", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const result = await nominatimAdapter.geocode("adresse inexistante xyz");

      expect(result.gps).toBeNull();
    });

    it("retourne null si erreur HTTP", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await nominatimAdapter.geocode("Paris");

      expect(result.gps).toBeNull();
    });

    it("retourne null si erreur réseau", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await nominatimAdapter.geocode("Paris");

      expect(result.gps).toBeNull();
    });

    it("gère les résultats invalides", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => "not an array"
      });

      const result = await nominatimAdapter.geocode("Paris");

      expect(result.gps).toBeNull();
    });
  });

  // ===========================================================================
  // Tests googleAdapter
  // ===========================================================================

  describe("googleAdapter", () => {
    it("retourne name = google", () => {
      expect(googleAdapter.name).toBe("google");
    });

    it("retourne null si la clé API n'est pas configurée", async () => {
      await saveSettings({
        geocodingProvider: "google",
        googleApiKey: undefined
      });

      const result = await googleAdapter.geocode("Paris");

      expect(result.gps).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("géocode une adresse avec succès", async () => {
      await saveSettings({
        geocodingProvider: "google",
        googleApiKey: "AIzaTEST"
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "OK",
          results: [
            {
              formatted_address: "Paris, France",
              geometry: {
                location: { lat: 48.8566, lng: 2.3522 },
                location_type: "ROOFTOP"
              }
            }
          ]
        })
      });

      const result = await googleAdapter.geocode("Paris");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = String(mockFetch.mock.calls[0]?.[0]);
      expect(url).toContain("maps.googleapis.com");
      expect(url).toContain("geocode/json");
      expect(url).toContain("address=Paris");
      expect(url).toContain("key=AIzaTEST");

      expect(result.gps).not.toBeNull();
      expect(result.gps?.lat).toBeCloseTo(48.8566, 4);
      expect(result.gps?.lng).toBeCloseTo(2.3522, 4);
      expect(result.formattedAddress).toBe("Paris, France");
      expect(result.confidence).toBe(1);
    });
  });

  // ===========================================================================
  // Tests mapboxAdapter
  // ===========================================================================

  describe("mapboxAdapter", () => {
    it("retourne name = mapbox", () => {
      expect(mapboxAdapter.name).toBe("mapbox");
    });

    it("retourne null si la clé API n'est pas configurée", async () => {
      await saveSettings({
        geocodingProvider: "mapbox",
        mapboxApiKey: undefined
      });

      const result = await mapboxAdapter.geocode("Paris");
      expect(result.gps).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("géocode une adresse avec succès", async () => {
      await saveSettings({
        geocodingProvider: "mapbox",
        mapboxApiKey: "pkTEST"
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          features: [
            {
              center: [2.3522, 48.8566],
              place_name: "Paris, France",
              relevance: 0.91
            }
          ]
        })
      });

      const result = await mapboxAdapter.geocode("Paris");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = String(mockFetch.mock.calls[0]?.[0]);
      expect(url).toContain("api.mapbox.com");
      expect(url).toContain("geocoding/v5/mapbox.places");
      expect(url).toContain("Paris.json");
      expect(url).toContain("access_token=pkTEST");
      expect(url).toContain("limit=1");

      expect(result.gps).not.toBeNull();
      expect(result.gps?.lat).toBeCloseTo(48.8566, 4);
      expect(result.gps?.lng).toBeCloseTo(2.3522, 4);
      expect(result.formattedAddress).toBe("Paris, France");
      expect(result.confidence).toBeCloseTo(0.91, 2);
    });
  });

  // ===========================================================================
  // Tests geocodeAddress (avec cache)
  // ===========================================================================

  describe("geocodeAddress", () => {
    it("retourne null pour une adresse vide", async () => {
      const result = await geocodeAddress("");
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("appelle le provider et met en cache", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            lat: "48.8566",
            lon: "2.3522",
            display_name: "Paris",
            importance: 0.9
          }
        ]
      });

      const result = await geocodeAddress("Paris");

      expect(result).not.toBeNull();
      expect(result?.lat).toBeCloseTo(48.8566, 4);

      // Vérifier le cache
      const cached = await db.geocache.get("paris");
      expect(cached).not.toBeNull();
      expect(cached?.gps?.lat).toBeCloseTo(48.8566, 4);
    });

    it("utilise le cache si disponible", async () => {
      // Pré-remplir le cache
      await db.geocache.put({
        adresse: "lyon",
        gps: { lat: 45.764, lng: 4.8357 },
        provider: "nominatim",
        cachedAt: new Date().toISOString()
      });

      const result = await geocodeAddress("Lyon");

      expect(result).not.toBeNull();
      expect(result?.lat).toBeCloseTo(45.764, 4);
      // Pas d'appel fetch car cache hit
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("cache les résultats null", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const result = await geocodeAddress("adresse inconnue");

      expect(result).toBeNull();

      // Vérifier que le cache contient l'entrée avec gps null
      const cached = await db.geocache.get("adresse inconnue");
      expect(cached).not.toBeNull();
      expect(cached?.gps).toBeNull();
    });

    it("utilise le provider Google si configuré", async () => {
      await saveSettings({
        geocodingProvider: "google",
        googleApiKey: "AIzaTEST"
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "OK",
          results: [
            {
              formatted_address: "Lyon, France",
              geometry: {
                location: { lat: 45.764, lng: 4.8357 },
                location_type: "APPROXIMATE"
              }
            }
          ]
        })
      });

      const result = await geocodeAddress("Lyon");
      expect(result).not.toBeNull();
      expect(result?.lat).toBeCloseTo(45.764, 4);
      expect(result?.lng).toBeCloseTo(4.8357, 4);

      const cached = await db.geocache.get("lyon");
      expect(cached).not.toBeNull();
      expect(cached?.provider).toBe("google");
    });

    it("utilise le provider Mapbox si configuré", async () => {
      await saveSettings({
        geocodingProvider: "mapbox",
        mapboxApiKey: "pkTEST"
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          features: [
            {
              center: [4.8357, 45.764],
              place_name: "Lyon, France",
              relevance: 0.88
            }
          ]
        })
      });

      const result = await geocodeAddress("Lyon");
      expect(result).not.toBeNull();
      expect(result?.lat).toBeCloseTo(45.764, 4);
      expect(result?.lng).toBeCloseTo(4.8357, 4);

      const cached = await db.geocache.get("lyon");
      expect(cached).not.toBeNull();
      expect(cached?.provider).toBe("mapbox");
    });
  });

  // ===========================================================================
  // Tests geocodeBatch
  // ===========================================================================

  describe("geocodeBatch", () => {
    it("géocode plusieurs adresses", async () => {
      // Pré-remplir le cache pour une adresse
      await db.geocache.put({
        adresse: "paris",
        gps: { lat: 48.8566, lng: 2.3522 },
        provider: "nominatim",
        cachedAt: new Date().toISOString()
      });

      // Mock pour Lyon
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            lat: "45.764",
            lon: "4.8357",
            display_name: "Lyon",
            importance: 0.8
          }
        ]
      });

      const addresses = ["Paris", "Lyon"];
      const progressCalls: Array<[number, number]> = [];

      const results = await geocodeBatch(addresses, (current, total) => {
        progressCalls.push([current, total]);
      });

      expect(results.size).toBe(2);
      expect(results.get("Paris")?.lat).toBeCloseTo(48.8566, 4);
      expect(results.get("Lyon")?.lat).toBeCloseTo(45.764, 4);
      expect(progressCalls).toEqual([
        [1, 2],
        [2, 2]
      ]);
    });
  });

  // ===========================================================================
  // Tests utilitaires cache
  // ===========================================================================

  describe("Cache utilities", () => {
    it("clearGeocache vide le cache", async () => {
      await db.geocache.put({
        adresse: "test",
        gps: { lat: 0, lng: 0 },
        provider: "nominatim",
        cachedAt: new Date().toISOString()
      });

      await clearGeocache();

      const count = await db.geocache.count();
      expect(count).toBe(0);
    });

    it("getGeocacheStats retourne les statistiques", async () => {
      await db.geocache.bulkPut([
        {
          adresse: "paris",
          gps: { lat: 48.8566, lng: 2.3522 },
          provider: "nominatim",
          cachedAt: new Date().toISOString()
        },
        {
          adresse: "inconnue",
          gps: null,
          provider: "nominatim",
          cachedAt: new Date().toISOString()
        }
      ]);

      const stats = await getGeocacheStats();

      expect(stats.total).toBe(2);
      expect(stats.withCoords).toBe(1);
      expect(stats.withoutCoords).toBe(1);
    });
  });

  // ===========================================================================
  // Tests preloadKnownLocations
  // ===========================================================================

  describe("preloadKnownLocations", () => {
    it("précharge les adresses connues", async () => {
      const count = await preloadKnownLocations();

      expect(count).toBeGreaterThan(0);

      // Vérifier qu'une adresse connue est dans le cache
      const orsysDefense = await db.geocache.get("orsys paris la défense");
      expect(orsysDefense).not.toBeNull();
      expect(orsysDefense?.gps?.lat).toBeCloseTo(48.8925, 4);
    });

    it("ne duplique pas les entrées existantes", async () => {
      // Premier chargement
      await preloadKnownLocations();

      // Deuxième chargement - aucune nouvelle entrée
      const count2 = await preloadKnownLocations();

      expect(count2).toBe(0);
    });
  });

  // ===========================================================================
  // Tests clearFailedGeocacheEntries
  // ===========================================================================

  describe("clearFailedGeocacheEntries", () => {
    it("supprime les entrées en échec (gps === null)", async () => {
      // Ajouter des entrées réussies et échouées
      await db.geocache.put({
        adresse: "adresse-succes",
        gps: { lat: 48.5, lng: 2.3 },
        provider: "nominatim",
        cachedAt: new Date().toISOString()
      });
      await db.geocache.put({
        adresse: "adresse-echec-1",
        gps: null,
        provider: "nominatim",
        cachedAt: new Date().toISOString()
      });
      await db.geocache.put({
        adresse: "adresse-echec-2",
        gps: null,
        provider: "nominatim",
        cachedAt: new Date().toISOString()
      });

      // Vérifier l'état initial
      const totalBefore = await db.geocache.count();
      expect(totalBefore).toBe(3);

      // Supprimer les échecs
      const deletedCount = await clearFailedGeocacheEntries();
      expect(deletedCount).toBe(2);

      // Vérifier qu'il ne reste que l'entrée réussie
      const totalAfter = await db.geocache.count();
      expect(totalAfter).toBe(1);

      const successEntry = await db.geocache.get("adresse-succes");
      expect(successEntry).not.toBeNull();
      expect(successEntry?.gps?.lat).toBe(48.5);

      const failedEntry = await db.geocache.get("adresse-echec-1");
      expect(failedEntry).toBeUndefined();
    });

    it("retourne 0 si aucune entrée en échec", async () => {
      // Ajouter uniquement des entrées réussies
      await db.geocache.put({
        adresse: "adresse-succes",
        gps: { lat: 48.5, lng: 2.3 },
        provider: "nominatim",
        cachedAt: new Date().toISOString()
      });

      const deletedCount = await clearFailedGeocacheEntries();
      expect(deletedCount).toBe(0);

      const total = await db.geocache.count();
      expect(total).toBe(1);
    });

    it("permet de retenter le géocodage après suppression", async () => {
      const address = "adresse-test-retry";

      // Simuler un échec initial
      await db.geocache.put({
        adresse: address,
        gps: null,
        provider: "nominatim",
        cachedAt: new Date().toISOString()
      });

      // Vérifier que geocodeAddress retourne null (depuis le cache)
      const resultBefore = await geocodeAddress(address);
      expect(resultBefore).toBeNull();

      // Supprimer les échecs
      await clearFailedGeocacheEntries();

      // L'entrée n'est plus en cache
      const cached = await db.geocache.get(address);
      expect(cached).toBeUndefined();
    });
  });
});
