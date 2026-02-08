/**
 * Store pour la gestion des paramètres de l'application
 * Stockage persistant dans IndexedDB
 */

import { db, type SettingsEntry } from "./db";
import type { AppSettings } from "../types";

/** ID fixe pour les settings (singleton) */
const SETTINGS_ID = "config";

/** Paramètres par défaut */
export const DEFAULT_SETTINGS: AppSettings = {
  geocodingProvider: "nominatim",
  openaiApiKey: undefined,
  googleClientId: undefined,
  googleApiKey: undefined,
  mapboxApiKey: undefined,
  gmailToken: undefined,
  gmailTokenExpiry: undefined
};

/**
 * Récupère les paramètres de l'application
 * @returns Les paramètres ou les valeurs par défaut si non configurés
 */
export async function getSettings(): Promise<AppSettings> {
  const entry = await db.settings.get(SETTINGS_ID);
  if (!entry) {
    return { ...DEFAULT_SETTINGS };
  }
  // Fusionner avec les valeurs par défaut pour gérer les nouvelles propriétés
  return { ...DEFAULT_SETTINGS, ...entry.settings };
}

/**
 * Sauvegarde les paramètres de l'application
 * @param settings Paramètres à sauvegarder (partiels ou complets)
 */
export async function saveSettings(
  settings: Partial<AppSettings>
): Promise<void> {
  const current = await getSettings();
  const merged: AppSettings = { ...current, ...settings };

  const entry: SettingsEntry = {
    id: SETTINGS_ID,
    settings: merged,
    updatedAt: new Date().toISOString()
  };

  await db.settings.put(entry);
}

/**
 * Met à jour une clé spécifique des paramètres
 * @param key Clé à mettre à jour
 * @param value Nouvelle valeur
 */
export async function updateSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  await saveSettings({ [key]: value } as Partial<AppSettings>);
}

/**
 * Réinitialise les paramètres aux valeurs par défaut
 */
export async function resetSettings(): Promise<void> {
  await db.settings.delete(SETTINGS_ID);
}

/**
 * Vérifie si la clé API OpenAI est configurée
 */
export async function hasOpenAIKey(): Promise<boolean> {
  const settings = await getSettings();
  return !!settings.openaiApiKey && settings.openaiApiKey.length > 0;
}

/**
 * Vérifie si le token Gmail est valide (non expiré)
 */
export async function hasValidGmailToken(): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.gmailToken || !settings.gmailTokenExpiry) {
    return false;
  }
  const expiry = new Date(settings.gmailTokenExpiry);
  return expiry > new Date();
}
