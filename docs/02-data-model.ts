/**
 * 02 - Data Model
 * Types TypeScript pour ORSYS Training Tracker
 */

// =============================================================================
// ENUMS
// =============================================================================

/** Statut de la formation */
export enum StatutFormation {
  CONFIRMEE = "confirmée",
  ANNULEE = "annulée"
}

/** Type de session */
export enum TypeSession {
  INTER = "inter",
  INTRA = "intra"
}

/** Niveau de personnalisation */
export enum NiveauPersonnalisation {
  STANDARD = "standard",
  SPECIFIQUE = "spécifique",
  ULTRA_SPECIFIQUE = "ultra-spécifique"
}

/** Type d'email ORSYS */
export enum TypeEmail {
  CONVOCATION_INTER = "convocation-inter",
  CONVOCATION_INTRA = "convocation-intra",
  ANNULATION = "annulation",
  BON_COMMANDE = "bon-commande",
  INFO_FACTURATION = "info-facturation",
  RAPPEL = "rappel",
  AUTRE = "autre"
}

/** Entité de facturation */
export enum EntiteFacturation {
  ORSYS = "ORSYS",
  ORSYS_INSTITUT = "ORSYS INSTITUT",
  ORSYS_BELGIQUE = "ORSYS BELGIQUE",
  ORSYS_SUISSE = "ORSYS SUISSE",
  ORSYS_LUXEMBOURG = "ORSYS LUXEMBOURG"
}

// =============================================================================
// INTERFACES PRINCIPALES
// =============================================================================

/** Coordonnées GPS */
export interface CoordonneesGPS {
  lat: number;
  lng: number;
}

/** Lieu de formation */
export interface Lieu {
  /** Nom du lieu (ex: "ORSYS Paris La Défense") */
  nom: string;
  /** Adresse postale complète */
  adresse: string;
  /** Coordonnées GPS (géocodage automatique) */
  gps: CoordonneesGPS | null;
  /** Salle (si précisée) */
  salle?: string;
}

/** Participant à la formation */
export interface Participant {
  /** Nom complet */
  nom: string;
  /** Adresse email */
  email: string;
}

/** Contact entreprise (formations intra) */
export interface ContactEntreprise {
  /** Nom du contact */
  nom?: string;
  /** Téléphone */
  telephone?: string;
  /** Email */
  email?: string;
}

/** Informations de facturation */
export interface Facturation {
  /** Entité du groupe ORSYS à facturer */
  entite: EntiteFacturation | string;
  /** Référence intra (ex: "81982/1") */
  referenceIntra?: string;
  /** Référence de commande (ex: "GIAZZ1-2026-05-04") */
  referenceCommande?: string;
  /** Tarif animation HT */
  tarifAnimation?: number;
  /** Plafond frais TTC */
  plafondFrais?: number;
}

/** Formation */
export interface Formation {
  /** Identifiant unique (généré) */
  id: string;

  // --- Informations générales ---
  /** Intitulé complet de la formation */
  titre: string;
  /** Code court (ex: "BOA") - optionnel car pas toujours présent */
  codeFormation?: string;
  /** Code étendu (ex: "GIAPA1") */
  codeEtendu: string;
  /** Statut de la formation */
  statut: StatutFormation;

  // --- Dates ---
  /** Date de début (ISO 8601) */
  dateDebut: string;
  /** Date de fin (ISO 8601) */
  dateFin: string;
  /** Toutes les dates de la session */
  dates: string[];
  /** Durée en jours */
  nombreJours: number;
  /** Durée en heures (si précisée) */
  nombreHeures?: number;

  // --- Localisation ---
  /** Lieu de la formation */
  lieu: Lieu;

  // --- Type ---
  /** Type de session */
  typeSession: TypeSession;
  /** Niveau de personnalisation */
  niveauPersonnalisation: NiveauPersonnalisation;
  /** Nom du client (formations intra) */
  client?: string;

  // --- Participants ---
  /** Nombre de participants */
  nombreParticipants: number;
  /** Liste des participants (si disponible) */
  participants: Participant[];

  // --- Accès ---
  /** Mot de passe formateur DocAdmin */
  motDePasseDocadmin?: string;
  /** Mot de passe participants DocAdmin */
  motDePasseParticipants?: string;

  // --- Contact ---
  /** Contact sur site (formations intra) */
  contactEntreprise?: ContactEntreprise;

  // --- Facturation ---
  /** Informations de facturation */
  facturation?: Facturation;

  // --- Métadonnées ---
  /** IDs des emails sources (pour traçabilité) */
  emailIds: string[];
  /** Date de dernière mise à jour */
  updatedAt: string;
  /** Date de création */
  createdAt: string;
}

// =============================================================================
// INTERFACES EMAIL
// =============================================================================

/** Email brut stocké en cache */
export interface EmailRaw {
  /** ID Gmail */
  id: string;
  /** Thread ID Gmail */
  threadId: string;
  /** Expéditeur */
  from: string;
  /** Sujet */
  subject: string;
  /** Date de réception (ISO 8601) */
  date: string;
  /** Corps du message (texte brut) */
  body: string;
  /** Corps HTML (optionnel) */
  bodyHtml?: string;
  /** Déjà traité ? */
  processed: boolean;
  /** Type d'email détecté */
  type?: TypeEmail;
  /** ID de la formation associée (après traitement) */
  formationId?: string;
}

/** Résultat de classification LLM */
export interface ClassificationResult {
  /** Type d'email détecté */
  type: TypeEmail;
  /** Niveau de confiance (0-1) */
  confidence: number;
  /** Raison de la classification */
  reason?: string;
}

/** Résultat d'extraction LLM */
export interface ExtractionResult {
  /** Formation extraite (partielle) */
  formation: Partial<Formation>;
  /** Champs extraits avec succès */
  fieldsExtracted: string[];
  /** Champs manquants */
  fieldsMissing: string[];
  /** Avertissements */
  warnings: string[];
}

// =============================================================================
// INTERFACES STOCKAGE
// =============================================================================

/** Métadonnées de l'extraction */
export interface ExtractionMetadata {
  /** Date de dernière extraction */
  dateExtraction: string;
  /** Nombre total de formations */
  totalFormations: number;
  /** Nombre de formations annulées */
  formationsAnnulees: number;
  /** Nombre d'emails traités */
  emailsTraites: number;
  /** Nombre d'emails ignorés */
  emailsIgnores: number;
}

/** Structure export JSON */
export interface ExportData {
  metadata: ExtractionMetadata;
  formations: Formation[];
}

/** Entrée du cache de géocodage */
export interface GeocacheEntry {
  /** Adresse originale */
  adresse: string;
  /** Coordonnées GPS */
  gps: CoordonneesGPS | null;
  /** Provider utilisé */
  provider: "nominatim" | "google" | "mapbox";
  /** Date de cache */
  cachedAt: string;
}

// =============================================================================
// INTERFACES SETTINGS
// =============================================================================

/** Configuration de l'application */
export interface AppSettings {
  /** Clé API OpenAI */
  openaiApiKey?: string;
  /** Provider de géocodage actif */
  geocodingProvider: "nominatim" | "google" | "mapbox";
  /** Clé API Google (si provider = google) */
  googleApiKey?: string;
  /** Clé API Mapbox (si provider = mapbox) */
  mapboxApiKey?: string;
  /** Token Gmail (géré automatiquement) */
  gmailToken?: string;
  /** Date d'expiration token Gmail */
  gmailTokenExpiry?: string;
}

// =============================================================================
// INTERFACES UI
// =============================================================================

/** Filtres de recherche */
export interface FormationFilters {
  /** Recherche textuelle */
  search?: string;
  /** Filtre par année */
  annee?: number;
  /** Filtre par statut */
  statut?: StatutFormation;
  /** Filtre par type de session */
  typeSession?: TypeSession;
  /** Filtre par code formation */
  codeFormation?: string;
  /** Filtre par lieu */
  lieu?: string;
  /** Date début (range) */
  dateDebut?: string;
  /** Date fin (range) */
  dateFin?: string;
}

/** Statistiques agrégées */
export interface FormationStats {
  /** Total formations (hors annulées) */
  total: number;
  /** Total annulées */
  annulees: number;
  /** Total inter */
  inter: number;
  /** Total intra */
  intra: number;
  /** Par année */
  parAnnee: Record<number, number>;
  /** Par code formation */
  parCode: Record<string, number>;
  /** Par lieu */
  parLieu: Record<string, number>;
  /** Nombre total de jours */
  totalJours: number;
  /** Nombre total de participants */
  totalParticipants: number;
}

// =============================================================================
// TYPES UTILITAIRES
// =============================================================================

/** Formation partielle (pour fusion) */
export type PartialFormation = Partial<Formation> & {
  codeEtendu: string;
  dateDebut: string;
};

/** Clé unique d'une formation (pour déduplication) */
export type FormationKey = `${string}-${string}`; // codeEtendu-dateDebut

/** Générateur de clé */
export function getFormationKey(f: PartialFormation): FormationKey {
  return `${f.codeEtendu}-${f.dateDebut}`;
}

/** Génère un ID unique */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
