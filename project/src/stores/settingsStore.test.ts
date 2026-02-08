/**
 * Tests pour settingsStore
 */

import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";

import {
  getSettings,
  saveSettings,
  updateSetting,
  resetSettings,
  hasOpenAIKey,
  hasValidGmailToken,
  DEFAULT_SETTINGS
} from "./settingsStore";
import { db } from "./db";

describe("settingsStore", () => {
  beforeEach(async () => {
    // Nettoyer la table settings avant chaque test
    await db.settings.clear();
  });

  describe("getSettings", () => {
    it("retourne les valeurs par défaut si aucun paramètre n'est configuré", async () => {
      const settings = await getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it("retourne les paramètres sauvegardés", async () => {
      await saveSettings({ openaiApiKey: "sk-test-key" });
      const settings = await getSettings();
      expect(settings.openaiApiKey).toBe("sk-test-key");
      expect(settings.geocodingProvider).toBe("nominatim"); // défaut
    });
  });

  describe("saveSettings", () => {
    it("sauvegarde les paramètres partiels", async () => {
      await saveSettings({ openaiApiKey: "sk-123" });
      const settings = await getSettings();
      expect(settings.openaiApiKey).toBe("sk-123");
    });

    it("fusionne avec les paramètres existants", async () => {
      await saveSettings({ openaiApiKey: "sk-123" });
      await saveSettings({ geocodingProvider: "google" });

      const settings = await getSettings();
      expect(settings.openaiApiKey).toBe("sk-123");
      expect(settings.geocodingProvider).toBe("google");
    });

    it("écrase les valeurs existantes", async () => {
      await saveSettings({ openaiApiKey: "sk-old" });
      await saveSettings({ openaiApiKey: "sk-new" });

      const settings = await getSettings();
      expect(settings.openaiApiKey).toBe("sk-new");
    });
  });

  describe("updateSetting", () => {
    it("met à jour une seule clé", async () => {
      await updateSetting("geocodingProvider", "mapbox");
      const settings = await getSettings();
      expect(settings.geocodingProvider).toBe("mapbox");
    });
  });

  describe("resetSettings", () => {
    it("supprime tous les paramètres sauvegardés", async () => {
      await saveSettings({
        openaiApiKey: "sk-test",
        geocodingProvider: "google"
      });

      await resetSettings();
      const settings = await getSettings();

      expect(settings.openaiApiKey).toBeUndefined();
      expect(settings.geocodingProvider).toBe("nominatim");
    });
  });

  describe("hasOpenAIKey", () => {
    it("retourne false si pas de clé", async () => {
      expect(await hasOpenAIKey()).toBe(false);
    });

    it("retourne false si clé vide", async () => {
      await saveSettings({ openaiApiKey: "" });
      expect(await hasOpenAIKey()).toBe(false);
    });

    it("retourne true si clé configurée", async () => {
      await saveSettings({ openaiApiKey: "sk-valid" });
      expect(await hasOpenAIKey()).toBe(true);
    });
  });

  describe("hasValidGmailToken", () => {
    it("retourne false si pas de token", async () => {
      expect(await hasValidGmailToken()).toBe(false);
    });

    it("retourne false si token expiré", async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      await saveSettings({
        gmailToken: "token123",
        gmailTokenExpiry: pastDate
      });
      expect(await hasValidGmailToken()).toBe(false);
    });

    it("retourne true si token valide", async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      await saveSettings({
        gmailToken: "token123",
        gmailTokenExpiry: futureDate
      });
      expect(await hasValidGmailToken()).toBe(true);
    });
  });
});
