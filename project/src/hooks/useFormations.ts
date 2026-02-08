/**
 * Hook pour récupérer et gérer les formations depuis IndexedDB
 */

import { useState, useEffect, useCallback } from "react";
import type { Formation, FormationFilters } from "../types";
import {
  getAllFormations,
  getFormations,
  addFormation as addFormationToStore,
  updateFormation as updateFormationInStore,
  deleteFormation as deleteFormationFromStore
} from "../stores/formationsStore";

interface UseFormationsReturn {
  /** Liste des formations */
  formations: Formation[];
  /** Indique si les données sont en cours de chargement */
  loading: boolean;
  /** Erreur éventuelle */
  error: Error | null;
  /** Recharger les formations */
  refresh: () => Promise<void>;
  /** Ajouter une formation */
  addFormation: (
    formation: Omit<Formation, "id" | "createdAt" | "updatedAt">
  ) => Promise<Formation>;
  /** Mettre à jour une formation */
  updateFormation: (
    id: string,
    updates: Partial<Omit<Formation, "id" | "createdAt">>
  ) => Promise<Formation | undefined>;
  /** Supprimer une formation */
  deleteFormation: (id: string) => Promise<boolean>;
}

/**
 * Hook pour accéder aux formations stockées dans IndexedDB
 * @param filters Filtres optionnels à appliquer
 */
export function useFormations(filters?: FormationFilters): UseFormationsReturn {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadFormations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = filters
        ? await getFormations(filters)
        : await getAllFormations();
      setFormations(data);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Erreur lors du chargement")
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadFormations();
  }, [loadFormations]);

  const addFormation = useCallback(
    async (
      formation: Omit<Formation, "id" | "createdAt" | "updatedAt">
    ): Promise<Formation> => {
      const newFormation = await addFormationToStore(formation);
      await loadFormations();
      return newFormation;
    },
    [loadFormations]
  );

  const updateFormation = useCallback(
    async (
      id: string,
      updates: Partial<Omit<Formation, "id" | "createdAt">>
    ): Promise<Formation | undefined> => {
      const updated = await updateFormationInStore(id, updates);
      if (updated) {
        await loadFormations();
      }
      return updated;
    },
    [loadFormations]
  );

  const deleteFormation = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await deleteFormationFromStore(id);
      if (result) {
        await loadFormations();
      }
      return result;
    },
    [loadFormations]
  );

  return {
    formations,
    loading,
    error,
    refresh: loadFormations,
    addFormation,
    updateFormation,
    deleteFormation
  };
}
