/**
 * Store pour la gestion des formations dans IndexedDB
 */

import { db } from "./db";
import type { Formation, FormationFilters } from "../types";
import { StatutFormation, TypeSession } from "../types";
import { generateId } from "../types";
import { applyVirtualFormationAddress } from "../utils/virtualFormations";

/**
 * Ajoute une nouvelle formation
 */
export async function addFormation(
  formation: Omit<Formation, "id" | "createdAt" | "updatedAt">
): Promise<Formation> {
  const now = new Date().toISOString();
  const newFormation: Formation = {
    ...formation,
    id: generateId(),
    createdAt: now,
    updatedAt: now
  };

  await db.formations.add(newFormation);
  return newFormation;
}

/**
 * Met à jour une formation existante
 */
export async function updateFormation(
  id: string,
  updates: Partial<Omit<Formation, "id" | "createdAt">>
): Promise<Formation | undefined> {
  const existing = await db.formations.get(id);
  if (!existing) {
    return undefined;
  }

  const becomesOrIsCancelled =
    existing.statut === StatutFormation.ANNULEE ||
    updates.statut === StatutFormation.ANNULEE;

  // Règle métier : il est interdit de géocoder (donc de modifier le GPS)
  // d'une formation annulée. On bloque toute mise à jour de lieu.gps dans ce cas.
  let sanitizedUpdates = updates;
  if (becomesOrIsCancelled && updates.lieu && "gps" in updates.lieu) {
    sanitizedUpdates = {
      ...updates,
      lieu: {
        ...existing.lieu,
        ...updates.lieu,
        gps: existing.lieu.gps
      }
    };
  }

  const updatedFormation: Formation = {
    ...existing,
    ...sanitizedUpdates,
    updatedAt: new Date().toISOString()
  };

  await db.formations.put(updatedFormation);
  return updatedFormation;
}

/**
 * Récupère une formation par son ID
 */
export async function getFormation(id: string): Promise<Formation | undefined> {
  return await db.formations.get(id);
}

/**
 * Récupère toutes les formations
 */
export async function getAllFormations(): Promise<Formation[]> {
  return await db.formations.toArray();
}

/**
 * Récupère les formations avec filtres optionnels
 */
export async function getFormations(
  filters?: FormationFilters
): Promise<Formation[]> {
  const collection = db.formations.toCollection();

  if (!filters) {
    return collection.toArray();
  }

  // On récupère toutes les formations puis on filtre en mémoire
  // (Dexie ne supporte pas les filtres complexes multi-champs)
  const allFormations = await collection.toArray();
  let formations = [...allFormations];

  if (filters.statut) {
    formations = formations.filter((f) => f.statut === filters.statut);
  }

  if (filters.typeSession) {
    formations = formations.filter(
      (f) => f.typeSession === filters.typeSession
    );
  }

  if (filters.annee) {
    formations = formations.filter((f) => {
      const year = new Date(f.dateDebut).getFullYear();
      return year === filters.annee;
    });
  }

  if (filters.codeFormation) {
    formations = formations.filter(
      (f) =>
        f.codeFormation === filters.codeFormation ||
        f.codeEtendu === filters.codeFormation
    );
  }

  if (filters.lieu) {
    formations = formations.filter((f) =>
      f.lieu.nom.toLowerCase().includes(filters.lieu!.toLowerCase())
    );
  }

  if (filters.dateDebut) {
    formations = formations.filter((f) => f.dateDebut >= filters.dateDebut!);
  }

  if (filters.dateFin) {
    formations = formations.filter((f) => f.dateDebut <= filters.dateFin!);
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    formations = formations.filter(
      (f) =>
        f.titre.toLowerCase().includes(searchLower) ||
        f.codeEtendu.toLowerCase().includes(searchLower) ||
        (f.codeFormation?.toLowerCase().includes(searchLower) ?? false) ||
        f.lieu.nom.toLowerCase().includes(searchLower)
    );
  }

  return formations;
}

/**
 * Supprime une formation par son ID
 */
export async function deleteFormation(id: string): Promise<boolean> {
  const existing = await db.formations.get(id);
  if (!existing) {
    return false;
  }

  await db.formations.delete(id);
  return true;
}

/**
 * Supprime toutes les formations
 */
export async function clearFormations(): Promise<void> {
  await db.formations.clear();
}

/**
 * Recherche une formation par code étendu et date de début (clé unique)
 */
export async function findFormationByKey(
  codeEtendu: string,
  dateDebut: string
): Promise<Formation | undefined> {
  const formations = await db.formations
    .where("codeEtendu")
    .equals(codeEtendu)
    .and((f) => f.dateDebut === dateDebut)
    .toArray();

  return formations[0];
}

/**
 * Ajoute ou met à jour une formation (upsert basé sur codeEtendu + dateDebut)
 */
export async function upsertFormation(
  formation: Omit<Formation, "id" | "createdAt" | "updatedAt">
): Promise<Formation> {
  const existing = await findFormationByKey(
    formation.codeEtendu,
    formation.dateDebut
  );

  if (existing) {
    const updated = await updateFormation(existing.id, formation);
    return updated!;
  }

  return await addFormation(formation);
}

/**
 * Compte le nombre total de formations
 */
export async function countFormations(filters?: {
  statut?: StatutFormation;
  typeSession?: TypeSession;
}): Promise<number> {
  if (!filters) {
    return await db.formations.count();
  }

  const collection = db.formations.toCollection();
  let count = 0;

  await collection.each((formation) => {
    let match = true;
    if (filters.statut && formation.statut !== filters.statut) {
      match = false;
    }
    if (filters.typeSession && formation.typeSession !== filters.typeSession) {
      match = false;
    }
    if (match) count++;
  });

  return count;
}

/**
 * Récupère les formations par année
 */
export async function getFormationsByYear(year: number): Promise<Formation[]> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  return await db.formations
    .where("dateDebut")
    .between(startDate, endDate, true, true)
    .toArray();
}

/**
 * Corrige l'adresse des formations virtuelles (clarification 014) sans relancer
 * une analyse LLM.
 *
 * - Identifie les formations dont `codeEtendu` se termine par `CV<n>` (0..9)
 * - Force `lieu.adresse` à l'adresse virtuelle
 * - Met `lieu.gps` à null si la formation n'est pas annulée
 *
 * @returns Nombre de formations mises à jour
 */
export async function correctVirtualFormationsAddress(): Promise<{
  scanned: number;
  updated: number;
}> {
  const formations = await db.formations.toArray();
  const now = new Date().toISOString();
  const toUpdate: Formation[] = [];

  for (const formation of formations) {
    const changed = applyVirtualFormationAddress(formation);
    if (!changed) continue;

    formation.updatedAt = now;
    toUpdate.push(formation);
  }

  if (toUpdate.length > 0) {
    await db.formations.bulkPut(toUpdate);
  }

  return { scanned: formations.length, updated: toUpdate.length };
}
