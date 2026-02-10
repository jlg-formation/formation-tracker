/**
 * Tests unitaires pour geocacheStore
 */

import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";

import { resetDatabase, db } from "./db";
import { addFormation, getFormation } from "./formationsStore";
import {
  getAllGeocacheEntries,
  reapplyGeocacheToAllFormations,
  updateGeocacheEntryGps
} from "./geocacheStore";
import {
  StatutFormation,
  TypeSession,
  NiveauPersonnalisation,
  type Formation
} from "../types";
import { normalizeAddress } from "../services/geocoding";

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

describe("geocacheStore", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("getAllGeocacheEntries retourne les entrées", async () => {
    await db.geocache.put({
      adresse: "paris",
      gps: { lat: 48.8566, lng: 2.3522 },
      provider: "nominatim",
      cachedAt: new Date().toISOString()
    });

    const entries = await getAllGeocacheEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].adresse).toBe("paris");
  });

  it("updateGeocacheEntryGps met à jour le GPS d'une entrée", async () => {
    await db.geocache.put({
      adresse: "adresse-test",
      gps: null,
      provider: "nominatim",
      cachedAt: "2024-01-01T00:00:00.000Z"
    });

    await updateGeocacheEntryGps("adresse-test", { lat: 1.23, lng: 4.56 });

    const updated = await db.geocache.get("adresse-test");
    expect(updated?.gps).toEqual({ lat: 1.23, lng: 4.56 });
    expect(updated?.cachedAt).not.toBe("2024-01-01T00:00:00.000Z");
  });

  it("reapplyGeocacheToAllFormations applique le cache aux formations", async () => {
    const formation = await addFormation(
      createTestFormation({
        lieu: {
          nom: "ORSYS Paris",
          adresse: "1 rue Test, 75001 Paris",
          gps: { lat: 0, lng: 0 }
        }
      })
    );

    const cancelled = await addFormation(
      createTestFormation({
        codeEtendu: "ANNULEE01",
        statut: StatutFormation.ANNULEE,
        lieu: {
          nom: "ORSYS Paris",
          adresse: "1 rue Test, 75001 Paris",
          gps: { lat: 0, lng: 0 }
        }
      })
    );

    const key = normalizeAddress("1 rue Test, 75001 Paris");

    await db.geocache.put({
      adresse: key,
      gps: { lat: 48.9, lng: 2.2 },
      provider: "nominatim",
      cachedAt: new Date().toISOString()
    });

    const updatedCount = await reapplyGeocacheToAllFormations();
    expect(updatedCount).toBe(1);

    const updated = await getFormation(formation.id);
    expect(updated?.lieu.gps).toEqual({ lat: 48.9, lng: 2.2 });

    const updatedCancelled = await getFormation(cancelled.id);
    expect(updatedCancelled?.lieu.gps).toEqual({ lat: 0, lng: 0 });
  });
});
