/**
 * Tests pour le service LLM - Classification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";

import { classifyEmail, classifyEmailBatch, isLLMError } from "./index";
import { isValidEmailType, buildClassificationUserPrompt } from "./prompts";
import { TypeEmail } from "../../types";
import type { EmailInput } from "./types";

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
          model: "gpt-4o",
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
      vi.mocked(
        await import("../../stores/settingsStore")
      ).getSettings.mockResolvedValueOnce({
        openaiApiKey: undefined,
        geocodingProvider: "nominatim"
      });

      await expect(classifyEmail(SAMPLE_EMAILS.inter)).rejects.toSatisfy(
        isLLMError
      );
    });

    it("lance une erreur API si la requête échoue", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized")
      });

      await expect(
        classifyEmail(SAMPLE_EMAILS.inter, "invalid-key")
      ).rejects.toSatisfy(isLLMError);
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

      await expect(
        classifyEmail(SAMPLE_EMAILS.inter, "test-key")
      ).rejects.toSatisfy(isLLMError);
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

      await expect(
        classifyEmail(SAMPLE_EMAILS.inter, "test-key")
      ).rejects.toSatisfy(isLLMError);
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
});
