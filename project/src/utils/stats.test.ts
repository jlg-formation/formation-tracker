/**
 * Tests pour les utilitaires de statistiques
 */

import { describe, expect, it } from "vitest";
import {
  calculateStats,
  calculateCancellationRate,
  calculateInterRate,
  calculateIntraRate,
  calculateAvgDaysPerFormation,
  calculateAvgParticipantsPerFormation,
  getSortedYears,
  getEmptyStats
} from "./stats";
import type { Formation } from "../types";
import { StatutFormation, TypeSession, NiveauPersonnalisation } from "../types";

// Helper pour créer une formation de test
function createFormation(overrides: Partial<Formation> = {}): Formation {
  return {
    id: "test-" + Math.random().toString(36).slice(2),
    titre: "Formation Test",
    codeEtendu: "TEST01",
    statut: StatutFormation.CONFIRMEE,
    dateDebut: "2025-01-15",
    dateFin: "2025-01-17",
    dates: ["2025-01-15", "2025-01-16", "2025-01-17"],
    nombreJours: 3,
    lieu: {
      nom: "ORSYS Paris",
      adresse: "1 Parvis de la Défense, 92044 Courbevoie",
      gps: { lat: 48.892, lng: 2.236 }
    },
    typeSession: TypeSession.INTER,
    niveauPersonnalisation: NiveauPersonnalisation.STANDARD,
    nombreParticipants: 8,
    participants: [],
    emailIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe("calculateStats", () => {
  it("retourne des stats vides pour une liste vide", () => {
    const stats = calculateStats([]);
    expect(stats.total).toBe(0);
    expect(stats.annulees).toBe(0);
    expect(stats.totalJours).toBe(0);
    expect(stats.totalParticipants).toBe(0);
    expect(stats.inter).toBe(0);
    expect(stats.intra).toBe(0);
    expect(stats.parAnnee).toEqual({});
    expect(stats.parCode).toEqual([]);
  });

  it("compte correctement le nombre total de formations", () => {
    const formations = [
      createFormation(),
      createFormation(),
      createFormation()
    ];
    const stats = calculateStats(formations);
    expect(stats.total).toBe(3);
  });

  it("compte correctement les formations annulées", () => {
    const formations = [
      createFormation({ statut: StatutFormation.CONFIRMEE }),
      createFormation({ statut: StatutFormation.ANNULEE }),
      createFormation({ statut: StatutFormation.ANNULEE })
    ];
    const stats = calculateStats(formations);
    expect(stats.annulees).toBe(2);
  });

  it("calcule correctement le total de jours (uniquement confirmées)", () => {
    const formations = [
      createFormation({
        statut: StatutFormation.CONFIRMEE,
        nombreJours: 3
      }),
      createFormation({
        statut: StatutFormation.CONFIRMEE,
        nombreJours: 2
      }),
      createFormation({
        statut: StatutFormation.ANNULEE,
        nombreJours: 5
      })
    ];
    const stats = calculateStats(formations);
    // Seules les formations confirmées comptent : 3 + 2 = 5
    expect(stats.totalJours).toBe(5);
  });

  it("calcule correctement le total de participants", () => {
    const formations = [
      createFormation({ nombreParticipants: 10 }),
      createFormation({ nombreParticipants: 5 }),
      createFormation({ nombreParticipants: 8 })
    ];
    const stats = calculateStats(formations);
    expect(stats.totalParticipants).toBe(23);
  });

  it("compte correctement les formations inter et intra", () => {
    const formations = [
      createFormation({ typeSession: TypeSession.INTER }),
      createFormation({ typeSession: TypeSession.INTER }),
      createFormation({ typeSession: TypeSession.INTRA }),
      createFormation({ typeSession: TypeSession.INTER }),
      createFormation({ typeSession: TypeSession.INTRA })
    ];
    const stats = calculateStats(formations);
    expect(stats.inter).toBe(3);
    expect(stats.intra).toBe(2);
  });

  it("calcule correctement la répartition par année", () => {
    const formations = [
      createFormation({ dateDebut: "2024-03-15" }),
      createFormation({ dateDebut: "2024-06-20" }),
      createFormation({ dateDebut: "2025-01-10" }),
      createFormation({ dateDebut: "2023-11-05" })
    ];
    const stats = calculateStats(formations);
    expect(stats.parAnnee).toEqual({
      2023: 1,
      2024: 2,
      2025: 1
    });
  });

  it("calcule correctement le top 10 des codes formation", () => {
    const formations = [
      createFormation({ codeEtendu: "GIAPA1", titre: "Formation React" }),
      createFormation({ codeEtendu: "GIAPA1", titre: "Formation React" }),
      createFormation({ codeEtendu: "GIAPA1", titre: "Formation React" }),
      createFormation({ codeEtendu: "BOA", titre: "Formation Python" }),
      createFormation({ codeEtendu: "BOA", titre: "Formation Python" }),
      createFormation({ codeEtendu: "IHMPA1", titre: "Formation Angular" })
    ];
    const stats = calculateStats(formations);
    expect(stats.parCode).toHaveLength(3);
    expect(stats.parCode[0]).toEqual({
      code: "GIAPA1",
      count: 3,
      titre: "Formation React"
    });
    expect(stats.parCode[1]).toEqual({
      code: "BOA",
      count: 2,
      titre: "Formation Python"
    });
    expect(stats.parCode[2]).toEqual({
      code: "IHMPA1",
      count: 1,
      titre: "Formation Angular"
    });
  });

  it("limite le parCode à 10 éléments", () => {
    // Créer 12 codes différents
    const formations = [];
    for (let i = 1; i <= 12; i++) {
      formations.push(
        createFormation({
          codeEtendu: `CODE${i.toString().padStart(2, "0")}`,
          titre: `Formation ${i}`
        })
      );
    }
    const stats = calculateStats(formations);
    expect(stats.parCode).toHaveLength(10);
  });

  it("utilise codeFormation si codeEtendu est absent", () => {
    const formations = [
      createFormation({
        codeEtendu: "",
        codeFormation: "BOA",
        titre: "Formation test"
      })
    ];
    const stats = calculateStats(formations);
    expect(stats.parCode[0].code).toBe("BOA");
  });

  it("utilise INCONNU si aucun code n'est présent", () => {
    const formations = [
      createFormation({
        codeEtendu: "",
        codeFormation: undefined,
        titre: "Formation sans code"
      })
    ];
    const stats = calculateStats(formations);
    expect(stats.parCode[0].code).toBe("INCONNU");
  });
});

describe("calculateCancellationRate", () => {
  it("retourne 0 pour aucune formation", () => {
    const stats = getEmptyStats();
    expect(calculateCancellationRate(stats)).toBe(0);
  });

  it("calcule correctement le taux d'annulation", () => {
    const stats = { ...getEmptyStats(), total: 100, annulees: 15 };
    expect(calculateCancellationRate(stats)).toBe(15);
  });

  it("arrondit le résultat", () => {
    const stats = { ...getEmptyStats(), total: 7, annulees: 2 };
    // 2/7 = 28.57... → 29%
    expect(calculateCancellationRate(stats)).toBe(29);
  });
});

describe("calculateInterRate", () => {
  it("retourne 0 pour aucune formation", () => {
    const stats = getEmptyStats();
    expect(calculateInterRate(stats)).toBe(0);
  });

  it("calcule correctement le pourcentage inter", () => {
    const stats = { ...getEmptyStats(), total: 100, inter: 65, intra: 35 };
    expect(calculateInterRate(stats)).toBe(65);
  });
});

describe("calculateIntraRate", () => {
  it("retourne 0 pour aucune formation", () => {
    const stats = getEmptyStats();
    expect(calculateIntraRate(stats)).toBe(0);
  });

  it("calcule correctement le pourcentage intra", () => {
    const stats = { ...getEmptyStats(), total: 100, inter: 65, intra: 35 };
    expect(calculateIntraRate(stats)).toBe(35);
  });
});

describe("calculateAvgDaysPerFormation", () => {
  it("retourne 0 si aucune formation confirmée", () => {
    const stats = { ...getEmptyStats(), total: 5, annulees: 5 };
    expect(calculateAvgDaysPerFormation(stats)).toBe(0);
  });

  it("calcule correctement la moyenne de jours", () => {
    const stats = {
      ...getEmptyStats(),
      total: 10,
      annulees: 2,
      totalJours: 24
    };
    // 24 jours / 8 formations confirmées = 3 jours
    expect(calculateAvgDaysPerFormation(stats)).toBe(3);
  });

  it("arrondit à une décimale", () => {
    const stats = {
      ...getEmptyStats(),
      total: 10,
      annulees: 0,
      totalJours: 25
    };
    // 25 / 10 = 2.5
    expect(calculateAvgDaysPerFormation(stats)).toBe(2.5);
  });
});

describe("calculateAvgParticipantsPerFormation", () => {
  it("retourne 0 pour aucune formation", () => {
    const stats = getEmptyStats();
    expect(calculateAvgParticipantsPerFormation(stats)).toBe(0);
  });

  it("calcule correctement la moyenne de participants", () => {
    const stats = {
      ...getEmptyStats(),
      total: 10,
      totalParticipants: 80
    };
    expect(calculateAvgParticipantsPerFormation(stats)).toBe(8);
  });
});

describe("getSortedYears", () => {
  it("retourne un tableau vide pour un objet vide", () => {
    expect(getSortedYears({})).toEqual([]);
  });

  it("retourne les années triées", () => {
    const parAnnee = { 2025: 5, 2023: 3, 2024: 7, 2020: 1 };
    expect(getSortedYears(parAnnee)).toEqual([2020, 2023, 2024, 2025]);
  });
});

describe("getEmptyStats", () => {
  it("retourne des statistiques vides", () => {
    const stats = getEmptyStats();
    expect(stats).toEqual({
      total: 0,
      annulees: 0,
      totalJours: 0,
      totalParticipants: 0,
      inter: 0,
      intra: 0,
      parAnnee: {},
      parCode: []
    });
  });
});
