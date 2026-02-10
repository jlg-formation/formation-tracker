import { describe, expect, it } from "vitest";
import {
  getFormationTemporalStatus,
  filterFormationsByPeriode
} from "./temporal";
import type { Formation } from "../types";

function makeFormation(partial: Partial<Formation>): Formation {
  const nowIso = new Date().toISOString();
  return {
    id: "f1",
    createdAt: nowIso,
    updatedAt: nowIso,
    titre: "Formation",
    codeEtendu: "CODE",
    statut: "confirmee" as Formation["statut"],
    typeSession: "inter" as Formation["typeSession"],
    niveauPersonnalisation: "standard" as Formation["niveauPersonnalisation"],
    dateDebut: "2024-01-01",
    dateFin: "2024-01-01",
    dates: ["2024-01-01"],
    nombreJours: 1,
    lieu: { nom: "Paris", adresse: "", gps: null },
    nombreParticipants: 0,
    participants: [],
    emailIds: [],
    ...partial
  };
}

describe("temporal", () => {
  it("classifie une formation passée", () => {
    const formation = makeFormation({
      dateDebut: "2024-01-01",
      dateFin: "2024-01-02"
    });
    const now = new Date("2024-01-03T12:00:00");
    expect(getFormationTemporalStatus(formation, now)).toBe("passee");
  });

  it("classifie une formation future", () => {
    const formation = makeFormation({
      dateDebut: "2024-01-10",
      dateFin: "2024-01-11"
    });
    const now = new Date("2024-01-03T12:00:00");
    expect(getFormationTemporalStatus(formation, now)).toBe("future");
  });

  it("classifie une formation en cours", () => {
    const formation = makeFormation({
      dateDebut: "2024-01-02",
      dateFin: "2024-01-05"
    });
    const now = new Date("2024-01-03T12:00:00");
    expect(getFormationTemporalStatus(formation, now)).toBe("en-cours");
  });

  it("filtre par période (passées/futures/les deux)", () => {
    const now = new Date("2024-01-03T12:00:00");
    const past = makeFormation({
      id: "p",
      dateDebut: "2024-01-01",
      dateFin: "2024-01-02"
    });
    const future = makeFormation({
      id: "f",
      dateDebut: "2024-01-10",
      dateFin: "2024-01-11"
    });
    const current = makeFormation({
      id: "c",
      dateDebut: "2024-01-03",
      dateFin: "2024-01-03"
    });

    expect(
      filterFormationsByPeriode([past, future, current], "passees", now).map(
        (x) => x.id
      )
    ).toEqual(["p"]);
    expect(
      filterFormationsByPeriode([past, future, current], "futures", now).map(
        (x) => x.id
      )
    ).toEqual(["f"]);
    expect(
      filterFormationsByPeriode([past, future, current], "les-deux", now).map(
        (x) => x.id
      )
    ).toEqual(["p", "f", "c"]);
  });
});
