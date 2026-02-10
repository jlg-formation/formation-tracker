/**
 * Tests pour le service LLM - Classification et Extraction
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";

import {
  classifyEmail,
  classifyEmailBatch,
  classifyEmailWithCache,
  isLLMError,
  extractFormation,
  extractFormationBatch,
  buildExtractionPromptInter,
  buildExtractionPromptIntra,
  buildExtractionPromptAnnulation,
  buildExtractionPromptBonCommande,
  buildExtractionPromptFacturation,
  EXTRACTION_SYSTEM_PROMPT
} from "./index";
import { isValidEmailType, buildClassificationUserPrompt } from "./prompts";
import {
  TypeEmail,
  TypeSession,
  StatutFormation,
  NiveauPersonnalisation
} from "../../types";
import type { EmailInput } from "./types";
import { CURRENT_MODEL_VERSION } from "../../stores/llmCacheStore";
import * as llmCacheStore from "../../stores/llmCacheStore";
import { getSettings } from "../../stores/settingsStore";

// Mock du settingsStore pour fournir une clé API
vi.mock("../../stores/settingsStore", () => ({
  getSettings: vi.fn().mockResolvedValue({
    openaiApiKey: "test-api-key",
    geocodingProvider: "nominatim"
  })
}));

// Exemples d'emails pour les tests (basés sur input/emails-samples/)
const SAMPLE_EMAILS: Record<string, EmailInput> = {
  inter: {
    id: "email-1",
    subject: "Confirmation animation inter",
    body: `Bonjour

Veuillez trouver ci-dessous les informations relatives à votre prochaine animation inter.

Nom du formateur	Jean-Louis GUENEGO
Titre	L'intelligence artificielle au service des développeurs - réf : GIAPA1
Date	du 04/02/2026 au 06/02/2026
Durée	3.0 j
Lieu	Centre de formation ORSYS - Paroi Nord Grande Arche - 16ème étage - 1 parvis de la Défense - 92044 - PARIS LA DEFENSE.
Nombre de participants	5 (à ce jour)

Votre accès : https://docadmin.orsys.fr/formateur
Votre mot de passe de connexion pour cette session : 6d3nSFCYT`
  },
  intra: {
    id: "email-2",
    subject: "Confirmation formation intra N° 79757",
    body: `Cybersécurité et intelligence artificielle : un enjeu clé pour la DSI du conseil régional des Hauts-de-France – N° 79757 / Option 1 - XXXZZ3) (Français)

Date Formation	
1ère partie :Du mercredi 21 au jeudi 22 janvier 2026
2ème partie : Le jeudi 29 janvier 2026

Lieu de formation	
REGION HAUTS DE FRANCE 15 Mail Albert 1er
Salle 101 Germain Bleuet (1er étage) 80 - Amiens France

Nombre de participant(s)	9`
  },
  annulation: {
    id: "email-3",
    subject: "SESSION ANNULEE",
    body: `SESSION ANNULEE

Bonjour,

Nous vous informons que nous avons dû annuler, faute de participants en nombre suffisant, la session :

IHMPA1 : UX design et ergonomie des sites Web à PARIS LA DEFENSE
du 25/02/2026 au 27/02/2026

Nous espérons pouvoir vous proposer très prochainement une nouvelle session.`
  },
  bonCommande: {
    id: "email-4",
    subject: "CONFIRMATION DE SESSION - Référence Intra 81982/1",
    body: `CONFIRMATION DE SESSION - Référence Intra 81982/1
Référence de commande : GIAZZ1-2026-05-04

Bonjour,

Nous avons le plaisir de confirmer votre intervention concernant l'intra avec Monsieur GUENEGO Jean-Louis :

Sur un cours STANDARD : GIAZZ1 : L'intelligence artificielle au service des développeurs
Dates : du 04/05/2026 au 06/05/2026
Pour la société : CONDUENT BUSINESS SOLUTIONS FRANCE SAS
Durée : 3.0 jours, soit 21.0 heures de formation

L'entité du Groupe ORSYS à facturer pour cette session sera ORSYS.`
  }
};

describe("LLM Prompts", () => {
  describe("isValidEmailType", () => {
    it("accepte les types valides", () => {
      expect(isValidEmailType("convocation-inter")).toBe(true);
      expect(isValidEmailType("convocation-intra")).toBe(true);
      expect(isValidEmailType("annulation")).toBe(true);
      expect(isValidEmailType("bon-commande")).toBe(true);
      expect(isValidEmailType("info-facturation")).toBe(true);
      expect(isValidEmailType("rappel")).toBe(true);
      expect(isValidEmailType("autre")).toBe(true);
    });

    it("rejette les types invalides", () => {
      expect(isValidEmailType("invalid")).toBe(false);
      expect(isValidEmailType("")).toBe(false);
      expect(isValidEmailType("CONVOCATION-INTER")).toBe(false);
    });
  });

  describe("buildClassificationUserPrompt", () => {
    it("génère un prompt avec sujet et corps", () => {
      const prompt = buildClassificationUserPrompt("Test Subject", "Test Body");
      expect(prompt).toContain("Sujet : Test Subject");
      expect(prompt).toContain("Test Body");
      expect(prompt).toContain("JSON");
    });
  });
});

describe("LLM Parser", () => {
  // Mock globalThis fetch
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /**
   * Helper pour créer une réponse OpenAI mockée
   */
  function mockOpenAIResponse(
    type: string,
    confidence: number,
    reason: string
  ) {
    return {
      ok: true,
      json: () =>
        Promise.resolve({
          id: "chatcmpl-test",
          object: "chat.completion",
          created: Date.now(),
          model: "gpt-5-nano",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify({ type, confidence, reason })
              },
              finish_reason: "stop"
            }
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150
          }
        })
    };
  }

  describe("classifyEmail", () => {
    it("classifie correctement un email inter", async () => {
      mockFetch.mockResolvedValueOnce(
        mockOpenAIResponse(
          "convocation-inter",
          0.95,
          "Contient 'animation inter' et lieu ORSYS"
        )
      );

      const result = await classifyEmail(SAMPLE_EMAILS.inter, "test-key");

      expect(result.type).toBe(TypeEmail.CONVOCATION_INTER);
      expect(result.confidence).toBe(0.95);
      expect(result.reason).toContain("animation inter");
    });

    it("classifie correctement un email intra", async () => {
      mockFetch.mockResolvedValueOnce(
        mockOpenAIResponse(
          "convocation-intra",
          0.92,
          "Formation chez le client, référence N°"
        )
      );

      const result = await classifyEmail(SAMPLE_EMAILS.intra, "test-key");

      expect(result.type).toBe(TypeEmail.CONVOCATION_INTRA);
      expect(result.confidence).toBe(0.92);
    });

    it("classifie correctement une annulation", async () => {
      mockFetch.mockResolvedValueOnce(
        mockOpenAIResponse("annulation", 0.98, "Contient 'SESSION ANNULEE'")
      );

      const result = await classifyEmail(SAMPLE_EMAILS.annulation, "test-key");

      expect(result.type).toBe(TypeEmail.ANNULATION);
      expect(result.confidence).toBe(0.98);
    });

    it("classifie correctement un bon de commande", async () => {
      mockFetch.mockResolvedValueOnce(
        mockOpenAIResponse(
          "bon-commande",
          0.9,
          "Confirmation de session avec référence commande"
        )
      );

      const result = await classifyEmail(SAMPLE_EMAILS.bonCommande, "test-key");

      expect(result.type).toBe(TypeEmail.BON_COMMANDE);
      expect(result.confidence).toBe(0.9);
    });

    it("reclasse en 'autre' si confiance < 0.7", async () => {
      mockFetch.mockResolvedValueOnce(
        mockOpenAIResponse("convocation-inter", 0.5, "Incertain")
      );

      const result = await classifyEmail(SAMPLE_EMAILS.inter, "test-key");

      expect(result.type).toBe(TypeEmail.AUTRE);
      expect(result.confidence).toBe(0.5);
      expect(result.reason).toContain("Confiance insuffisante");
    });

    it("lance une erreur si pas de clé API", async () => {
      // Override le mock pour retourner pas de clé
      (
        getSettings as unknown as {
          mockResolvedValueOnce: (v: unknown) => void;
        }
      ).mockResolvedValueOnce({
        openaiApiKey: undefined,
        geocodingProvider: "nominatim"
      });

      let caught: unknown;
      try {
        await classifyEmail(SAMPLE_EMAILS.inter);
      } catch (e) {
        caught = e;
      }
      expect(isLLMError(caught)).toBe(true);
    });

    it("lance une erreur API si la requête échoue", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized")
      });

      let caught: unknown;
      try {
        await classifyEmail(SAMPLE_EMAILS.inter, "invalid-key");
      } catch (e) {
        caught = e;
      }
      expect(isLLMError(caught)).toBe(true);
    });

    it("lance une erreur de parsing si JSON invalide", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: "Not valid JSON"
                }
              }
            ]
          })
      });

      let caught: unknown;
      try {
        await classifyEmail(SAMPLE_EMAILS.inter, "test-key");
      } catch (e) {
        caught = e;
      }
      expect(isLLMError(caught)).toBe(true);
    });

    it("lance une erreur si type invalide dans la réponse", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    type: "invalid-type",
                    confidence: 0.9,
                    reason: "test"
                  })
                }
              }
            ]
          })
      });

      let caught: unknown;
      try {
        await classifyEmail(SAMPLE_EMAILS.inter, "test-key");
      } catch (e) {
        caught = e;
      }
      expect(isLLMError(caught)).toBe(true);
    });
  });

  describe("classifyEmailBatch", () => {
    it("classifie plusieurs emails", async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockOpenAIResponse("convocation-inter", 0.95, "Inter")
        )
        .mockResolvedValueOnce(
          mockOpenAIResponse("annulation", 0.98, "Annulation")
        );

      const emails = [SAMPLE_EMAILS.inter, SAMPLE_EMAILS.annulation];
      const results = await classifyEmailBatch(emails, "test-key");

      expect(results.size).toBe(2);
      expect(results.get("email-1")?.type).toBe(TypeEmail.CONVOCATION_INTER);
      expect(results.get("email-3")?.type).toBe(TypeEmail.ANNULATION);
    });

    it("appelle le callback de progression", async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockOpenAIResponse("convocation-inter", 0.95, "Inter")
        )
        .mockResolvedValueOnce(
          mockOpenAIResponse("annulation", 0.98, "Annulation")
        );

      const onProgress = vi.fn();
      const emails = [SAMPLE_EMAILS.inter, SAMPLE_EMAILS.annulation];
      await classifyEmailBatch(emails, "test-key", onProgress);

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith(1, 2);
      expect(onProgress).toHaveBeenCalledWith(2, 2);
    });

    it("continue même si un email échoue", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Server Error")
        })
        .mockResolvedValueOnce(
          mockOpenAIResponse("annulation", 0.98, "Annulation")
        );

      const emails = [SAMPLE_EMAILS.inter, SAMPLE_EMAILS.annulation];
      const results = await classifyEmailBatch(emails, "test-key");

      expect(results.size).toBe(2);
      expect(results.get("email-1")?.type).toBe(TypeEmail.AUTRE); // Erreur → autre
      expect(results.get("email-1")?.confidence).toBe(0);
      expect(results.get("email-3")?.type).toBe(TypeEmail.ANNULATION);
    });
  });

  describe("classifyEmailWithCache", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("ignore une entrée de cache si modelVersion ne correspond pas", async () => {
      vi.spyOn(llmCacheStore, "getLLMCacheEntry").mockResolvedValueOnce({
        emailId: SAMPLE_EMAILS.inter.id,
        classification: {
          type: TypeEmail.DEMANDE_INTRA,
          confidence: 0.99,
          reason: "Ancienne classification erronée"
        },
        extraction: null,
        cachedAt: new Date().toISOString(),
        modelVersion: "old-model-v0"
      });

      const cacheClassificationSpy = vi
        .spyOn(llmCacheStore, "cacheClassification")
        .mockResolvedValue();

      mockFetch.mockResolvedValueOnce(
        mockOpenAIResponse(
          "convocation-inter",
          0.95,
          "Contient 'animation inter' et lieu ORSYS"
        )
      );

      const { result, fromCache } = await classifyEmailWithCache(
        SAMPLE_EMAILS.inter,
        "test-key",
        true
      );

      expect(fromCache).toBe(false);
      expect(result.type).toBe(TypeEmail.CONVOCATION_INTER);
      expect(cacheClassificationSpy).toHaveBeenCalledTimes(1);
    });

    it("utilise le cache si modelVersion correspond", async () => {
      vi.spyOn(llmCacheStore, "getLLMCacheEntry").mockResolvedValueOnce({
        emailId: SAMPLE_EMAILS.inter.id,
        classification: {
          type: TypeEmail.CONVOCATION_INTER,
          confidence: 0.93,
          reason: "En cache"
        },
        extraction: null,
        cachedAt: new Date().toISOString(),
        modelVersion: CURRENT_MODEL_VERSION
      });

      const { result, fromCache } = await classifyEmailWithCache(
        SAMPLE_EMAILS.inter,
        "test-key",
        true
      );

      expect(fromCache).toBe(true);
      expect(result.type).toBe(TypeEmail.CONVOCATION_INTER);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// TESTS EXTRACTION
// =============================================================================

describe("LLM Extraction Prompts", () => {
  describe("buildExtractionPromptInter", () => {
    it("génère un prompt pour extraction inter", () => {
      const prompt = buildExtractionPromptInter("Corps email inter");
      expect(prompt).toContain("Corps email inter");
      expect(prompt).toContain("inter-entreprise");
      expect(prompt).toContain("Format de réponse");
    });
  });

  describe("buildExtractionPromptIntra", () => {
    it("génère un prompt pour extraction intra", () => {
      const prompt = buildExtractionPromptIntra("Corps email intra");
      expect(prompt).toContain("Corps email intra");
      expect(prompt).toContain("intra-entreprise");
      expect(prompt).toContain("Format de réponse");
    });
  });

  describe("buildExtractionPromptAnnulation", () => {
    it("génère un prompt pour extraction annulation", () => {
      const prompt = buildExtractionPromptAnnulation("Corps annulation");
      expect(prompt).toContain("Corps annulation");
      expect(prompt).toContain("annulation");
      expect(prompt).toContain("Format de réponse");
    });
  });

  describe("buildExtractionPromptBonCommande", () => {
    it("génère un prompt pour extraction bon commande", () => {
      const prompt = buildExtractionPromptBonCommande("Corps bon commande");
      expect(prompt).toContain("Corps bon commande");
      expect(prompt).toContain("bon de commande");
      expect(prompt).toContain("Format de réponse");
    });
  });

  describe("buildExtractionPromptFacturation", () => {
    it("génère un prompt pour extraction facturation", () => {
      const prompt = buildExtractionPromptFacturation("Corps facturation");
      expect(prompt).toContain("Corps facturation");
      expect(prompt).toContain("facturation");
      expect(prompt).toContain("Format de réponse");
    });
  });

  describe("EXTRACTION_SYSTEM_PROMPT", () => {
    it("contient les instructions d'extraction", () => {
      expect(EXTRACTION_SYSTEM_PROMPT).toContain("ORSYS");
      expect(EXTRACTION_SYSTEM_PROMPT).toContain("JSON");
      expect(EXTRACTION_SYSTEM_PROMPT).toContain("ISO 8601");
    });
  });
});

describe("LLM Extraction", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /**
   * Helper pour créer une réponse d'extraction mockée
   */
  function mockExtractionResponse(data: object) {
    return {
      ok: true,
      json: () =>
        Promise.resolve({
          id: "chatcmpl-test",
          object: "chat.completion",
          created: Date.now(),
          model: "gpt-5-nano",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify(data)
              },
              finish_reason: "stop"
            }
          ],
          usage: {
            prompt_tokens: 500,
            completion_tokens: 200,
            total_tokens: 700
          }
        })
    };
  }

  describe("extractFormation - Convocation Inter", () => {
    it("extrait correctement une formation inter", async () => {
      const extractedData = {
        titre: "L'intelligence artificielle au service des développeurs",
        codeEtendu: "GIAPA1",
        dateDebut: "2026-02-04",
        dateFin: "2026-02-06",
        dates: ["2026-02-04", "2026-02-05", "2026-02-06"],
        nombreJours: 3,
        lieu: {
          nom: "ORSYS La Défense",
          adresse:
            "Paroi Nord Grande Arche - 16ème étage - 1 parvis de la Défense - 92044 PARIS LA DEFENSE"
        },
        nombreParticipants: 5,
        participants: [
          { nom: "DUPONT Jean", email: "jean.dupont@example.com" }
        ],
        motDePasseDocadmin: "6d3nSFCYT"
      };

      mockFetch.mockResolvedValueOnce(mockExtractionResponse(extractedData));

      const result = await extractFormation(
        SAMPLE_EMAILS.inter,
        TypeEmail.CONVOCATION_INTER,
        "test-key"
      );

      expect(result.formation.titre).toBe(
        "L'intelligence artificielle au service des développeurs"
      );
      expect(result.formation.codeEtendu).toBe("GIAPA1");
      expect(result.formation.typeSession).toBe(TypeSession.INTER);
      expect(result.formation.statut).toBe(StatutFormation.CONFIRMEE);
      expect(result.formation.dateDebut).toBe("2026-02-04");
      expect(result.formation.dateFin).toBe("2026-02-06");
      expect(result.formation.nombreJours).toBe(3);
      expect(result.formation.lieu?.nom).toBe("ORSYS La Défense");
      expect(result.formation.nombreParticipants).toBe(5);
      expect(result.formation.motDePasseDocadmin).toBe("6d3nSFCYT");
      expect(result.formation.id).toBe("GIAPA1-2026-02-04");
      expect(result.fieldsExtracted).toContain("titre");
      expect(result.fieldsExtracted).toContain("codeEtendu");
    });

    it("gère les champs manquants", async () => {
      const extractedData = {
        titre: "Formation test",
        codeEtendu: null,
        dateDebut: "2026-02-04",
        dateFin: null,
        dates: null,
        nombreJours: null,
        lieu: null,
        nombreParticipants: null,
        participants: null,
        motDePasseDocadmin: null
      };

      mockFetch.mockResolvedValueOnce(mockExtractionResponse(extractedData));

      const result = await extractFormation(
        SAMPLE_EMAILS.inter,
        TypeEmail.CONVOCATION_INTER,
        "test-key"
      );

      expect(result.fieldsMissing).toContain("codeEtendu");
      expect(result.fieldsMissing).toContain("dateFin");
      expect(result.fieldsMissing).toContain("lieu");
      expect(result.fieldsExtracted).toContain("titre");
    });
  });

  describe("extractFormation - Convocation Intra", () => {
    it("extrait correctement une formation intra", async () => {
      const extractedData = {
        titre: "Cybersécurité et intelligence artificielle",
        codeEtendu: "XXXZZ3",
        referenceIntra: "79757",
        client: "REGION HAUTS DE FRANCE",
        dateDebut: "2026-01-21",
        dateFin: "2026-01-29",
        dates: ["2026-01-21", "2026-01-22", "2026-01-29"],
        nombreJours: 3,
        lieu: {
          nom: "REGION HAUTS DE FRANCE",
          adresse: "15 Mail Albert 1er, 80 - Amiens France",
          salle: "Salle 101 Germain Bleuet"
        },
        nombreParticipants: 9,
        niveauPersonnalisation: "standard",
        contactEntreprise: {
          nom: "Contact Test",
          telephone: "0123456789"
        }
      };

      mockFetch.mockResolvedValueOnce(mockExtractionResponse(extractedData));

      const result = await extractFormation(
        SAMPLE_EMAILS.intra,
        TypeEmail.CONVOCATION_INTRA,
        "test-key"
      );

      expect(result.formation.titre).toBe(
        "Cybersécurité et intelligence artificielle"
      );
      expect(result.formation.typeSession).toBe(TypeSession.INTRA);
      expect(result.formation.client).toBe("REGION HAUTS DE FRANCE");
      expect(result.formation.lieu?.salle).toBe("Salle 101 Germain Bleuet");
      expect(result.formation.facturation?.referenceIntra).toBe("79757");
      expect(result.formation.niveauPersonnalisation).toBe(
        NiveauPersonnalisation.STANDARD
      );
      expect(result.formation.contactEntreprise?.nom).toBe("Contact Test");
    });

    it("reconnaît les niveaux de personnalisation", async () => {
      const testCases = [
        { input: "spécifique", expected: NiveauPersonnalisation.SPECIFIQUE },
        {
          input: "ultra-spécifique",
          expected: NiveauPersonnalisation.ULTRA_SPECIFIQUE
        },
        { input: "standard", expected: NiveauPersonnalisation.STANDARD }
      ];

      for (const { input, expected } of testCases) {
        mockFetch.mockResolvedValueOnce(
          mockExtractionResponse({
            titre: "Test",
            codeEtendu: "TEST01",
            dateDebut: "2026-01-01",
            dateFin: "2026-01-02",
            niveauPersonnalisation: input
          })
        );

        const result = await extractFormation(
          SAMPLE_EMAILS.intra,
          TypeEmail.CONVOCATION_INTRA,
          "test-key"
        );

        expect(result.formation.niveauPersonnalisation).toBe(expected);
      }
    });
  });

  describe("extractFormation - Annulation", () => {
    it("extrait correctement une annulation", async () => {
      const extractedData = {
        titre: "UX design et ergonomie des sites Web",
        codeEtendu: "IHMPA1",
        dateDebut: "2026-02-25",
        dateFin: "2026-02-27",
        lieu: "PARIS LA DEFENSE",
        raisonAnnulation: "faute de participants en nombre suffisant"
      };

      mockFetch.mockResolvedValueOnce(mockExtractionResponse(extractedData));

      const result = await extractFormation(
        SAMPLE_EMAILS.annulation,
        TypeEmail.ANNULATION,
        "test-key"
      );

      expect(result.formation.statut).toBe(StatutFormation.ANNULEE);
      expect(result.formation.codeEtendu).toBe("IHMPA1");
      expect(result.formation.lieu?.nom).toBe("PARIS LA DEFENSE");
      expect(result.warnings).toContainEqual(
        expect.stringContaining("faute de participants")
      );
    });
  });

  describe("extractFormation - Bon de commande", () => {
    it("extrait correctement un bon de commande", async () => {
      const extractedData = {
        titre: "L'intelligence artificielle au service des développeurs",
        codeEtendu: "GIAZZ1",
        referenceIntra: "81982/1",
        referenceCommande: "GIAZZ1-2026-05-04",
        client: "CONDUENT BUSINESS SOLUTIONS FRANCE SAS",
        dateDebut: "2026-05-04",
        dateFin: "2026-05-06",
        nombreJours: 3,
        nombreHeures: 21,
        entiteFacturation: "ORSYS"
      };

      mockFetch.mockResolvedValueOnce(mockExtractionResponse(extractedData));

      const result = await extractFormation(
        SAMPLE_EMAILS.bonCommande,
        TypeEmail.BON_COMMANDE,
        "test-key"
      );

      expect(result.formation.typeSession).toBe(TypeSession.INTRA);
      expect(result.formation.client).toBe(
        "CONDUENT BUSINESS SOLUTIONS FRANCE SAS"
      );
      expect(result.formation.facturation?.referenceIntra).toBe("81982/1");
      expect(result.formation.facturation?.referenceCommande).toBe(
        "GIAZZ1-2026-05-04"
      );
      expect(result.formation.facturation?.entite).toBe("ORSYS");
      expect(result.formation.nombreHeures).toBe(21);
    });
  });

  describe("extractFormation - Types non extractibles", () => {
    it("retourne un warning pour les types rappel et autre", async () => {
      const resultRappel = await extractFormation(
        SAMPLE_EMAILS.inter,
        TypeEmail.RAPPEL,
        "test-key"
      );
      expect(resultRappel.warnings).toContainEqual(
        expect.stringContaining("non extractible")
      );
      expect(resultRappel.fieldsExtracted).toHaveLength(0);

      const resultAutre = await extractFormation(
        SAMPLE_EMAILS.inter,
        TypeEmail.AUTRE,
        "test-key"
      );
      expect(resultAutre.warnings).toContainEqual(
        expect.stringContaining("non extractible")
      );
    });
  });

  describe("extractFormation - Erreurs", () => {
    it("lance une erreur si pas de clé API", async () => {
      (
        getSettings as unknown as {
          mockResolvedValueOnce: (v: unknown) => void;
        }
      ).mockResolvedValueOnce({
        openaiApiKey: undefined,
        geocodingProvider: "nominatim"
      });

      let caught: unknown;
      try {
        await extractFormation(
          SAMPLE_EMAILS.inter,
          TypeEmail.CONVOCATION_INTER
        );
      } catch (e) {
        caught = e;
      }
      expect(isLLMError(caught)).toBe(true);
    });

    it("lance une erreur si JSON invalide", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: "Not valid JSON"
                }
              }
            ]
          })
      });

      let caught: unknown;
      try {
        await extractFormation(
          SAMPLE_EMAILS.inter,
          TypeEmail.CONVOCATION_INTER,
          "test-key"
        );
      } catch (e) {
        caught = e;
      }
      expect(isLLMError(caught)).toBe(true);
    });
  });

  describe("extractFormationBatch", () => {
    it("extrait plusieurs formations", async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockExtractionResponse({
            titre: "Formation Inter",
            codeEtendu: "INTER1",
            dateDebut: "2026-02-04",
            dateFin: "2026-02-06",
            nombreJours: 3
          })
        )
        .mockResolvedValueOnce(
          mockExtractionResponse({
            titre: "Formation annulée",
            codeEtendu: "ANN01",
            dateDebut: "2026-02-25",
            dateFin: "2026-02-27"
          })
        );

      const emails = [
        { email: SAMPLE_EMAILS.inter, type: TypeEmail.CONVOCATION_INTER },
        { email: SAMPLE_EMAILS.annulation, type: TypeEmail.ANNULATION }
      ];

      const results = await extractFormationBatch(emails, "test-key");

      expect(results.size).toBe(2);
      expect(results.get("email-1")?.formation.titre).toBe("Formation Inter");
      expect(results.get("email-3")?.formation.statut).toBe(
        StatutFormation.ANNULEE
      );
    });

    it("appelle le callback de progression", async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockExtractionResponse({
            titre: "Test 1",
            codeEtendu: "T1",
            dateDebut: "2026-01-01"
          })
        )
        .mockResolvedValueOnce(
          mockExtractionResponse({
            titre: "Test 2",
            codeEtendu: "T2",
            dateDebut: "2026-01-02"
          })
        );

      const onProgress = vi.fn();
      const emails = [
        { email: SAMPLE_EMAILS.inter, type: TypeEmail.CONVOCATION_INTER },
        { email: SAMPLE_EMAILS.intra, type: TypeEmail.CONVOCATION_INTRA }
      ];

      await extractFormationBatch(emails, "test-key", onProgress);

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith(1, 2);
      expect(onProgress).toHaveBeenCalledWith(2, 2);
    });

    it("continue même si une extraction échoue", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Server Error")
        })
        .mockResolvedValueOnce(
          mockExtractionResponse({
            titre: "Formation OK",
            codeEtendu: "OK01",
            dateDebut: "2026-01-01"
          })
        );

      const emails = [
        { email: SAMPLE_EMAILS.inter, type: TypeEmail.CONVOCATION_INTER },
        { email: SAMPLE_EMAILS.annulation, type: TypeEmail.ANNULATION }
      ];

      const results = await extractFormationBatch(emails, "test-key");

      expect(results.size).toBe(2);
      expect(results.get("email-1")?.warnings).toHaveLength(1);
      expect(results.get("email-3")?.formation.titre).toBe("Formation OK");
    });
  });
});
