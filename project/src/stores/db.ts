/**
 * Configuration IndexedDB avec Dexie.js
 * Tables: emails, formations, geocache, settings
 */

import Dexie, { type Table } from "dexie";
import type { EmailRaw, Formation, GeocacheEntry, AppSettings } from "../types";

/**
 * Entrée des paramètres dans IndexedDB
 * On utilise une clé fixe "config" pour stocker les settings uniques
 */
export interface SettingsEntry {
  id: string; // Toujours "config"
  settings: AppSettings;
  updatedAt: string;
}

/**
 * Base de données ORSYS Training Tracker
 */
export class OrsysDatabase extends Dexie {
  emails!: Table<EmailRaw, string>;
  formations!: Table<Formation, string>;
  geocache!: Table<GeocacheEntry, string>;
  settings!: Table<SettingsEntry, string>;

  constructor() {
    super("OrsysTrainingTracker");

    this.version(1).stores({
      // Index sur id, threadId, date, processed, type
      emails: "id, threadId, date, processed, type",
      // Index sur id, codeEtendu, dateDebut, statut, typeSession
      formations: "id, codeEtendu, dateDebut, statut, typeSession, updatedAt",
      // Index sur adresse (clé primaire)
      geocache: "adresse, provider, cachedAt",
      // Settings avec id fixe "config"
      settings: "id"
    });
  }
}

// Instance singleton de la base de données
export const db = new OrsysDatabase();

/**
 * Réinitialise la base de données (pour les tests)
 */
export async function resetDatabase(): Promise<void> {
  await db.emails.clear();
  await db.formations.clear();
  await db.geocache.clear();
  await db.settings.clear();
}

/**
 * Supprime complètement la base de données
 */
export async function deleteDatabase(): Promise<void> {
  await db.delete();
}
