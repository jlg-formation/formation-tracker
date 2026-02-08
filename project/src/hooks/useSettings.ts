/**
 * Hook React pour la gestion des paramètres de l'application
 */

import { useState, useEffect, useCallback } from "react";
import type { AppSettings } from "../types";
import {
  getSettings,
  saveSettings,
  DEFAULT_SETTINGS
} from "../stores/settingsStore";

export interface UseSettingsReturn {
  /** Paramètres actuels */
  settings: AppSettings;
  /** Chargement en cours */
  loading: boolean;
  /** Erreur éventuelle */
  error: string | null;
  /** Sauvegarde en cours */
  saving: boolean;
  /** Met à jour les paramètres */
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  /** Recharge les paramètres depuis IndexedDB */
  reload: () => Promise<void>;
}

/**
 * Hook pour gérer les paramètres de l'application
 * Charge automatiquement les settings au montage
 */
export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charge les paramètres au montage
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const loaded = await getSettings();
      setSettings(loaded);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors du chargement"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger au montage
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Met à jour et sauvegarde les paramètres
  const updateSettings = useCallback(
    async (updates: Partial<AppSettings>) => {
      try {
        setSaving(true);
        setError(null);

        // Mettre à jour l'état local immédiatement
        const newSettings = { ...settings, ...updates };
        setSettings(newSettings);

        // Sauvegarder dans IndexedDB
        await saveSettings(updates);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erreur lors de la sauvegarde"
        );
        // Recharger l'état précédent en cas d'erreur
        await loadSettings();
      } finally {
        setSaving(false);
      }
    },
    [settings, loadSettings]
  );

  return {
    settings,
    loading,
    error,
    saving,
    updateSettings,
    reload: loadSettings
  };
}
