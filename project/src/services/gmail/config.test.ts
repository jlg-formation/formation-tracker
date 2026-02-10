/**
 * Tests pour la configuration Gmail et le filtrage des emails
 * Clarification 010 : filtrage par regex pour économiser les appels LLM
 */

import { describe, it, expect } from "vitest";
import { shouldExcludeEmail, EXCLUDED_SUBJECT_PATTERNS } from "./config";

describe("shouldExcludeEmail", () => {
  describe("Emails à exclure (ne pas envoyer au LLM)", () => {
    it("doit exclure 'Planning ORSYS Réactualisé'", () => {
      expect(shouldExcludeEmail("Planning ORSYS Réactualisé")).toBe(true);
      expect(
        shouldExcludeEmail("Planning ORSYS Réactualisé - Février 2026")
      ).toBe(true);
      expect(shouldExcludeEmail("[Important] Planning ORSYS Réactualisé")).toBe(
        true
      );
    });

    it("doit exclure 'Planning ORSYS Réactualisé' (insensible à la casse)", () => {
      expect(shouldExcludeEmail("planning orsys réactualisé")).toBe(true);
      expect(shouldExcludeEmail("PLANNING ORSYS RÉACTUALISÉ")).toBe(true);
    });

    it("doit exclure 'Demande Intra '", () => {
      expect(shouldExcludeEmail("Demande Intra - Formation Angular")).toBe(
        true
      );
      expect(shouldExcludeEmail("Demande Intra Client ABC")).toBe(true);
      expect(shouldExcludeEmail("Re: Demande Intra Formation")).toBe(true);
    });

    it("doit exclure 'Demande Intra ' (insensible à la casse)", () => {
      expect(shouldExcludeEmail("demande intra formation")).toBe(true);
      expect(shouldExcludeEmail("DEMANDE INTRA URGENTE")).toBe(true);
    });
  });

  describe("Emails à garder (envoyer au LLM)", () => {
    it("ne doit pas exclure les convocations inter", () => {
      expect(shouldExcludeEmail("Confirmation animation inter - GIAPA1")).toBe(
        false
      );
      expect(shouldExcludeEmail("Convocation formation inter")).toBe(false);
    });

    it("ne doit pas exclure les convocations intra", () => {
      expect(
        shouldExcludeEmail("Confirmation animation intra - ABC Corp")
      ).toBe(false);
      expect(shouldExcludeEmail("Convocation formation intra")).toBe(false);
    });

    it("ne doit pas exclure les annulations", () => {
      expect(shouldExcludeEmail("SESSION ANNULEE - GIAPA1")).toBe(false);
      expect(shouldExcludeEmail("Annulation formation")).toBe(false);
    });

    it("ne doit pas exclure les bons de commande", () => {
      expect(shouldExcludeEmail("Bon de commande - Formation")).toBe(false);
    });

    it("ne doit pas exclure les émargements", () => {
      expect(shouldExcludeEmail("Service suivi qualité inter")).toBe(false);
      expect(shouldExcludeEmail("Feuille d'émargement")).toBe(false);
    });

    it("ne doit pas exclure les accusés de réception", () => {
      expect(shouldExcludeEmail("Service Suivi Qualité Logistique")).toBe(
        false
      );
    });

    it("ne doit pas exclure 'DemandeIntra' (sans espace)", () => {
      // Le pattern est "Demande Intra " avec un espace
      expect(shouldExcludeEmail("DemandeIntra")).toBe(false);
    });

    it("ne doit pas exclure les sujets vides", () => {
      expect(shouldExcludeEmail("")).toBe(false);
    });
  });

  describe("EXCLUDED_SUBJECT_PATTERNS", () => {
    it("doit contenir exactement 2 patterns", () => {
      expect(EXCLUDED_SUBJECT_PATTERNS).toHaveLength(2);
    });

    it("doit avoir des patterns RegExp valides", () => {
      for (const pattern of EXCLUDED_SUBJECT_PATTERNS) {
        expect(pattern).toBeInstanceOf(RegExp);
      }
    });
  });
});
