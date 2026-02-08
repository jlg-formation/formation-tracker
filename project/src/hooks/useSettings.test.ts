/**
 * Tests pour le hook useSettings
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import "fake-indexeddb/auto";

import { useSettings } from "./useSettings";
import { db } from "../stores/db";
import { saveSettings } from "../stores/settingsStore";

describe("useSettings", () => {
  beforeEach(async () => {
    // Nettoyer la table settings avant chaque test
    await db.settings.clear();
    vi.clearAllMocks();
  });

  it("charge les paramètres par défaut au montage", async () => {
    const { result } = renderHook(() => useSettings());

    // Initialement en chargement
    expect(result.current.loading).toBe(true);

    // Attendre la fin du chargement
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Vérifier les valeurs par défaut
    expect(result.current.settings.geocodingProvider).toBe("nominatim");
    expect(result.current.settings.openaiApiKey).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it("charge les paramètres existants", async () => {
    // Pré-configurer des settings
    await saveSettings({
      openaiApiKey: "sk-existing",
      geocodingProvider: "google"
    });

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings.openaiApiKey).toBe("sk-existing");
    expect(result.current.settings.geocodingProvider).toBe("google");
  });

  it("met à jour les paramètres", async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Mettre à jour
    await act(async () => {
      await result.current.updateSettings({ openaiApiKey: "sk-new-key" });
    });

    expect(result.current.settings.openaiApiKey).toBe("sk-new-key");
    expect(result.current.saving).toBe(false);
  });

  it("indique saving pendant la sauvegarde", async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // On ne peut pas vraiment tester le state intermédiaire
    // mais on vérifie que saving revient à false après
    await act(async () => {
      await result.current.updateSettings({ geocodingProvider: "mapbox" });
    });

    expect(result.current.saving).toBe(false);
    expect(result.current.settings.geocodingProvider).toBe("mapbox");
  });

  it("recharge les paramètres avec reload", async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Modifier directement dans la DB
    await saveSettings({ openaiApiKey: "sk-direct" });

    // Recharger
    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.settings.openaiApiKey).toBe("sk-direct");
  });

  it("préserve les autres settings lors d'une mise à jour partielle", async () => {
    // Pré-configurer
    await saveSettings({
      openaiApiKey: "sk-test",
      geocodingProvider: "google"
    });

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Mettre à jour seulement le provider
    await act(async () => {
      await result.current.updateSettings({ geocodingProvider: "mapbox" });
    });

    // La clé OpenAI doit être préservée
    expect(result.current.settings.openaiApiKey).toBe("sk-test");
    expect(result.current.settings.geocodingProvider).toBe("mapbox");
  });
});
