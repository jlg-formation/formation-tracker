/**
 * Store pour le cache des résultats LLM (classification et extraction)
 * Évite de réanalyser les emails déjà traités
 */

import { db } from "./db";
import type {
  ClassificationResult,
  ExtractionResult
} from "../services/llm/types";

/**
 * Entrée du cache LLM
 */
export interface LLMCacheEntry {
  /** ID de l'email (clé primaire) */
  emailId: string;
  /** Résultat de classification (null si pas encore classifié) */
  classification: ClassificationResult | null;
  /** Résultat d'extraction (null si pas encore extrait) */
  extraction: ExtractionResult | null;
  /** Date de mise en cache */
  cachedAt: string;
  /** Version du modèle utilisé */
  modelVersion: string;
}

/** Version actuelle du modèle (pour invalidation du cache si besoin) */
export const CURRENT_MODEL_VERSION = "gpt-4o-mini-v1";

/**
 * Récupère une entrée du cache par ID d'email
 */
export async function getLLMCacheEntry(
  emailId: string
): Promise<LLMCacheEntry | undefined> {
  return await db.llmCache.get(emailId);
}

/**
 * Récupère les résultats de classification du cache pour plusieurs emails
 * @returns Map des résultats par ID d'email
 */
export async function getClassificationsFromCache(
  emailIds: string[]
): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>();

  const entries = await db.llmCache.bulkGet(emailIds);

  for (const entry of entries) {
    if (entry?.classification) {
      // Vérifier la version du modèle
      if (entry.modelVersion === CURRENT_MODEL_VERSION) {
        results.set(entry.emailId, entry.classification);
      }
    }
  }

  return results;
}

/**
 * Récupère les résultats d'extraction du cache pour plusieurs emails
 * @returns Map des résultats par ID d'email
 */
export async function getExtractionsFromCache(
  emailIds: string[]
): Promise<Map<string, ExtractionResult>> {
  const results = new Map<string, ExtractionResult>();

  const entries = await db.llmCache.bulkGet(emailIds);

  for (const entry of entries) {
    if (entry?.extraction) {
      // Vérifier la version du modèle
      if (entry.modelVersion === CURRENT_MODEL_VERSION) {
        results.set(entry.emailId, entry.extraction);
      }
    }
  }

  return results;
}

/**
 * Sauvegarde un résultat de classification dans le cache
 */
export async function cacheClassification(
  emailId: string,
  classification: ClassificationResult
): Promise<void> {
  const existing = await db.llmCache.get(emailId);
  const now = new Date().toISOString();

  if (existing) {
    await db.llmCache.update(emailId, {
      classification,
      cachedAt: now,
      modelVersion: CURRENT_MODEL_VERSION
    });
  } else {
    await db.llmCache.add({
      emailId,
      classification,
      extraction: null,
      cachedAt: now,
      modelVersion: CURRENT_MODEL_VERSION
    });
  }
}

/**
 * Sauvegarde un résultat d'extraction dans le cache
 */
export async function cacheExtraction(
  emailId: string,
  extraction: ExtractionResult
): Promise<void> {
  const existing = await db.llmCache.get(emailId);
  const now = new Date().toISOString();

  if (existing) {
    await db.llmCache.update(emailId, {
      extraction,
      cachedAt: now,
      modelVersion: CURRENT_MODEL_VERSION
    });
  } else {
    await db.llmCache.add({
      emailId,
      classification: null,
      extraction,
      cachedAt: now,
      modelVersion: CURRENT_MODEL_VERSION
    });
  }
}

/**
 * Sauvegarde classification et extraction ensemble
 */
export async function cacheLLMResult(
  emailId: string,
  classification: ClassificationResult,
  extraction: ExtractionResult | null
): Promise<void> {
  const now = new Date().toISOString();

  await db.llmCache.put({
    emailId,
    classification,
    extraction,
    cachedAt: now,
    modelVersion: CURRENT_MODEL_VERSION
  });
}

/**
 * Supprime une entrée du cache
 */
export async function deleteLLMCacheEntry(emailId: string): Promise<void> {
  await db.llmCache.delete(emailId);
}

/**
 * Supprime toutes les entrées du cache
 */
export async function clearLLMCache(): Promise<void> {
  await db.llmCache.clear();
}

/**
 * Compte les entrées dans le cache
 */
export async function countLLMCacheEntries(): Promise<number> {
  return await db.llmCache.count();
}

/**
 * Invalide le cache pour une version de modèle différente
 * (supprime les entrées utilisant une ancienne version)
 */
export async function invalidateOldCacheEntries(): Promise<number> {
  const oldEntries = await db.llmCache
    .filter((entry) => entry.modelVersion !== CURRENT_MODEL_VERSION)
    .toArray();

  const idsToDelete = oldEntries.map((e) => e.emailId);
  await db.llmCache.bulkDelete(idsToDelete);

  return idsToDelete.length;
}
