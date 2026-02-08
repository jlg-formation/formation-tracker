/**
 * Tests pour le store de cache LLM
 */

import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";

import { db, resetDatabase } from "./db";
import {
  getLLMCacheEntry,
  getClassificationsFromCache,
  getExtractionsFromCache,
  cacheClassification,
  cacheExtraction,
  cacheLLMResult,
  deleteLLMCacheEntry,
  clearLLMCache,
  countLLMCacheEntries,
  invalidateOldCacheEntries,
  CURRENT_MODEL_VERSION
} from "./llmCacheStore";
import { TypeEmail } from "../types";
import type {
  ClassificationResult,
  ExtractionResult
} from "../services/llm/types";

describe("LLM Cache Store", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe("cacheClassification", () => {
    it("sauvegarde une classification en cache", async () => {
      const classification: ClassificationResult = {
        type: TypeEmail.CONVOCATION_INTER,
        confidence: 0.95,
        reason: "Contient 'animation inter'"
      };

      await cacheClassification("email-1", classification);

      const cached = await getLLMCacheEntry("email-1");
      expect(cached).toBeDefined();
      expect(cached?.classification).toEqual(classification);
      expect(cached?.extraction).toBeNull();
      expect(cached?.modelVersion).toBe(CURRENT_MODEL_VERSION);
    });

    it("met à jour une classification existante", async () => {
      const classification1: ClassificationResult = {
        type: TypeEmail.CONVOCATION_INTER,
        confidence: 0.8,
        reason: "Premier essai"
      };

      const classification2: ClassificationResult = {
        type: TypeEmail.CONVOCATION_INTRA,
        confidence: 0.95,
        reason: "Deuxième essai"
      };

      await cacheClassification("email-1", classification1);
      await cacheClassification("email-1", classification2);

      const cached = await getLLMCacheEntry("email-1");
      expect(cached?.classification?.type).toBe(TypeEmail.CONVOCATION_INTRA);
      expect(cached?.classification?.confidence).toBe(0.95);
    });
  });

  describe("cacheExtraction", () => {
    it("sauvegarde une extraction en cache", async () => {
      const extraction: ExtractionResult = {
        formation: {
          titre: "Formation Test",
          codeEtendu: "TEST01",
          dateDebut: "2026-01-01"
        },
        fieldsExtracted: ["titre", "codeEtendu", "dateDebut"],
        fieldsMissing: ["dateFin"],
        warnings: []
      };

      await cacheExtraction("email-1", extraction);

      const cached = await getLLMCacheEntry("email-1");
      expect(cached?.extraction).toEqual(extraction);
      expect(cached?.classification).toBeNull();
    });

    it("préserve la classification existante lors de l'ajout d'extraction", async () => {
      const classification: ClassificationResult = {
        type: TypeEmail.CONVOCATION_INTER,
        confidence: 0.95,
        reason: "Test"
      };

      const extraction: ExtractionResult = {
        formation: { titre: "Test" },
        fieldsExtracted: ["titre"],
        fieldsMissing: [],
        warnings: []
      };

      await cacheClassification("email-1", classification);
      await cacheExtraction("email-1", extraction);

      const cached = await getLLMCacheEntry("email-1");
      expect(cached?.classification).toEqual(classification);
      expect(cached?.extraction).toEqual(extraction);
    });
  });

  describe("cacheLLMResult", () => {
    it("sauvegarde classification et extraction ensemble", async () => {
      const classification: ClassificationResult = {
        type: TypeEmail.ANNULATION,
        confidence: 0.98,
        reason: "SESSION ANNULEE"
      };

      const extraction: ExtractionResult = {
        formation: { titre: "Formation annulée" },
        fieldsExtracted: ["titre"],
        fieldsMissing: [],
        warnings: ["Annulation"]
      };

      await cacheLLMResult("email-1", classification, extraction);

      const cached = await getLLMCacheEntry("email-1");
      expect(cached?.classification).toEqual(classification);
      expect(cached?.extraction).toEqual(extraction);
    });

    it("remplace une entrée existante", async () => {
      const oldClassification: ClassificationResult = {
        type: TypeEmail.AUTRE,
        confidence: 0.5,
        reason: "Ancien"
      };

      const newClassification: ClassificationResult = {
        type: TypeEmail.CONVOCATION_INTER,
        confidence: 0.95,
        reason: "Nouveau"
      };

      await cacheLLMResult("email-1", oldClassification, null);
      await cacheLLMResult("email-1", newClassification, null);

      const cached = await getLLMCacheEntry("email-1");
      expect(cached?.classification?.type).toBe(TypeEmail.CONVOCATION_INTER);
    });
  });

  describe("getClassificationsFromCache", () => {
    it("récupère plusieurs classifications en une fois", async () => {
      await cacheClassification("email-1", {
        type: TypeEmail.CONVOCATION_INTER,
        confidence: 0.9,
        reason: "Inter"
      });
      await cacheClassification("email-2", {
        type: TypeEmail.CONVOCATION_INTRA,
        confidence: 0.85,
        reason: "Intra"
      });
      await cacheClassification("email-3", {
        type: TypeEmail.ANNULATION,
        confidence: 0.95,
        reason: "Annulation"
      });

      const results = await getClassificationsFromCache([
        "email-1",
        "email-2",
        "email-3",
        "email-non-existant"
      ]);

      expect(results.size).toBe(3);
      expect(results.get("email-1")?.type).toBe(TypeEmail.CONVOCATION_INTER);
      expect(results.get("email-2")?.type).toBe(TypeEmail.CONVOCATION_INTRA);
      expect(results.get("email-3")?.type).toBe(TypeEmail.ANNULATION);
      expect(results.has("email-non-existant")).toBe(false);
    });

    it("ignore les entrées avec une version de modèle différente", async () => {
      // Simuler une entrée avec une ancienne version
      await db.llmCache.add({
        emailId: "email-old",
        classification: {
          type: TypeEmail.CONVOCATION_INTER,
          confidence: 0.9,
          reason: "Old"
        },
        extraction: null,
        cachedAt: new Date().toISOString(),
        modelVersion: "old-version"
      });

      await cacheClassification("email-new", {
        type: TypeEmail.CONVOCATION_INTRA,
        confidence: 0.9,
        reason: "New"
      });

      const results = await getClassificationsFromCache([
        "email-old",
        "email-new"
      ]);

      expect(results.size).toBe(1);
      expect(results.has("email-old")).toBe(false);
      expect(results.has("email-new")).toBe(true);
    });
  });

  describe("getExtractionsFromCache", () => {
    it("récupère plusieurs extractions", async () => {
      await cacheExtraction("email-1", {
        formation: { titre: "Test 1" },
        fieldsExtracted: ["titre"],
        fieldsMissing: [],
        warnings: []
      });
      await cacheExtraction("email-2", {
        formation: { titre: "Test 2" },
        fieldsExtracted: ["titre"],
        fieldsMissing: [],
        warnings: []
      });

      const results = await getExtractionsFromCache(["email-1", "email-2"]);

      expect(results.size).toBe(2);
      expect(results.get("email-1")?.formation.titre).toBe("Test 1");
      expect(results.get("email-2")?.formation.titre).toBe("Test 2");
    });
  });

  describe("deleteLLMCacheEntry", () => {
    it("supprime une entrée du cache", async () => {
      await cacheClassification("email-1", {
        type: TypeEmail.AUTRE,
        confidence: 0.5,
        reason: "Test"
      });

      await deleteLLMCacheEntry("email-1");

      const cached = await getLLMCacheEntry("email-1");
      expect(cached).toBeUndefined();
    });
  });

  describe("clearLLMCache", () => {
    it("supprime toutes les entrées", async () => {
      await cacheClassification("email-1", {
        type: TypeEmail.AUTRE,
        confidence: 0.5,
        reason: "1"
      });
      await cacheClassification("email-2", {
        type: TypeEmail.AUTRE,
        confidence: 0.5,
        reason: "2"
      });

      await clearLLMCache();

      const count = await countLLMCacheEntries();
      expect(count).toBe(0);
    });
  });

  describe("countLLMCacheEntries", () => {
    it("compte correctement les entrées", async () => {
      expect(await countLLMCacheEntries()).toBe(0);

      await cacheClassification("email-1", {
        type: TypeEmail.AUTRE,
        confidence: 0.5,
        reason: "1"
      });
      expect(await countLLMCacheEntries()).toBe(1);

      await cacheClassification("email-2", {
        type: TypeEmail.AUTRE,
        confidence: 0.5,
        reason: "2"
      });
      expect(await countLLMCacheEntries()).toBe(2);
    });
  });

  describe("invalidateOldCacheEntries", () => {
    it("supprime les entrées avec une ancienne version du modèle", async () => {
      // Créer des entrées avec différentes versions
      await db.llmCache.add({
        emailId: "email-old-1",
        classification: {
          type: TypeEmail.AUTRE,
          confidence: 0.5,
          reason: "Old 1"
        },
        extraction: null,
        cachedAt: new Date().toISOString(),
        modelVersion: "old-v1"
      });
      await db.llmCache.add({
        emailId: "email-old-2",
        classification: {
          type: TypeEmail.AUTRE,
          confidence: 0.5,
          reason: "Old 2"
        },
        extraction: null,
        cachedAt: new Date().toISOString(),
        modelVersion: "old-v2"
      });
      await cacheClassification("email-current", {
        type: TypeEmail.CONVOCATION_INTER,
        confidence: 0.9,
        reason: "Current"
      });

      const deletedCount = await invalidateOldCacheEntries();

      expect(deletedCount).toBe(2);
      expect(await countLLMCacheEntries()).toBe(1);
      expect(await getLLMCacheEntry("email-current")).toBeDefined();
      expect(await getLLMCacheEntry("email-old-1")).toBeUndefined();
    });
  });
});
