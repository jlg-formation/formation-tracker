/**
 * Tests pour la logique de fusion des formations
 */

import { describe, it, expect } from "vitest";
import {
  fusionnerEmails,
  trouverFormationParCle,
  estMemeFormation,
  grouperParFormation,
  type FusionInput
} from "./fusion";
import type { Formation, EmailRaw, ExtractionResult } from "../types";
import {
  StatutFormation,
  TypeSession,
  TypeEmail,
  NiveauPersonnalisation
} from "../types";
import { VIRTUAL_FORMATION_ADDRESS } from "./virtualFormations";

// =============================================================================
// HELPERS POUR CRÉER DES DONNÉES DE TEST
// =============================================================================

function createEmailRaw(overrides: Partial<EmailRaw> = {}): EmailRaw {
  return {
    id: `email-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    threadId: "thread-1",
    from: "formations@orsys.fr",
    subject: "Convocation formation",
    date: new Date().toISOString(),
    body: "Corps de l'email",
    processed: false,
    ...overrides
  };
}

function createExtractionResult(
  formation: Partial<Formation>,
  overrides: Partial<ExtractionResult> = {}
): ExtractionResult {
  return {
    formation,
    fieldsExtracted: Object.keys(formation),
    fieldsMissing: [],
    warnings: [],
    ...overrides
  };
}

function createFusionInput(
  partial: Partial<Formation>,
  type: (typeof TypeEmail)[keyof typeof TypeEmail] = TypeEmail.CONVOCATION_INTER,
  emailOverrides: Partial<EmailRaw> = {}
): FusionInput {
  return {
    email: createEmailRaw(emailOverrides),
    extraction: createExtractionResult(partial),
    classification: {
      type,
      confidence: 0.95
    }
  };
}

function createFullFormation(overrides: Partial<Formation> = {}): Formation {
  const now = new Date().toISOString();
  return {
    id: "GIAPA1-2024-03-18",
    titre: "Python - Les bases",
    codeEtendu: "GIAPA1",
    codeFormation: "PYT",
    statut: StatutFormation.CONFIRMEE,
    dateDebut: "2024-03-18",
    dateFin: "2024-03-22",
    dates: [
      "2024-03-18",
      "2024-03-19",
      "2024-03-20",
      "2024-03-21",
      "2024-03-22"
    ],
    nombreJours: 5,
    lieu: {
      nom: "ORSYS Paris La Défense",
      adresse: "1 Parvis de la Défense, 92044 Paris La Défense",
      gps: { lat: 48.8924, lng: 2.236 }
    },
    typeSession: TypeSession.INTER,
    niveauPersonnalisation: NiveauPersonnalisation.STANDARD,
    nombreParticipants: 1,
    participants: [{ nom: "Jean Dupont", email: "jean.dupont@example.com" }],
    emailIds: ["email-1"],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

// =============================================================================
// TESTS DE FUSION DE BASE
// =============================================================================

describe("fusionnerEmails", () => {
  describe("Création de nouvelles formations", () => {
    it("devrait créer une formation à partir d'un seul email", () => {
      const input = createFusionInput({
        titre: "Python - Les bases",
        codeEtendu: "GIAPA1",
        dateDebut: "2024-03-18",
        dateFin: "2024-03-22",
        nombreJours: 5,
        typeSession: TypeSession.INTER,
        lieu: {
          nom: "ORSYS Paris",
          adresse: "1 Parvis de la Défense",
          gps: null
        },
        participants: [{ nom: "Jean Dupont", email: "jean@example.com" }]
      });

      const result = fusionnerEmails([input]);

      expect(result.created).toHaveLength(1);
      expect(result.updated).toHaveLength(0);
      expect(result.stats.formationsCreees).toBe(1);

      const formation = result.created[0];
      expect(formation.titre).toBe("Python - Les bases");
      expect(formation.codeEtendu).toBe("GIAPA1");
      expect(formation.dateDebut).toBe("2024-03-18");
      expect(formation.statut).toBe(StatutFormation.CONFIRMEE);
      expect(formation.id).toBe("GIAPA1-2024-03-18");
    });

    it("devrait fusionner 2 emails pour la même formation", () => {
      const input1 = createFusionInput(
        {
          codeEtendu: "GIAPA1",
          dateDebut: "2024-03-18",
          titre: "Python - Les bases",
          nombreJours: 5
        },
        TypeEmail.CONVOCATION_INTER,
        { id: "email-1", date: "2024-03-01T10:00:00.000Z" }
      );

      const input2 = createFusionInput(
        {
          codeEtendu: "GIAPA1",
          dateDebut: "2024-03-18",
          lieu: {
            nom: "ORSYS Lyon",
            adresse: "Place Bellecour, Lyon",
            gps: { lat: 45.7578, lng: 4.832 }
          },
          motDePasseDocadmin: "abc123"
        },
        TypeEmail.CONVOCATION_INTER,
        { id: "email-2", date: "2024-03-02T10:00:00.000Z" }
      );

      const result = fusionnerEmails([input1, input2]);

      expect(result.created).toHaveLength(1);
      expect(result.stats.emailsFusionnes).toBe(1);

      const formation = result.created[0];
      expect(formation.codeEtendu).toBe("GIAPA1");
      expect(formation.titre).toBe("Python - Les bases");
      expect(formation.lieu.nom).toBe("ORSYS Lyon");
      expect(formation.motDePasseDocadmin).toBe("abc123");
      expect(formation.emailIds).toContain("email-1");
      expect(formation.emailIds).toContain("email-2");
    });

    it("devrait créer des formations distinctes pour des clés différentes", () => {
      const input1 = createFusionInput({
        codeEtendu: "GIAPA1",
        dateDebut: "2024-03-18",
        titre: "Python"
      });

      const input2 = createFusionInput({
        codeEtendu: "GIAPA1",
        dateDebut: "2024-04-15",
        titre: "Python (autre date)"
      });

      const input3 = createFusionInput({
        codeEtendu: "GIAJAV",
        dateDebut: "2024-03-18",
        titre: "Java"
      });

      const result = fusionnerEmails([input1, input2, input3]);

      expect(result.created).toHaveLength(3);
      expect(result.stats.formationsCreees).toBe(3);
    });

    it("devrait forcer l'adresse d'une formation virtuelle (CV) lors de la création", () => {
      const input = createFusionInput({
        titre: "Formation virtuelle",
        codeEtendu: "GIAPA1CV1",
        dateDebut: "2024-03-18",
        dateFin: "2024-03-19",
        nombreJours: 2,
        typeSession: TypeSession.INTER,
        lieu: {
          nom: "En ligne",
          adresse: "Adresse incorrecte",
          gps: { lat: 48.9, lng: 2.2 }
        }
      });

      const result = fusionnerEmails([input]);
      expect(result.created).toHaveLength(1);

      const formation = result.created[0];
      expect(formation.lieu.adresse).toBe(VIRTUAL_FORMATION_ADDRESS);
      expect(formation.lieu.gps).toBeNull();
    });
  });

  describe("Mise à jour de formations existantes", () => {
    it("devrait mettre à jour une formation existante avec de nouvelles infos", () => {
      const existingFormation = createFullFormation({
        codeEtendu: "GIAPA1",
        dateDebut: "2024-03-18",
        motDePasseDocadmin: undefined
      });

      const input = createFusionInput(
        {
          codeEtendu: "GIAPA1",
          dateDebut: "2024-03-18",
          motDePasseDocadmin: "newpassword",
          nombreParticipants: 5
        },
        TypeEmail.INFO_FACTURATION
      );

      const result = fusionnerEmails([input], [existingFormation]);

      expect(result.created).toHaveLength(0);
      expect(result.updated).toHaveLength(1);
      expect(result.stats.formationsMisesAJour).toBe(1);

      const updated = result.updated[0];
      expect(updated.motDePasseDocadmin).toBe("newpassword");
      expect(updated.nombreParticipants).toBe(5);
      // Les champs existants sont conservés
      expect(updated.titre).toBe("Python - Les bases");
      expect(updated.lieu.nom).toBe("ORSYS Paris La Défense");
    });

    it("devrait fusionner les participants sans doublons", () => {
      const existingFormation = createFullFormation({
        participants: [{ nom: "Jean Dupont", email: "jean@example.com" }],
        nombreParticipants: 1
      });

      const input = createFusionInput({
        codeEtendu: existingFormation.codeEtendu,
        dateDebut: existingFormation.dateDebut,
        participants: [
          { nom: "Jean Dupont", email: "jean@example.com" }, // doublon
          { nom: "Marie Martin", email: "marie@example.com" } // nouveau
        ]
      });

      const result = fusionnerEmails([input], [existingFormation]);

      expect(result.updated).toHaveLength(1);
      const updated = result.updated[0];
      expect(updated.participants).toHaveLength(2);
      expect(updated.participants.map((p) => p.email)).toContain(
        "jean@example.com"
      );
      expect(updated.participants.map((p) => p.email)).toContain(
        "marie@example.com"
      );
    });

    it("devrait fusionner les dates sans doublons", () => {
      const existingFormation = createFullFormation({
        dates: ["2024-03-18", "2024-03-19"]
      });

      const input = createFusionInput({
        codeEtendu: existingFormation.codeEtendu,
        dateDebut: existingFormation.dateDebut,
        dates: ["2024-03-19", "2024-03-20", "2024-03-21"]
      });

      const result = fusionnerEmails([input], [existingFormation]);

      const updated = result.updated[0];
      expect(updated.dates).toHaveLength(4);
      expect(updated.dates).toEqual([
        "2024-03-18",
        "2024-03-19",
        "2024-03-20",
        "2024-03-21"
      ]);
    });
  });

  describe("Gestion des annulations", () => {
    it("devrait créer une formation annulée à partir d'un email d'annulation", () => {
      const input = createFusionInput(
        {
          codeEtendu: "GIAPA1",
          dateDebut: "2024-03-18",
          titre: "Python - Les bases"
        },
        TypeEmail.ANNULATION
      );

      const result = fusionnerEmails([input]);

      expect(result.created).toHaveLength(1);
      expect(result.created[0].statut).toBe(StatutFormation.ANNULEE);
      expect(result.stats.annulationsTraitees).toBe(1);
    });

    it("devrait annuler une formation existante confirmée", () => {
      const existingFormation = createFullFormation({
        statut: StatutFormation.CONFIRMEE
      });

      const input = createFusionInput(
        {
          codeEtendu: existingFormation.codeEtendu,
          dateDebut: existingFormation.dateDebut
        },
        TypeEmail.ANNULATION
      );

      const result = fusionnerEmails([input], [existingFormation]);

      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].statut).toBe(StatutFormation.ANNULEE);
      expect(result.stats.annulationsTraitees).toBe(1);
    });

    it("devrait gérer confirmation puis annulation dans l'ordre", () => {
      const confirmation = createFusionInput(
        {
          codeEtendu: "GIAPA1",
          dateDebut: "2024-03-18",
          titre: "Python"
        },
        TypeEmail.CONVOCATION_INTER,
        { id: "email-1", date: "2024-03-01T10:00:00.000Z" }
      );

      const annulation = createFusionInput(
        {
          codeEtendu: "GIAPA1",
          dateDebut: "2024-03-18"
        },
        TypeEmail.ANNULATION,
        { id: "email-2", date: "2024-03-05T10:00:00.000Z" }
      );

      const result = fusionnerEmails([confirmation, annulation]);

      expect(result.created).toHaveLength(1);
      expect(result.created[0].statut).toBe(StatutFormation.ANNULEE);
      expect(result.created[0].titre).toBe("Python");
    });
  });

  describe("Emails ignorés", () => {
    it("devrait ignorer les emails de type RAPPEL", () => {
      const input = createFusionInput(
        {
          codeEtendu: "GIAPA1",
          dateDebut: "2024-03-18"
        },
        TypeEmail.RAPPEL
      );

      const result = fusionnerEmails([input]);

      expect(result.created).toHaveLength(0);
      expect(result.ignored).toHaveLength(1);
      expect(result.stats.emailsIgnores).toBe(1);
    });

    it("devrait ignorer les emails de type AUTRE", () => {
      const input = createFusionInput(
        {
          codeEtendu: "GIAPA1",
          dateDebut: "2024-03-18"
        },
        TypeEmail.AUTRE
      );

      const result = fusionnerEmails([input]);

      expect(result.created).toHaveLength(0);
      expect(result.ignored).toHaveLength(1);
    });

    it("devrait ignorer les emails sans codeEtendu", () => {
      const input = createFusionInput(
        {
          dateDebut: "2024-03-18",
          titre: "Formation sans code"
        },
        TypeEmail.CONVOCATION_INTER
      );

      const result = fusionnerEmails([input]);

      expect(result.created).toHaveLength(0);
      expect(result.ignored).toHaveLength(1);
    });

    it("devrait ignorer les emails sans dateDebut", () => {
      const input = createFusionInput(
        {
          codeEtendu: "GIAPA1",
          titre: "Formation sans date"
        },
        TypeEmail.CONVOCATION_INTER
      );

      const result = fusionnerEmails([input]);

      expect(result.created).toHaveLength(0);
      expect(result.ignored).toHaveLength(1);
    });
  });

  describe("Statistiques", () => {
    it("devrait calculer correctement les statistiques de fusion", () => {
      const inputs = [
        // Formation 1 : 2 emails
        createFusionInput(
          { codeEtendu: "GIAPA1", dateDebut: "2024-03-18", titre: "Python" },
          TypeEmail.CONVOCATION_INTER
        ),
        createFusionInput(
          { codeEtendu: "GIAPA1", dateDebut: "2024-03-18", nombreJours: 5 },
          TypeEmail.INFO_FACTURATION
        ),
        // Formation 2 : 1 email
        createFusionInput(
          { codeEtendu: "GIAJAV", dateDebut: "2024-03-18", titre: "Java" },
          TypeEmail.CONVOCATION_INTER
        ),
        // Email ignoré
        createFusionInput(
          { codeEtendu: "TEST", dateDebut: "2024-03-18" },
          TypeEmail.RAPPEL
        )
      ];

      const result = fusionnerEmails(inputs);

      expect(result.stats.totalEmails).toBe(4);
      expect(result.stats.formationsCreees).toBe(2);
      expect(result.stats.emailsFusionnes).toBe(1);
      expect(result.stats.emailsIgnores).toBe(1);
    });

    it("devrait forcer l'adresse d'une formation virtuelle (CV) lors d'une mise à jour", () => {
      const existingFormation = createFullFormation({
        codeEtendu: "GIAPA1CV2",
        lieu: {
          nom: "En ligne",
          adresse: "Adresse incorrecte",
          gps: { lat: 48.9, lng: 2.2 }
        }
      });

      const input = createFusionInput({
        codeEtendu: "GIAPA1CV2",
        dateDebut: existingFormation.dateDebut
      });

      const result = fusionnerEmails([input], [existingFormation]);
      expect(result.updated).toHaveLength(1);

      const updated = result.updated[0];
      expect(updated.lieu.adresse).toBe(VIRTUAL_FORMATION_ADDRESS);
      expect(updated.lieu.gps).toBeNull();
    });
  });
});

// =============================================================================
// TESTS DES FONCTIONS UTILITAIRES
// =============================================================================

describe("trouverFormationParCle", () => {
  it("devrait trouver une formation existante par clé", () => {
    const formations = [
      createFullFormation({ codeEtendu: "GIAPA1", dateDebut: "2024-03-18" }),
      createFullFormation({ codeEtendu: "GIAJAV", dateDebut: "2024-04-15" })
    ];

    const found = trouverFormationParCle(formations, "GIAPA1", "2024-03-18");

    expect(found).toBeDefined();
    expect(found?.codeEtendu).toBe("GIAPA1");
  });

  it("devrait retourner undefined si la formation n'existe pas", () => {
    const formations = [
      createFullFormation({ codeEtendu: "GIAPA1", dateDebut: "2024-03-18" })
    ];

    const found = trouverFormationParCle(formations, "GIAPA1", "2024-04-01");

    expect(found).toBeUndefined();
  });
});

describe("estMemeFormation", () => {
  it("devrait retourner true pour des formations identiques", () => {
    const f1 = { codeEtendu: "GIAPA1", dateDebut: "2024-03-18" };
    const f2 = { codeEtendu: "GIAPA1", dateDebut: "2024-03-18" };

    expect(estMemeFormation(f1, f2)).toBe(true);
  });

  it("devrait retourner false pour des dates différentes", () => {
    const f1 = { codeEtendu: "GIAPA1", dateDebut: "2024-03-18" };
    const f2 = { codeEtendu: "GIAPA1", dateDebut: "2024-04-15" };

    expect(estMemeFormation(f1, f2)).toBe(false);
  });

  it("devrait retourner false pour des codes différents", () => {
    const f1 = { codeEtendu: "GIAPA1", dateDebut: "2024-03-18" };
    const f2 = { codeEtendu: "GIAJAV", dateDebut: "2024-03-18" };

    expect(estMemeFormation(f1, f2)).toBe(false);
  });
});

describe("grouperParFormation", () => {
  it("devrait grouper les inputs par clé de formation", () => {
    const inputs = [
      createFusionInput({ codeEtendu: "GIAPA1", dateDebut: "2024-03-18" }),
      createFusionInput({ codeEtendu: "GIAPA1", dateDebut: "2024-03-18" }),
      createFusionInput({ codeEtendu: "GIAJAV", dateDebut: "2024-03-18" })
    ];

    const groups = grouperParFormation(inputs);

    expect(groups.size).toBe(2);
    expect(groups.get("GIAPA1-2024-03-18")).toHaveLength(2);
    expect(groups.get("GIAJAV-2024-03-18")).toHaveLength(1);
  });

  it("devrait ignorer les inputs sans clé valide", () => {
    const inputs = [
      createFusionInput({ codeEtendu: "GIAPA1", dateDebut: "2024-03-18" }),
      createFusionInput({ dateDebut: "2024-03-18" }), // Pas de code
      createFusionInput({ codeEtendu: "GIAPA1" }) // Pas de date
    ];

    const groups = grouperParFormation(inputs);

    expect(groups.size).toBe(1);
    expect(groups.get("GIAPA1-2024-03-18")).toHaveLength(1);
  });
});

// =============================================================================
// TESTS DE CAS LIMITES
// =============================================================================

describe("Cas limites", () => {
  it("devrait gérer une liste vide d'inputs", () => {
    const result = fusionnerEmails([]);

    expect(result.created).toHaveLength(0);
    expect(result.updated).toHaveLength(0);
    expect(result.stats.totalEmails).toBe(0);
  });

  it("devrait gérer le cas où tous les emails sont ignorés", () => {
    const inputs = [
      createFusionInput({}, TypeEmail.RAPPEL),
      createFusionInput({}, TypeEmail.AUTRE)
    ];

    const result = fusionnerEmails(inputs);

    expect(result.created).toHaveLength(0);
    expect(result.ignored).toHaveLength(2);
    expect(result.stats.emailsIgnores).toBe(2);
  });

  it("devrait préserver les emailIds uniques", () => {
    const input1 = createFusionInput(
      { codeEtendu: "GIAPA1", dateDebut: "2024-03-18" },
      TypeEmail.CONVOCATION_INTER,
      { id: "same-email-id" }
    );

    const input2 = createFusionInput(
      { codeEtendu: "GIAPA1", dateDebut: "2024-03-18" },
      TypeEmail.INFO_FACTURATION,
      { id: "same-email-id" } // Même ID
    );

    const result = fusionnerEmails([input1, input2]);

    expect(result.created[0].emailIds).toHaveLength(1);
    expect(result.created[0].emailIds[0]).toBe("same-email-id");
  });

  it("devrait gérer les formations intra avec client", () => {
    const input = createFusionInput(
      {
        codeEtendu: "GIAPA1",
        dateDebut: "2024-03-18",
        typeSession: TypeSession.INTRA,
        client: "Société XYZ",
        niveauPersonnalisation: NiveauPersonnalisation.SPECIFIQUE
      },
      TypeEmail.CONVOCATION_INTRA
    );

    const result = fusionnerEmails([input]);

    expect(result.created[0].typeSession).toBe(TypeSession.INTRA);
    expect(result.created[0].client).toBe("Société XYZ");
    expect(result.created[0].niveauPersonnalisation).toBe(
      NiveauPersonnalisation.SPECIFIQUE
    );
  });

  it("devrait enrichir les données de facturation", () => {
    const existing = createFullFormation({
      facturation: {
        entite: "ORSYS",
        referenceIntra: "12345"
      }
    });

    const input = createFusionInput(
      {
        codeEtendu: existing.codeEtendu,
        dateDebut: existing.dateDebut,
        facturation: {
          entite: "ORSYS",
          referenceCommande: "CMD-2024-001",
          tarifAnimation: 2500
        }
      },
      TypeEmail.INFO_FACTURATION
    );

    const result = fusionnerEmails([input], [existing]);

    const updated = result.updated[0];
    expect(updated.facturation?.referenceIntra).toBe("12345");
    expect(updated.facturation?.referenceCommande).toBe("CMD-2024-001");
    expect(updated.facturation?.tarifAnimation).toBe(2500);
  });
});
