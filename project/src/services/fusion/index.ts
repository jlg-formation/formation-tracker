/**
 * Service de fusion des emails analysés en formations
 *
 * Permet de lancer la fusion séparément de l'analyse LLM.
 * Lit les emails analysés (processed=true) et le cache LLM,
 * puis génère/met à jour les formations.
 */

import { db } from "../../stores/db";
import {
  fusionnerEmails,
  type FusionInput,
  type FusionResult
} from "../../utils/fusion";
import { TypeEmail } from "../../types";
import type { EmailRaw } from "../../types";
import { CURRENT_MODEL_VERSION } from "../../stores/llmCacheStore";
import { geocodeAddress } from "../geocoding";
import { StatutFormation } from "../../types";

/**
 * État de la fusion
 */
export interface FusionState {
  status: "idle" | "loading" | "fusing" | "geocoding" | "done" | "error";
  message: string;
  emailsAnalyses: number;
  formationsCreees: number;
  formationsMisesAJour: number;
  emailsFusionnes: number;
  emailsIgnores: number;
  geocodageEnCours: number;
  geocodageTotal: number;
  errorMessage?: string;
}

/**
 * Résultat de la fusion complète
 */
export interface FusionCompleteResult {
  success: boolean;
  stats: FusionResult["stats"] & {
    geocodageReussis: number;
    geocodageEchecs: number;
  };
  error?: string;
}

/**
 * Options pour la fusion
 */
export interface FusionOptions {
  /** Callback de progression */
  onProgress?: (state: FusionState) => void;
  /** Faire le géocodage après fusion */
  geocode?: boolean;
}

/**
 * Lance la fusion des emails analysés en formations.
 *
 * Cette fonction :
 * 1. Lit les emails avec processed=true
 * 2. Récupère les résultats d'analyse depuis le cache LLM
 * 3. Fusionne les emails en formations
 * 4. Optionnellement géocode les nouvelles adresses
 * 5. Sauvegarde les formations dans IndexedDB
 */
export async function runFusion(
  options: FusionOptions = {}
): Promise<FusionCompleteResult> {
  const { onProgress, geocode = true } = options;

  const state: FusionState = {
    status: "loading",
    message: "Chargement des emails analysés...",
    emailsAnalyses: 0,
    formationsCreees: 0,
    formationsMisesAJour: 0,
    emailsFusionnes: 0,
    emailsIgnores: 0,
    geocodageEnCours: 0,
    geocodageTotal: 0
  };

  onProgress?.(state);

  try {
    // 1. Charger les emails analysés (processed=true)
    const processedEmails = await db.emails
      .filter((e) => e.processed === true)
      .toArray();

    if (processedEmails.length === 0) {
      return {
        success: true,
        stats: {
          totalEmails: 0,
          emailsFusionnes: 0,
          formationsCreees: 0,
          formationsMisesAJour: 0,
          annulationsTraitees: 0,
          emailsIgnores: 0,
          geocodageReussis: 0,
          geocodageEchecs: 0
        }
      };
    }

    state.emailsAnalyses = processedEmails.length;
    state.message = `${processedEmails.length} emails analysés trouvés`;
    onProgress?.(state);

    // 2. Récupérer les résultats du cache LLM
    const emailIds = processedEmails.map((e) => e.id);
    const cacheEntries = await db.llmCache.bulkGet(emailIds);

    // 3. Construire les FusionInput
    const fusionInputs: FusionInput[] = [];
    const emailMap = new Map<string, EmailRaw>();
    for (const email of processedEmails) {
      emailMap.set(email.id, email);
    }

    for (const cacheEntry of cacheEntries) {
      if (!cacheEntry) continue;

      // Vérifier la version du modèle
      if (cacheEntry.modelVersion !== CURRENT_MODEL_VERSION) continue;

      const email = emailMap.get(cacheEntry.emailId);
      if (!email) continue;

      const classification = cacheEntry.classification;
      const extraction = cacheEntry.extraction;

      if (!classification || !extraction) continue;

      // Ignorer les types non pertinents
      if (
        classification.type === TypeEmail.AUTRE ||
        classification.type === TypeEmail.RAPPEL ||
        classification.type === TypeEmail.DEMANDE_INTRA
      ) {
        state.emailsIgnores++;
        continue;
      }

      fusionInputs.push({
        email,
        extraction,
        classification: {
          type: classification.type,
          confidence: classification.confidence
        }
      });
    }

    state.status = "fusing";
    state.message = `Fusion de ${fusionInputs.length} emails...`;
    onProgress?.(state);

    // 4. Charger les formations existantes
    const existingFormations = await db.formations.toArray();

    // 5. Exécuter la fusion
    const fusionResult = fusionnerEmails(fusionInputs, existingFormations);

    state.formationsCreees = fusionResult.stats.formationsCreees;
    state.formationsMisesAJour = fusionResult.stats.formationsMisesAJour;
    state.emailsFusionnes = fusionResult.stats.emailsFusionnes;
    state.emailsIgnores += fusionResult.stats.emailsIgnores;

    // 6. Sauvegarder les formations
    for (const formation of fusionResult.created) {
      await db.formations.add(formation);
    }
    for (const formation of fusionResult.updated) {
      await db.formations.put(formation);
    }

    // 7. Géocodage (optionnel)
    let geocodageReussis = 0;
    let geocodageEchecs = 0;

    if (geocode) {
      const allFormations = [...fusionResult.created, ...fusionResult.updated];

      // Filtrer les formations nécessitant géocodage
      const formationsAGeocoder = allFormations.filter(
        (f) =>
          f.lieu.adresse && !f.lieu.gps && f.statut !== StatutFormation.ANNULEE // Ne pas géocoder les annulées
      );

      if (formationsAGeocoder.length > 0) {
        state.status = "geocoding";
        state.geocodageTotal = formationsAGeocoder.length;
        state.message = `Géocodage de ${formationsAGeocoder.length} adresses...`;
        onProgress?.(state);

        for (let i = 0; i < formationsAGeocoder.length; i++) {
          const formation = formationsAGeocoder[i];

          try {
            const gps = await geocodeAddress(formation.lieu.adresse);

            if (gps) {
              formation.lieu.gps = gps;
              await db.formations.put(formation);
              geocodageReussis++;
            } else {
              geocodageEchecs++;
            }
          } catch {
            geocodageEchecs++;
          }

          state.geocodageEnCours = i + 1;
          state.message = `Géocodage ${i + 1}/${formationsAGeocoder.length}...`;
          onProgress?.(state);
        }
      }
    }

    // Résultat final
    state.status = "done";
    state.message = `Fusion terminée. ${state.formationsCreees} créées, ${state.formationsMisesAJour} mises à jour.`;
    onProgress?.(state);

    return {
      success: true,
      stats: {
        ...fusionResult.stats,
        geocodageReussis,
        geocodageEchecs
      }
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";
    state.status = "error";
    state.errorMessage = errorMessage;
    state.message = `Erreur: ${errorMessage}`;
    onProgress?.(state);

    return {
      success: false,
      stats: {
        totalEmails: state.emailsAnalyses,
        emailsFusionnes: state.emailsFusionnes,
        formationsCreees: state.formationsCreees,
        formationsMisesAJour: state.formationsMisesAJour,
        annulationsTraitees: 0,
        emailsIgnores: state.emailsIgnores,
        geocodageReussis: 0,
        geocodageEchecs: 0
      },
      error: errorMessage
    };
  }
}

/**
 * Compte les emails analysés prêts à être fusionnés
 */
export async function countAnalyzedEmails(): Promise<{
  total: number;
  withCache: number;
}> {
  const processedEmails = await db.emails
    .filter((e) => e.processed === true)
    .toArray();

  if (processedEmails.length === 0) {
    return { total: 0, withCache: 0 };
  }

  const emailIds = processedEmails.map((e) => e.id);
  const cacheEntries = await db.llmCache.bulkGet(emailIds);

  let withCache = 0;
  for (const entry of cacheEntries) {
    if (
      entry?.classification &&
      entry?.extraction &&
      entry.modelVersion === CURRENT_MODEL_VERSION
    ) {
      withCache++;
    }
  }

  return {
    total: processedEmails.length,
    withCache
  };
}
