import type { Formation } from "../types";
import { StatutFormation } from "../types";

export const VIRTUAL_FORMATION_ADDRESS =
  "2 allée du Commandant Charcot 77200 TORCY (France)";

export function isVirtualFormationCodeEtendu(
  codeEtendu: string | null | undefined
): boolean {
  if (!codeEtendu) return false;
  const normalized = codeEtendu.trim().toUpperCase();
  return /CV\d$/.test(normalized);
}

/**
 * Applique la règle métier des formations virtuelles (clarification 014).
 * Mutate l'objet formation.
 *
 * - Force `lieu.adresse` à l'adresse virtuelle.
 * - Invalide `lieu.gps` (mise à null) si la formation n'est pas annulée,
 *   afin de permettre un re-géocodage cohérent.
 */
export function applyVirtualFormationAddress(formation: Formation): boolean {
  if (!isVirtualFormationCodeEtendu(formation.codeEtendu)) return false;

  let changed = false;

  if (!formation.lieu) {
    formation.lieu = { nom: "", adresse: "", gps: null };
    changed = true;
  }

  if (formation.lieu.adresse !== VIRTUAL_FORMATION_ADDRESS) {
    formation.lieu.adresse = VIRTUAL_FORMATION_ADDRESS;
    changed = true;
  }

  // Règle métier existante : ne pas modifier le GPS d'une formation annulée.
  if (formation.statut !== StatutFormation.ANNULEE) {
    if (formation.lieu.gps !== null) {
      formation.lieu.gps = null;
      changed = true;
    }
  }

  return changed;
}
