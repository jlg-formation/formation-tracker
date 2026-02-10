/**
 * Logique de fusion des formations
 *
 * Fusionne plusieurs emails relatifs à la même formation en une seule entité.
 * Clé unique : codeEtendu + dateDebut
 */

import type { Formation, EmailRaw, ExtractionResult } from "../types";
import {
  StatutFormation,
  TypeEmail,
  getFormationKey,
  generateFormationId
} from "../types";
import { applyVirtualFormationAddress } from "./virtualFormations";

/**
 * Résultat de la fusion d'un ensemble d'emails
 */
export interface FusionResult {
  /** Formations nouvellement créées */
  created: Formation[];
  /** Formations mises à jour (y compris annulations) */
  updated: Formation[];
  /** Emails sans correspondance (type "autre" ou "rappel") */
  ignored: EmailRaw[];
  /** Statistiques de fusion */
  stats: {
    totalEmails: number;
    emailsFusionnes: number;
    formationsCreees: number;
    formationsMisesAJour: number;
    annulationsTraitees: number;
    emailsIgnores: number;
  };
}

/**
 * Entrée pour la fusion : email brut + résultat d'extraction
 */
export interface FusionInput {
  email: EmailRaw;
  extraction: ExtractionResult;
  classification: {
    type: (typeof TypeEmail)[keyof typeof TypeEmail];
    confidence: number;
  };
}

/**
 * Fusionne les données extraites de plusieurs emails en formations uniques.
 *
 * @param inputs - Liste des emails avec leurs extractions
 * @param existingFormations - Formations existantes en base (pour mise à jour)
 * @returns Résultat de la fusion avec formations créées/mises à jour
 */
export function fusionnerEmails(
  inputs: FusionInput[],
  existingFormations: Formation[] = []
): FusionResult {
  const result: FusionResult = {
    created: [],
    updated: [],
    ignored: [],
    stats: {
      totalEmails: inputs.length,
      emailsFusionnes: 0,
      formationsCreees: 0,
      formationsMisesAJour: 0,
      annulationsTraitees: 0,
      emailsIgnores: 0
    }
  };

  // Index des formations existantes par clé
  const formationsByKey = new Map<string, Formation>();
  for (const formation of existingFormations) {
    const key = getFormationKey({
      codeEtendu: formation.codeEtendu,
      dateDebut: formation.dateDebut
    });
    formationsByKey.set(key, formation);
  }

  // Grouper les inputs par clé de formation
  const inputsByKey = new Map<string, FusionInput[]>();

  for (const input of inputs) {
    const { email, extraction, classification } = input;

    // Ignorer les emails sans extraction valide ou de type ignoré
    if (
      classification.type === TypeEmail.DEMANDE_INTRA ||
      classification.type === TypeEmail.RAPPEL ||
      classification.type === TypeEmail.AUTRE
    ) {
      result.ignored.push(email);
      result.stats.emailsIgnores++;
      continue;
    }

    // Vérifier qu'on a les champs obligatoires pour la fusion
    const { formation } = extraction;
    if (!formation.codeEtendu || !formation.dateDebut) {
      // Email mal parsé, on l'ignore
      result.ignored.push(email);
      result.stats.emailsIgnores++;
      continue;
    }

    const key = getFormationKey({
      codeEtendu: formation.codeEtendu,
      dateDebut: formation.dateDebut
    });

    if (!inputsByKey.has(key)) {
      inputsByKey.set(key, []);
    }
    inputsByKey.get(key)!.push(input);
  }

  // Traiter chaque groupe de formations
  for (const [key, groupInputs] of inputsByKey) {
    const existingFormation = formationsByKey.get(key);

    if (existingFormation) {
      // Mise à jour d'une formation existante
      const updated = fusionnerAvecExistante(existingFormation, groupInputs);
      result.updated.push(updated);
      result.stats.formationsMisesAJour++;

      // Compter les annulations
      if (
        updated.statut === StatutFormation.ANNULEE &&
        existingFormation.statut !== StatutFormation.ANNULEE
      ) {
        result.stats.annulationsTraitees++;
      }
    } else {
      // Nouvelle formation
      const newFormation = creerFormationDepuisInputs(groupInputs);
      result.created.push(newFormation);
      result.stats.formationsCreees++;

      // Compter les annulations (formation créée directement annulée)
      if (newFormation.statut === StatutFormation.ANNULEE) {
        result.stats.annulationsTraitees++;
      }
    }

    // Comptabiliser les emails fusionnés (tous sauf le premier qui "crée")
    result.stats.emailsFusionnes += groupInputs.length - 1;
  }

  return result;
}

/**
 * Crée une nouvelle formation à partir d'un groupe d'inputs
 */
function creerFormationDepuisInputs(inputs: FusionInput[]): Formation {
  // Trier les inputs par date d'email (plus récent en dernier pour priorité)
  const sortedInputs = [...inputs].sort(
    (a, b) =>
      new Date(a.email.date).getTime() - new Date(b.email.date).getTime()
  );

  // Base de la formation avec valeurs par défaut
  const now = new Date().toISOString();
  const formation: Formation = {
    id: "",
    titre: "",
    codeEtendu: "",
    statut: StatutFormation.CONFIRMEE,
    dateDebut: "",
    dateFin: "",
    dates: [],
    nombreJours: 0,
    lieu: {
      nom: "",
      adresse: "",
      gps: null
    },
    typeSession: "inter",
    niveauPersonnalisation: "standard",
    nombreParticipants: 0,
    participants: [],
    emailIds: [],
    createdAt: now,
    updatedAt: now
  };

  // Fusionner les données de chaque input (les plus récents écrasent)
  for (const input of sortedInputs) {
    const { email, extraction, classification } = input;

    // Ajouter l'ID de l'email source
    if (!formation.emailIds.includes(email.id)) {
      formation.emailIds.push(email.id);
    }

    // Fusionner les champs de l'extraction
    fusionnerChamps(formation, extraction.formation);

    // Gérer les annulations
    if (classification.type === TypeEmail.ANNULATION) {
      formation.statut = StatutFormation.ANNULEE;
    }
  }

  // Générer l'ID basé sur le code et la date
  formation.id = generateFormationId(formation.codeEtendu, formation.dateDebut);

  // Post-traitements métier (clarification 014)
  applyVirtualFormationAddress(formation);

  return formation;
}

/**
 * Fusionne une formation existante avec de nouveaux inputs
 */
function fusionnerAvecExistante(
  existing: Formation,
  inputs: FusionInput[]
): Formation {
  // Copier la formation existante
  const formation: Formation = { ...existing };
  formation.updatedAt = new Date().toISOString();

  // Trier par date
  const sortedInputs = [...inputs].sort(
    (a, b) =>
      new Date(a.email.date).getTime() - new Date(b.email.date).getTime()
  );

  for (const input of sortedInputs) {
    const { email, extraction, classification } = input;

    // Ajouter l'ID de l'email source s'il n'est pas déjà présent
    if (!formation.emailIds.includes(email.id)) {
      formation.emailIds.push(email.id);
    }

    // Fusionner les champs (enrichissement)
    fusionnerChamps(formation, extraction.formation);

    // Gérer les annulations (priorité absolue)
    if (classification.type === TypeEmail.ANNULATION) {
      formation.statut = StatutFormation.ANNULEE;
    }
  }

  // Post-traitements métier (clarification 014)
  applyVirtualFormationAddress(formation);

  return formation;
}

/**
 * Fusionne les champs d'une extraction partielle dans une formation.
 * Stratégie : les nouveaux champs non-vides écrasent les anciens,
 * sauf pour les tableaux qui sont fusionnés.
 */
function fusionnerChamps(target: Formation, source: Partial<Formation>): void {
  // Champs simples (écraser si la source a une valeur)
  if (source.titre) target.titre = source.titre;
  if (source.codeEtendu) target.codeEtendu = source.codeEtendu;
  if (source.codeFormation) target.codeFormation = source.codeFormation;
  if (source.dateDebut) target.dateDebut = source.dateDebut;
  if (source.dateFin) target.dateFin = source.dateFin;
  if (source.nombreJours && source.nombreJours > 0) {
    target.nombreJours = source.nombreJours;
  }
  if (source.nombreHeures && source.nombreHeures > 0) {
    target.nombreHeures = source.nombreHeures;
  }
  if (source.typeSession) target.typeSession = source.typeSession;
  if (source.niveauPersonnalisation) {
    target.niveauPersonnalisation = source.niveauPersonnalisation;
  }
  if (source.client) target.client = source.client;
  if (source.nombreParticipants && source.nombreParticipants > 0) {
    target.nombreParticipants = source.nombreParticipants;
  }

  // Mots de passe DocAdmin
  if (source.motDePasseDocadmin) {
    target.motDePasseDocadmin = source.motDePasseDocadmin;
  }
  if (source.motDePasseParticipants) {
    target.motDePasseParticipants = source.motDePasseParticipants;
  }

  // Lieu (fusionner les sous-champs)
  if (source.lieu) {
    if (source.lieu.nom) target.lieu.nom = source.lieu.nom;
    if (source.lieu.adresse) target.lieu.adresse = source.lieu.adresse;
    if (source.lieu.gps) target.lieu.gps = source.lieu.gps;
    if (source.lieu.salle) target.lieu.salle = source.lieu.salle;
  }

  // Dates (fusionner les tableaux sans doublons)
  if (source.dates && source.dates.length > 0) {
    const allDates = new Set([...target.dates, ...source.dates]);
    target.dates = Array.from(allDates).sort();
  }

  // Participants (fusionner par email)
  if (source.participants && source.participants.length > 0) {
    const participantsByEmail = new Map(
      target.participants.map((p) => [p.email, p])
    );
    for (const participant of source.participants) {
      if (participant.email) {
        participantsByEmail.set(participant.email, participant);
      }
    }
    target.participants = Array.from(participantsByEmail.values());
    target.nombreParticipants = Math.max(
      target.nombreParticipants,
      target.participants.length
    );
  }

  // Contact entreprise
  if (source.contactEntreprise) {
    target.contactEntreprise = {
      ...target.contactEntreprise,
      ...source.contactEntreprise
    };
  }

  // Facturation (fusionner les sous-champs)
  if (source.facturation) {
    target.facturation = {
      ...target.facturation,
      ...source.facturation
    } as Formation["facturation"];
  }
}

/**
 * Recherche une formation existante par clé (codeEtendu + dateDebut)
 */
export function trouverFormationParCle(
  formations: Formation[],
  codeEtendu: string,
  dateDebut: string
): Formation | undefined {
  const key = getFormationKey({ codeEtendu, dateDebut });
  return formations.find((f) => {
    const fKey = getFormationKey({
      codeEtendu: f.codeEtendu,
      dateDebut: f.dateDebut
    });
    return fKey === key;
  });
}

/**
 * Vérifie si deux formations sont la même (même clé)
 */
export function estMemeFormation(
  f1: Pick<Formation, "codeEtendu" | "dateDebut">,
  f2: Pick<Formation, "codeEtendu" | "dateDebut">
): boolean {
  return f1.codeEtendu === f2.codeEtendu && f1.dateDebut === f2.dateDebut;
}

/**
 * Groupe les emails par formation (clé unique)
 */
export function grouperParFormation(
  inputs: FusionInput[]
): Map<string, FusionInput[]> {
  const groups = new Map<string, FusionInput[]>();

  for (const input of inputs) {
    const { formation } = input.extraction;
    if (!formation.codeEtendu || !formation.dateDebut) {
      continue;
    }

    const key = getFormationKey({
      codeEtendu: formation.codeEtendu,
      dateDebut: formation.dateDebut
    });

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(input);
  }

  return groups;
}
