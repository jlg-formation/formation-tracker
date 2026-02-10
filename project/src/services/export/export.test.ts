/**
 * Tests pour les services d'export
 */

import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import "fake-indexeddb/auto";
import type { Formation } from "../../types";
import {
  StatutFormation,
  TypeSession,
  NiveauPersonnalisation
} from "../../types";
import {
  generateCsvContent,
  escapeCsv,
  formatDateFr,
  formatDateRange,
  truncate,
  parseExportJson
} from "./index";

// Mock document pour les tests de téléchargement
const mockCreateElement = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockClick = vi.fn();

const g = globalThis as unknown as {
  document?: unknown;
  URL?: unknown;
};

const originalDocument = g.document;
const originalURL = g.URL;

g.document = {
  createElement: mockCreateElement.mockReturnValue({
    href: "",
    download: "",
    click: mockClick
  }),
  body: {
    appendChild: mockAppendChild,
    removeChild: mockRemoveChild
  }
} as unknown;

g.URL = {
  createObjectURL: vi.fn(() => "blob:test"),
  revokeObjectURL: vi.fn()
} as unknown;

afterAll(() => {
  g.document = originalDocument;
  g.URL = originalURL;
});

// Formations de test
function createTestFormation(overrides: Partial<Formation> = {}): Formation {
  return {
    id: "test-001",
    titre: "Formation Test TypeScript",
    codeFormation: "TST",
    codeEtendu: "TSTAA1",
    statut: StatutFormation.CONFIRMEE,
    dateDebut: "2026-03-15",
    dateFin: "2026-03-17",
    dates: ["2026-03-15", "2026-03-16", "2026-03-17"],
    nombreJours: 3,
    lieu: {
      nom: "ORSYS Paris La Défense",
      adresse: "1 Parvis de la Défense, 92044 Paris",
      gps: { lat: 48.8925, lng: 2.2356 }
    },
    typeSession: TypeSession.INTER,
    niveauPersonnalisation: NiveauPersonnalisation.STANDARD,
    nombreParticipants: 8,
    participants: [
      { nom: "Jean Dupont", email: "jean@test.fr" },
      { nom: "Marie Martin", email: "marie@test.fr" }
    ],
    emailIds: ["msg-001"],
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: "2026-02-01T10:00:00.000Z",
    ...overrides
  };
}

describe("Utilitaires d'export", () => {
  describe("escapeCsv", () => {
    it("retourne une chaîne vide pour null/undefined", () => {
      expect(escapeCsv(null)).toBe("");
      expect(escapeCsv(undefined)).toBe("");
    });

    it("retourne la valeur telle quelle si pas de caractères spéciaux", () => {
      expect(escapeCsv("Test simple")).toBe("Test simple");
      expect(escapeCsv("123")).toBe("123");
    });

    it("échappe les guillemets doubles", () => {
      expect(escapeCsv('Test "avec" guillemets')).toBe(
        '"Test ""avec"" guillemets"'
      );
    });

    it("entoure de guillemets si contient une virgule", () => {
      expect(escapeCsv("Test, avec virgule")).toBe('"Test, avec virgule"');
    });

    it("entoure de guillemets si contient un saut de ligne", () => {
      expect(escapeCsv("Test\navec saut")).toBe('"Test\navec saut"');
    });
  });

  describe("formatDateFr", () => {
    it("formate une date au format français", () => {
      const date = new Date("2026-03-15");
      const result = formatDateFr(date);
      expect(result).toMatch(/15\/03\/2026/);
    });
  });

  describe("formatDateRange", () => {
    it("formate une plage de dates", () => {
      const result = formatDateRange("2026-03-15", "2026-03-17");
      expect(result).toMatch(/15\/03-17\/03\/26/);
    });
  });

  describe("truncate", () => {
    it("retourne la chaîne si elle est plus courte que maxLength", () => {
      expect(truncate("Test", 10)).toBe("Test");
    });

    it("tronque avec des points de suspension", () => {
      expect(truncate("Formation très longue", 10)).toBe("Formati...");
    });

    it("gère les chaînes vides", () => {
      expect(truncate("", 10)).toBe("");
    });
  });
});

describe("Export CSV", () => {
  describe("generateCsvContent", () => {
    it("génère un CSV avec les en-têtes", () => {
      const formations: Formation[] = [];
      const csv = generateCsvContent(formations);

      // Vérifie le BOM UTF-8
      expect(csv.charCodeAt(0)).toBe(0xfeff);

      // Vérifie les en-têtes
      expect(csv).toContain("ID,Code,Titre,Statut");
      expect(csv).toContain("Date Debut,Date Fin");
      expect(csv).toContain("Latitude,Longitude");
    });

    it("génère des lignes pour chaque formation", () => {
      const formations: Formation[] = [
        createTestFormation({ id: "f1", codeEtendu: "CODE1" }),
        createTestFormation({ id: "f2", codeEtendu: "CODE2" })
      ];

      const csv = generateCsvContent(formations);
      const lines = csv.split("\n");

      // En-tête + 2 formations
      expect(lines.length).toBe(3);
      expect(csv).toContain("CODE1");
      expect(csv).toContain("CODE2");
    });

    it("inclut les coordonnées GPS", () => {
      const formations: Formation[] = [
        createTestFormation({
          lieu: {
            nom: "Test",
            adresse: "Adresse test",
            gps: { lat: 48.123, lng: 2.456 }
          }
        })
      ];

      const csv = generateCsvContent(formations);
      expect(csv).toContain("48.123");
      expect(csv).toContain("2.456");
    });

    it("gère les formations sans GPS", () => {
      const formations: Formation[] = [
        createTestFormation({
          lieu: {
            nom: "Test",
            adresse: "Adresse test",
            gps: null
          }
        })
      ];

      const csv = generateCsvContent(formations);
      // Doit avoir des virgules vides pour lat/lng
      expect(csv).toContain(",,");
    });

    it("échappe correctement les valeurs avec virgules", () => {
      const formations: Formation[] = [
        createTestFormation({
          titre: "Formation React, Angular et Vue"
        })
      ];

      const csv = generateCsvContent(formations);
      expect(csv).toContain('"Formation React, Angular et Vue"');
    });

    it("inclut les informations de facturation", () => {
      const formations: Formation[] = [
        createTestFormation({
          facturation: {
            entite: "ORSYS",
            referenceIntra: "REF-123"
          }
        })
      ];

      const csv = generateCsvContent(formations);
      expect(csv).toContain("ORSYS");
      expect(csv).toContain("REF-123");
    });
  });
});

describe("Export JSON", () => {
  describe("parseExportJson", () => {
    it("parse un JSON valide", () => {
      const validJson = JSON.stringify({
        metadata: {
          dateExtraction: "2026-02-01T10:00:00.000Z",
          totalFormations: 5,
          formationsAnnulees: 1,
          emailsTraites: 100,
          emailsIgnores: 10
        },
        formations: []
      });

      const result = parseExportJson(validJson);
      expect(result.metadata.totalFormations).toBe(5);
      expect(result.formations).toEqual([]);
    });

    it("lève une erreur si metadata manquant", () => {
      const invalidJson = JSON.stringify({
        formations: []
      });

      expect(() => parseExportJson(invalidJson)).toThrow(
        "Format JSON invalide: metadata ou formations manquants"
      );
    });

    it("lève une erreur si formations n'est pas un tableau", () => {
      const invalidJson = JSON.stringify({
        metadata: { totalFormations: 0 },
        formations: "not an array"
      });

      expect(() => parseExportJson(invalidJson)).toThrow(
        "Format JSON invalide: metadata ou formations manquants"
      );
    });

    it("lève une erreur si totalFormations manquant", () => {
      const invalidJson = JSON.stringify({
        metadata: { dateExtraction: "2026-02-01" },
        formations: []
      });

      expect(() => parseExportJson(invalidJson)).toThrow(
        "Format JSON invalide: totalFormations manquant"
      );
    });

    it("parse les formations correctement", () => {
      const formation = createTestFormation();
      const validJson = JSON.stringify({
        metadata: {
          dateExtraction: "2026-02-01T10:00:00.000Z",
          totalFormations: 1,
          formationsAnnulees: 0,
          emailsTraites: 10,
          emailsIgnores: 0
        },
        formations: [formation]
      });

      const result = parseExportJson(validJson);
      expect(result.formations.length).toBe(1);
      expect(result.formations[0].titre).toBe("Formation Test TypeScript");
    });
  });
});

describe("Formations de test", () => {
  let testFormations: Formation[];

  beforeEach(() => {
    testFormations = [
      createTestFormation({
        id: "f1",
        codeEtendu: "REACT1",
        titre: "Formation React",
        dateDebut: "2026-01-15",
        dateFin: "2026-01-17",
        typeSession: TypeSession.INTER,
        nombreParticipants: 12
      }),
      createTestFormation({
        id: "f2",
        codeEtendu: "PYTHON1",
        titre: "Formation Python",
        dateDebut: "2026-02-10",
        dateFin: "2026-02-12",
        typeSession: TypeSession.INTRA,
        client: "Société ABC",
        nombreParticipants: 8
      }),
      createTestFormation({
        id: "f3",
        codeEtendu: "ANGULAR1",
        titre: "Formation Angular",
        statut: StatutFormation.ANNULEE,
        dateDebut: "2026-03-05",
        dateFin: "2026-03-07",
        typeSession: TypeSession.INTER,
        nombreParticipants: 0
      })
    ];
  });

  it("génère un CSV avec toutes les formations", () => {
    const csv = generateCsvContent(testFormations);
    expect(csv).toContain("REACT1");
    expect(csv).toContain("PYTHON1");
    expect(csv).toContain("ANGULAR1");
    expect(csv).toContain("Société ABC");
    expect(csv).toContain("annulée");
  });

  it("génère un JSON parsable", () => {
    const jsonStr = JSON.stringify({
      metadata: {
        dateExtraction: new Date().toISOString(),
        totalFormations: testFormations.length,
        formationsAnnulees: 1,
        emailsTraites: 50,
        emailsIgnores: 5
      },
      formations: testFormations
    });

    const parsed = parseExportJson(jsonStr);
    expect(parsed.formations.length).toBe(3);
    expect(parsed.metadata.formationsAnnulees).toBe(1);
  });
});
