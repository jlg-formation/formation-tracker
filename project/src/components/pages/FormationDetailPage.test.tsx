import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "fake-indexeddb/auto";

import { db, resetDatabase } from "../../stores/db";
import type { Formation, EmailRaw } from "../../types";
import {
  NiveauPersonnalisation,
  StatutFormation,
  TypeSession
} from "../../types";
import { FormationDetailPage } from "./FormationDetailPage";

describe("FormationDetailPage", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("affiche les détails de la formation et les emails bruts rattachés", async () => {
    const formation: Formation = {
      id: "f-1",
      titre: "Formation TypeScript avancé",
      codeFormation: "TS",
      codeEtendu: "TSADV1",
      statut: StatutFormation.CONFIRMEE,
      dateDebut: "2026-01-10",
      dateFin: "2026-01-12",
      dates: ["2026-01-10", "2026-01-11", "2026-01-12"],
      nombreJours: 3,
      lieu: {
        nom: "ORSYS Paris",
        adresse: "1 rue de Test, 75000 Paris",
        gps: null
      },
      typeSession: TypeSession.INTER,
      niveauPersonnalisation: NiveauPersonnalisation.STANDARD,
      nombreParticipants: 0,
      participants: [],
      emailIds: ["e-1"],
      updatedAt: "2026-02-01T10:00:00.000Z",
      createdAt: "2026-02-01T10:00:00.000Z"
    };

    const email: EmailRaw = {
      id: "e-1",
      threadId: "t-1",
      from: "formation@orsys.fr",
      subject: "Convocation - TypeScript avancé",
      date: "2026-02-01T09:00:00.000Z",
      body: "Bonjour, voici votre convocation...",
      processed: true,
      formationId: formation.id
    };

    await db.formations.add(formation);
    await db.emails.add(email);

    render(
      <MemoryRouter initialEntries={[`/formations/${formation.id}`]}>
        <Routes>
          <Route
            path="/formations/:formationId"
            element={<FormationDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: formation.titre })
      ).toBeInTheDocument();
    });

    expect(screen.getByText(formation.codeEtendu)).toBeInTheDocument();
    expect(screen.getByText(/Emails bruts \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(email.subject)).toBeInTheDocument();
  });

  it("affiche un message si la formation est introuvable", async () => {
    render(
      <MemoryRouter initialEntries={["/formations/unknown"]}>
        <Routes>
          <Route
            path="/formations/:formationId"
            element={<FormationDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText("Impossible d'afficher la formation")
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/Formation introuvable/)).toBeInTheDocument();
  });
});
