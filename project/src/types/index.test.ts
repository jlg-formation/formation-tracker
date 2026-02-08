/**
 * Tests pour les types et fonctions utilitaires
 */
import { describe, it, expect } from "vitest";
import {
  StatutFormation,
  TypeSession,
  NiveauPersonnalisation,
  TypeEmail,
  EntiteFacturation,
  generateId,
  getFormationKey,
  type PartialFormation,
  type FormationKey
} from "./index";

describe("Enums", () => {
  describe("StatutFormation", () => {
    it("doit avoir les valeurs correctes", () => {
      expect(StatutFormation.CONFIRMEE).toBe("confirmée");
      expect(StatutFormation.ANNULEE).toBe("annulée");
    });

    it("doit avoir exactement 2 valeurs", () => {
      const values = Object.values(StatutFormation);
      expect(values).toHaveLength(2);
    });
  });

  describe("TypeSession", () => {
    it("doit avoir les valeurs correctes", () => {
      expect(TypeSession.INTER).toBe("inter");
      expect(TypeSession.INTRA).toBe("intra");
    });

    it("doit avoir exactement 2 valeurs", () => {
      const values = Object.values(TypeSession);
      expect(values).toHaveLength(2);
    });
  });

  describe("NiveauPersonnalisation", () => {
    it("doit avoir les valeurs correctes", () => {
      expect(NiveauPersonnalisation.STANDARD).toBe("standard");
      expect(NiveauPersonnalisation.SPECIFIQUE).toBe("spécifique");
      expect(NiveauPersonnalisation.ULTRA_SPECIFIQUE).toBe("ultra-spécifique");
    });

    it("doit avoir exactement 3 valeurs", () => {
      const values = Object.values(NiveauPersonnalisation);
      expect(values).toHaveLength(3);
    });
  });

  describe("TypeEmail", () => {
    it("doit avoir les valeurs correctes", () => {
      expect(TypeEmail.CONVOCATION_INTER).toBe("convocation-inter");
      expect(TypeEmail.CONVOCATION_INTRA).toBe("convocation-intra");
      expect(TypeEmail.ANNULATION).toBe("annulation");
      expect(TypeEmail.BON_COMMANDE).toBe("bon-commande");
      expect(TypeEmail.INFO_FACTURATION).toBe("info-facturation");
      expect(TypeEmail.RAPPEL).toBe("rappel");
      expect(TypeEmail.AUTRE).toBe("autre");
    });

    it("doit avoir exactement 7 valeurs", () => {
      const values = Object.values(TypeEmail);
      expect(values).toHaveLength(7);
    });
  });

  describe("EntiteFacturation", () => {
    it("doit avoir les valeurs correctes", () => {
      expect(EntiteFacturation.ORSYS).toBe("ORSYS");
      expect(EntiteFacturation.ORSYS_INSTITUT).toBe("ORSYS INSTITUT");
      expect(EntiteFacturation.ORSYS_BELGIQUE).toBe("ORSYS BELGIQUE");
      expect(EntiteFacturation.ORSYS_SUISSE).toBe("ORSYS SUISSE");
      expect(EntiteFacturation.ORSYS_LUXEMBOURG).toBe("ORSYS LUXEMBOURG");
    });

    it("doit avoir exactement 5 valeurs", () => {
      const values = Object.values(EntiteFacturation);
      expect(values).toHaveLength(5);
    });
  });
});

describe("Fonctions utilitaires", () => {
  describe("generateId", () => {
    it("doit générer un identifiant non vide", () => {
      const id = generateId();
      expect(id).toBeDefined();
      expect(id.length).toBeGreaterThan(0);
    });

    it("doit générer des identifiants uniques", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it("doit avoir le format timestamp-random", () => {
      const id = generateId();
      const parts = id.split("-");
      expect(parts.length).toBe(2);
      expect(Number(parts[0])).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("getFormationKey", () => {
    it("doit générer une clé correcte", () => {
      const formation: PartialFormation = {
        codeEtendu: "GIAPA1",
        dateDebut: "2026-05-15"
      };
      const key = getFormationKey(formation);
      expect(key).toBe("GIAPA1-2026-05-15");
    });

    it("doit générer des clés différentes pour des formations différentes", () => {
      const formation1: PartialFormation = {
        codeEtendu: "GIAPA1",
        dateDebut: "2026-05-15"
      };
      const formation2: PartialFormation = {
        codeEtendu: "GIAPA1",
        dateDebut: "2026-06-20"
      };
      const formation3: PartialFormation = {
        codeEtendu: "BOA1",
        dateDebut: "2026-05-15"
      };

      const key1 = getFormationKey(formation1);
      const key2 = getFormationKey(formation2);
      const key3 = getFormationKey(formation3);

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });

    it("doit générer la même clé pour des formations avec même code et date", () => {
      const formation1: PartialFormation = {
        codeEtendu: "GIAPA1",
        dateDebut: "2026-05-15",
        titre: "Formation A"
      };
      const formation2: PartialFormation = {
        codeEtendu: "GIAPA1",
        dateDebut: "2026-05-15",
        titre: "Formation B"
      };

      expect(getFormationKey(formation1)).toBe(getFormationKey(formation2));
    });

    it("doit retourner un type FormationKey", () => {
      const formation: PartialFormation = {
        codeEtendu: "TEST",
        dateDebut: "2026-01-01"
      };
      const key: FormationKey = getFormationKey(formation);
      expect(typeof key).toBe("string");
    });
  });
});
