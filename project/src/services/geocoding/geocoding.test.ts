/**
 * Tests du service de géocodage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";

// Mock fetch avant d'importer les modules
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import après le mock
import { nominatimAdapter, resetRateLimiter } from "./nominatim";
import {
  normalizeAddress,
  geocodeAddress,
  geocodeBatch,
  clearGeocache,
  getGeocacheStats,
  preloadKnownLocations,
} from "./index";
import { db } from "../../stores/db";

describe("Geocoding Service", () => {
  beforeEach(async () => {
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
            importance: 0.85,
          },
        ],
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
        json: async () => [],
      });

      const result = await nominatimAdapter.geocode("adresse inexistante xyz");

      expect(result.gps).toBeNull();
    });

    it("retourne null si erreur HTTP", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
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
        json: async () => "not an array",
      });

      const result = await nominatimAdapter.geocode("Paris");

      expect(result.gps).toBeNull();
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
          { lat: "48.8566", lon: "2.3522", display_name: "Paris", importance: 0.9 },
        ],
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
        cachedAt: new Date().toISOString(),
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
        json: async () => [],
      });

      const result = await geocodeAddress("adresse inconnue");

      expect(result).toBeNull();

      // Vérifier que le cache contient l'entrée avec gps null
      const cached = await db.geocache.get("adresse inconnue");
      expect(cached).not.toBeNull();
      expect(cached?.gps).toBeNull();
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
        cachedAt: new Date().toISOString(),
      });

      // Mock pour Lyon
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { lat: "45.764", lon: "4.8357", display_name: "Lyon", importance: 0.8 },
        ],
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
        [2, 2],
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
        cachedAt: new Date().toISOString(),
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
          cachedAt: new Date().toISOString(),
        },
        {
          adresse: "inconnue",
          gps: null,
          provider: "nominatim",
          cachedAt: new Date().toISOString(),
        },
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
});
