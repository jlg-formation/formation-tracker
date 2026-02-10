import { describe, it, expect } from "vitest";
import type { Formation } from "../types";
import { StatutFormation, TypeSession, NiveauPersonnalisation } from "../types";
import {
  VIRTUAL_FORMATION_ADDRESS,
  isVirtualFormationCodeEtendu,
  applyVirtualFormationAddress
} from "./virtualFormations";

function createFormation(overrides: Partial<Formation> = {}): Formation {
  const now = new Date().toISOString();
  return {
    id: "ID-1",
    titre: "Titre",
    codeEtendu: "GIAPA1",
    statut: StatutFormation.CONFIRMEE,
    dateDebut: "2024-01-01",
    dateFin: "2024-01-02",
    dates: ["2024-01-01", "2024-01-02"],
    nombreJours: 2,
    lieu: { nom: "X", adresse: "Adresse", gps: { lat: 1, lng: 2 } },
    typeSession: TypeSession.INTER,
    niveauPersonnalisation: NiveauPersonnalisation.STANDARD,
    nombreParticipants: 0,
    participants: [],
    emailIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("virtualFormations", () => {
  describe("isVirtualFormationCodeEtendu", () => {
    it("détecte un code se terminant par CV<n>", () => {
      expect(isVirtualFormationCodeEtendu("GIAPA1CV1")).toBe(true);
      expect(isVirtualFormationCodeEtendu("abcCV9")).toBe(true);
    });

    it("est insensible à la casse et aux espaces", () => {
      expect(isVirtualFormationCodeEtendu("  giapa1cv2 ")).toBe(true);
    });

    it("ne détecte pas les formes non conformes", () => {
      expect(isVirtualFormationCodeEtendu("GIAPA1")).toBe(false);
      expect(isVirtualFormationCodeEtendu("GIAPA1CV")).toBe(false);
      expect(isVirtualFormationCodeEtendu("GIAPA1CV10")).toBe(false);
      expect(isVirtualFormationCodeEtendu("")).toBe(false);
      expect(isVirtualFormationCodeEtendu(null)).toBe(false);
      expect(isVirtualFormationCodeEtendu(undefined)).toBe(false);
    });
  });

  describe("applyVirtualFormationAddress", () => {
    it("force l'adresse et invalide le GPS si la formation n'est pas annulée", () => {
      const formation = createFormation({
        codeEtendu: "GIAPA1CV3",
        lieu: { nom: "X", adresse: "Ancienne", gps: { lat: 48.1, lng: 2.3 } }
      });

      const changed = applyVirtualFormationAddress(formation);

      expect(changed).toBe(true);
      expect(formation.lieu.adresse).toBe(VIRTUAL_FORMATION_ADDRESS);
      expect(formation.lieu.gps).toBeNull();
    });

    it("force l'adresse mais ne modifie pas le GPS si la formation est annulée", () => {
      const formation = createFormation({
        codeEtendu: "GIAPA1CV4",
        statut: StatutFormation.ANNULEE,
        lieu: { nom: "X", adresse: "Ancienne", gps: { lat: 48.1, lng: 2.3 } }
      });

      const changed = applyVirtualFormationAddress(formation);

      expect(changed).toBe(true);
      expect(formation.lieu.adresse).toBe(VIRTUAL_FORMATION_ADDRESS);
      expect(formation.lieu.gps).toEqual({ lat: 48.1, lng: 2.3 });
    });

    it("ne fait rien si l'adresse est déjà correcte", () => {
      const formation = createFormation({
        codeEtendu: "GIAPA1CV5",
        lieu: {
          nom: "X",
          adresse: VIRTUAL_FORMATION_ADDRESS,
          gps: { lat: 1, lng: 2 }
        }
      });

      const changed = applyVirtualFormationAddress(formation);

      expect(changed).toBe(true);
      expect(formation.lieu.adresse).toBe(VIRTUAL_FORMATION_ADDRESS);
      expect(formation.lieu.gps).toBeNull();
    });

    it("ne modifie rien si l'adresse est déjà correcte et le GPS est déjà null", () => {
      const formation = createFormation({
        codeEtendu: "GIAPA1CV6",
        lieu: {
          nom: "X",
          adresse: VIRTUAL_FORMATION_ADDRESS,
          gps: null
        }
      });

      const changed = applyVirtualFormationAddress(formation);

      expect(changed).toBe(false);
      expect(formation.lieu.adresse).toBe(VIRTUAL_FORMATION_ADDRESS);
      expect(formation.lieu.gps).toBeNull();
    });
  });
});
