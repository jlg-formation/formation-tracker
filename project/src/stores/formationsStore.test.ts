/**
 * Tests unitaires pour formationsStore
 * Utilise fake-indexeddb pour mocker IndexedDB
 */

import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db, resetDatabase } from "./db";
import {
  addFormation,
  updateFormation,
  getFormation,
  getAllFormations,
  getFormations,
  deleteFormation,
  clearFormations,
  findFormationByKey,
  upsertFormation,
  countFormations,
  getFormationsByYear
} from "./formationsStore";
import { StatutFormation, TypeSession, NiveauPersonnalisation } from "../types";
import type { Formation } from "../types";

// Formation de test de base
const createTestFormation = (
  overrides: Partial<Omit<Formation, "id" | "createdAt" | "updatedAt">> = {}
): Omit<Formation, "id" | "createdAt" | "updatedAt"> => ({
  titre: "Formation Test",
  codeEtendu: "TEST01",
  statut: StatutFormation.CONFIRMEE,
  dateDebut: "2024-06-15",
  dateFin: "2024-06-17",
  dates: ["2024-06-15", "2024-06-16", "2024-06-17"],
  nombreJours: 3,
  lieu: {
    nom: "ORSYS Paris",
    adresse: "1 rue Test, 75001 Paris",
    gps: { lat: 48.8566, lng: 2.3522 }
  },
  typeSession: TypeSession.INTER,
  niveauPersonnalisation: NiveauPersonnalisation.STANDARD,
  nombreParticipants: 8,
  participants: [],
  emailIds: [],
  ...overrides
});

describe("formationsStore", () => {
  beforeEach(async () => {
    // Reset la base de données avant chaque test
    await resetDatabase();
  });

  describe("addFormation", () => {
    it("devrait ajouter une formation avec id et timestamps", async () => {
      const input = createTestFormation();
      const result = await addFormation(input);

      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(result.titre).toBe("Formation Test");
      expect(result.codeEtendu).toBe("TEST01");
    });

    it("devrait persister la formation dans IndexedDB", async () => {
      const input = createTestFormation();
      const created = await addFormation(input);

      const stored = await db.formations.get(created.id);
      expect(stored).toBeDefined();
      expect(stored?.titre).toBe("Formation Test");
    });
  });

  describe("getFormation", () => {
    it("devrait récupérer une formation par ID", async () => {
      const created = await addFormation(createTestFormation());
      const retrieved = await getFormation(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it("devrait retourner undefined si la formation n'existe pas", async () => {
      const result = await getFormation("inexistant-id");
      expect(result).toBeUndefined();
    });
  });

  describe("updateFormation", () => {
    it("devrait mettre à jour une formation existante", async () => {
      const created = await addFormation(createTestFormation());

      // Attendre 1ms pour garantir un timestamp différent
      await new Promise((resolve) => setTimeout(resolve, 1));

      const updated = await updateFormation(created.id, {
        titre: "Formation Modifiée",
        statut: StatutFormation.ANNULEE
      });

      expect(updated).toBeDefined();
      expect(updated?.titre).toBe("Formation Modifiée");
      expect(updated?.statut).toBe(StatutFormation.ANNULEE);
      // Vérifie que le timestamp a été mis à jour (>= car même ms possible)
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime()
      );
      // Vérifie que createdAt n'a pas changé
      expect(updated?.createdAt).toBe(created.createdAt);
    });

    it("devrait retourner undefined si la formation n'existe pas", async () => {
      const result = await updateFormation("inexistant", { titre: "Test" });
      expect(result).toBeUndefined();
    });
  });

  describe("deleteFormation", () => {
    it("devrait supprimer une formation existante", async () => {
      const created = await addFormation(createTestFormation());
      const result = await deleteFormation(created.id);

      expect(result).toBe(true);
      const remaining = await getFormation(created.id);
      expect(remaining).toBeUndefined();
    });

    it("devrait retourner false si la formation n'existe pas", async () => {
      const result = await deleteFormation("inexistant");
      expect(result).toBe(false);
    });
  });

  describe("getAllFormations", () => {
    it("devrait retourner un tableau vide si aucune formation", async () => {
      const formations = await getAllFormations();
      expect(formations).toEqual([]);
    });

    it("devrait retourner toutes les formations", async () => {
      await addFormation(createTestFormation({ codeEtendu: "A1" }));
      await addFormation(createTestFormation({ codeEtendu: "A2" }));
      await addFormation(createTestFormation({ codeEtendu: "A3" }));

      const formations = await getAllFormations();
      expect(formations).toHaveLength(3);
    });
  });

  describe("getFormations avec filtres", () => {
    beforeEach(async () => {
      // Créer des formations variées pour les tests de filtres
      await addFormation(
        createTestFormation({
          codeEtendu: "INTER01",
          typeSession: TypeSession.INTER,
          statut: StatutFormation.CONFIRMEE,
          dateDebut: "2024-03-15",
          titre: "Python Avancé"
        })
      );
      await addFormation(
        createTestFormation({
          codeEtendu: "INTRA01",
          typeSession: TypeSession.INTRA,
          statut: StatutFormation.CONFIRMEE,
          dateDebut: "2024-06-20",
          titre: "Management"
        })
      );
      await addFormation(
        createTestFormation({
          codeEtendu: "ANNULE01",
          typeSession: TypeSession.INTER,
          statut: StatutFormation.ANNULEE,
          dateDebut: "2025-01-10",
          titre: "Java Basics"
        })
      );
    });

    it("devrait filtrer par statut", async () => {
      const confirmees = await getFormations({
        statut: StatutFormation.CONFIRMEE
      });
      expect(confirmees).toHaveLength(2);

      const annulees = await getFormations({ statut: StatutFormation.ANNULEE });
      expect(annulees).toHaveLength(1);
    });

    it("devrait filtrer par typeSession", async () => {
      const inter = await getFormations({ typeSession: TypeSession.INTER });
      expect(inter).toHaveLength(2);

      const intra = await getFormations({ typeSession: TypeSession.INTRA });
      expect(intra).toHaveLength(1);
    });

    it("devrait filtrer par année", async () => {
      const y2024 = await getFormations({ annee: 2024 });
      expect(y2024).toHaveLength(2);

      const y2025 = await getFormations({ annee: 2025 });
      expect(y2025).toHaveLength(1);
    });

    it("devrait filtrer par recherche textuelle", async () => {
      const python = await getFormations({ search: "python" });
      expect(python).toHaveLength(1);
      expect(python[0].codeEtendu).toBe("INTER01");
    });

    it("devrait combiner plusieurs filtres", async () => {
      const result = await getFormations({
        typeSession: TypeSession.INTER,
        statut: StatutFormation.CONFIRMEE
      });
      expect(result).toHaveLength(1);
      expect(result[0].codeEtendu).toBe("INTER01");
    });
  });

  describe("clearFormations", () => {
    it("devrait supprimer toutes les formations", async () => {
      await addFormation(createTestFormation({ codeEtendu: "A" }));
      await addFormation(createTestFormation({ codeEtendu: "B" }));

      await clearFormations();

      const remaining = await getAllFormations();
      expect(remaining).toHaveLength(0);
    });
  });

  describe("findFormationByKey", () => {
    it("devrait trouver une formation par codeEtendu et dateDebut", async () => {
      await addFormation(
        createTestFormation({
          codeEtendu: "UNIQUE01",
          dateDebut: "2024-07-01"
        })
      );

      const found = await findFormationByKey("UNIQUE01", "2024-07-01");
      expect(found).toBeDefined();
      expect(found?.codeEtendu).toBe("UNIQUE01");
    });

    it("devrait retourner undefined si non trouvée", async () => {
      const found = await findFormationByKey("INEXISTANT", "2024-01-01");
      expect(found).toBeUndefined();
    });
  });

  describe("upsertFormation", () => {
    it("devrait créer une nouvelle formation si elle n'existe pas", async () => {
      const input = createTestFormation({ codeEtendu: "NEW01" });
      const result = await upsertFormation(input);

      expect(result.id).toBeDefined();
      expect(result.codeEtendu).toBe("NEW01");
    });

    it("devrait mettre à jour une formation existante", async () => {
      // Créer
      await addFormation(
        createTestFormation({
          codeEtendu: "UPSERT01",
          dateDebut: "2024-08-01",
          titre: "Original"
        })
      );

      // Upsert avec même clé
      const result = await upsertFormation({
        ...createTestFormation({
          codeEtendu: "UPSERT01",
          dateDebut: "2024-08-01",
          titre: "Modifié"
        })
      });

      expect(result.titre).toBe("Modifié");

      // Vérifier qu'il n'y a toujours qu'une seule formation
      const all = await getAllFormations();
      expect(all).toHaveLength(1);
    });
  });

  describe("countFormations", () => {
    beforeEach(async () => {
      await addFormation(
        createTestFormation({
          typeSession: TypeSession.INTER,
          statut: StatutFormation.CONFIRMEE
        })
      );
      await addFormation(
        createTestFormation({
          codeEtendu: "B",
          typeSession: TypeSession.INTRA,
          statut: StatutFormation.CONFIRMEE
        })
      );
      await addFormation(
        createTestFormation({
          codeEtendu: "C",
          typeSession: TypeSession.INTER,
          statut: StatutFormation.ANNULEE
        })
      );
    });

    it("devrait compter toutes les formations", async () => {
      const count = await countFormations();
      expect(count).toBe(3);
    });

    it("devrait compter par statut", async () => {
      const confirmees = await countFormations({
        statut: StatutFormation.CONFIRMEE
      });
      expect(confirmees).toBe(2);
    });

    it("devrait compter par typeSession", async () => {
      const inter = await countFormations({ typeSession: TypeSession.INTER });
      expect(inter).toBe(2);
    });
  });

  describe("getFormationsByYear", () => {
    beforeEach(async () => {
      await addFormation(
        createTestFormation({
          codeEtendu: "Y2023",
          dateDebut: "2023-05-10"
        })
      );
      await addFormation(
        createTestFormation({
          codeEtendu: "Y2024A",
          dateDebut: "2024-02-15"
        })
      );
      await addFormation(
        createTestFormation({
          codeEtendu: "Y2024B",
          dateDebut: "2024-11-20"
        })
      );
    });

    it("devrait retourner les formations d'une année", async () => {
      const y2024 = await getFormationsByYear(2024);
      expect(y2024).toHaveLength(2);
      expect(y2024.map((f) => f.codeEtendu).sort()).toEqual([
        "Y2024A",
        "Y2024B"
      ]);
    });

    it("devrait retourner un tableau vide si aucune formation", async () => {
      const y2020 = await getFormationsByYear(2020);
      expect(y2020).toHaveLength(0);
    });
  });
});
