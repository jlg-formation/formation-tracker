/**
 * Constantes de l'application ORSYS Training Tracker
 */

/** Nom de l'application */
export const APP_NAME = "ORSYS Training Tracker";

/** Version de l'application */
export const APP_VERSION = "1.0.0";

/** Nom de la base de données IndexedDB */
export const DB_NAME = "orsys-training-tracker";

/** Version du schéma de base de données */
export const DB_VERSION = 1;

/** Domaine ORSYS pour le filtrage des emails */
export const ORSYS_DOMAIN = "orsys.fr";

/** Query Gmail pour les emails ORSYS */
export const GMAIL_QUERY = "from:orsys.fr";

/** Délai minimum entre requêtes géocodage Nominatim (ms) */
export const NOMINATIM_RATE_LIMIT_MS = 1000;

/** URL API Nominatim */
export const NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search";

/** User-Agent pour Nominatim (requis) */
export const NOMINATIM_USER_AGENT = "OrsysTrainingTracker/1.0";

/** Clé localStorage pour les settings temporaires */
export const SETTINGS_STORAGE_KEY = "orsys-settings";

/** Centre par défaut de la carte (France) */
export const DEFAULT_MAP_CENTER = {
  lat: 46.603354,
  lng: 1.888334
};

/** Zoom par défaut de la carte */
export const DEFAULT_MAP_ZOOM = 6;

/** Nombre maximum de résultats par page */
export const DEFAULT_PAGE_SIZE = 20;

/** Format de date pour l'affichage (FR) */
export const DATE_FORMAT_FR = "dd/MM/yyyy";

/** Format de date ISO */
export const DATE_FORMAT_ISO = "yyyy-MM-dd";
