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

  it("compte correctement le nombre total de formations (hors annulées)", () => {
    const formations = [
      createFormation({ statut: StatutFormation.CONFIRMEE }),
      createFormation({ statut: StatutFormation.CONFIRMEE }),
      createFormation({ statut: StatutFormation.ANNULEE })
    ];
    const stats = calculateStats(formations);
    expect(stats.total).toBe(2); // Seules les confirmées
    expect(stats.annulees).toBe(1);
  });

  it("compte correctement les formations annulées (séparément du total)", () => {
    const formations = [
      createFormation({ statut: StatutFormation.CONFIRMEE }),
      createFormation({ statut: StatutFormation.ANNULEE }),
      createFormation({ statut: StatutFormation.ANNULEE })
    ];
    const stats = calculateStats(formations);
    expect(stats.total).toBe(1); // Hors annulées
    expect(stats.annulees).toBe(2);
  });

  it("calcule correctement le total de jours (hors annulées)", () => {
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
    expect(stats.total).toBe(2); // Hors annulées
  });

  it("calcule correctement le total de participants (hors annulées)", () => {
    const formations = [
      createFormation({
        statut: StatutFormation.CONFIRMEE,
        nombreParticipants: 10
      }),
      createFormation({
        statut: StatutFormation.CONFIRMEE,
        nombreParticipants: 5
      }),
      createFormation({
        statut: StatutFormation.ANNULEE,
        nombreParticipants: 8
      })
    ];
    const stats = calculateStats(formations);
    expect(stats.totalParticipants).toBe(15); // 10 + 5, excluant les 8 de l'annulée
    expect(stats.total).toBe(2);
  });

  it("compte correctement les formations inter et intra (hors annulées)", () => {
    const formations = [
      createFormation({
        typeSession: TypeSession.INTER,
        statut: StatutFormation.CONFIRMEE
      }),
      createFormation({
        typeSession: TypeSession.INTER,
        statut: StatutFormation.CONFIRMEE
      }),
      createFormation({
        typeSession: TypeSession.INTRA,
        statut: StatutFormation.CONFIRMEE
      }),
      createFormation({
        typeSession: TypeSession.INTER,
        statut: StatutFormation.ANNULEE
      }), // Exclue
      createFormation({
        typeSession: TypeSession.INTRA,
        statut: StatutFormation.CONFIRMEE
      })
    ];
    const stats = calculateStats(formations);
    expect(stats.inter).toBe(2); // 3 inter - 1 annulée
    expect(stats.intra).toBe(2);
    expect(stats.total).toBe(4);
    expect(stats.annulees).toBe(1);
  });

  it("calcule correctement la répartition par année (hors annulées)", () => {
    const formations = [
      createFormation({
        dateDebut: "2024-03-15",
        statut: StatutFormation.CONFIRMEE
      }),
      createFormation({
        dateDebut: "2024-06-20",
        statut: StatutFormation.ANNULEE
      }), // Exclue
      createFormation({
        dateDebut: "2025-01-10",
        statut: StatutFormation.CONFIRMEE
      }),
      createFormation({
        dateDebut: "2023-11-05",
        statut: StatutFormation.CONFIRMEE
      })
    ];
    const stats = calculateStats(formations);
    expect(stats.parAnnee).toEqual({
      2023: 1,
      2024: 1, // Une seule car l'autre est annulée
      2025: 1
    });
    expect(stats.total).toBe(3);
    expect(stats.annulees).toBe(1);
  });

  it("calcule correctement le top 10 des codes formation (hors annulées)", () => {
    const formations = [
      createFormation({
        codeEtendu: "GIAPA1",
        titre: "Formation React",
        statut: StatutFormation.CONFIRMEE
      }),
      createFormation({
        codeEtendu: "GIAPA1",
        titre: "Formation React",
        statut: StatutFormation.CONFIRMEE
      }),
      createFormation({
        codeEtendu: "GIAPA1",
        titre: "Formation React",
        statut: StatutFormation.ANNULEE
      }), // Exclue
      createFormation({
        codeEtendu: "BOA",
        titre: "Formation Python",
        statut: StatutFormation.CONFIRMEE
      }),
      createFormation({
        codeEtendu: "BOA",
        titre: "Formation Python",
        statut: StatutFormation.CONFIRMEE
      }),
      createFormation({
        codeEtendu: "IHMPA1",
        titre: "Formation Angular",
        statut: StatutFormation.CONFIRMEE
      })
    ];
    const stats = calculateStats(formations);
    expect(stats.parCode).toHaveLength(3);
    expect(stats.parCode[0]).toEqual({
      code: "GIAPA1",
      count: 2, // 3 - 1 annulée
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
    expect(stats.total).toBe(5);
    expect(stats.annulees).toBe(1);
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

  it("calcule correctement le taux d'annulation (basé sur total + annulées)", () => {
    // total = 85 (hors annulées), annulees = 15 → total réel = 100
    const stats = { ...getEmptyStats(), total: 85, annulees: 15 };
    // 15 / (85 + 15) = 15%
    expect(calculateCancellationRate(stats)).toBe(15);
  });

  it("arrondit le résultat", () => {
    // total = 5 (hors annulées), annulees = 2 → total réel = 7
    const stats = { ...getEmptyStats(), total: 5, annulees: 2 };
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
  it("retourne 0 si aucune formation", () => {
    const stats = getEmptyStats();
    expect(calculateAvgDaysPerFormation(stats)).toBe(0);
  });

  it("calcule correctement la moyenne de jours (total = hors annulées)", () => {
    // total = 8 (hors annulées), totalJours = 24
    const stats = {
      ...getEmptyStats(),
      total: 8,
      annulees: 2,
      totalJours: 24
    };
    // 24 jours / 8 formations = 3 jours
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
