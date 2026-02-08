import { useState, useEffect } from "react";
import { useSettings } from "../../hooks/useSettings";
import { useGmailAuth } from "../../hooks/useGmailAuth";
import {
  classifyEmail,
  type ClassificationResult,
  type EmailInput
} from "../../services/llm";
import {
  geocodeAddress,
  getGeocacheStats,
  preloadKnownLocations,
  clearGeocache
} from "../../services/geocoding";
import type { CoordonneesGPS } from "../../types";
import { OPENAI_MODELS, type OpenAIModelId } from "../../types";

type GeocodingProvider = "nominatim" | "google" | "mapbox";

/** Status du test de connexion OpenAI */
type OpenAITestStatus = "idle" | "testing" | "success" | "error";

/** Status du test de classification LLM */
type ClassificationTestStatus = "idle" | "testing" | "success" | "error";

/** Status du test de géocodage */
type GeocodingTestStatus = "idle" | "testing" | "success" | "error";

/** Résultat du test de géocodage */
interface GeocodingTestResult {
  gps: CoordonneesGPS | null;
  fromCache: boolean;
  duration: number;
}

/** Exemples d'emails pour le test de classification */
const EMAIL_SAMPLES: Record<
  string,
  { subject: string; body: string; label: string }
> = {
  inter: {
    label: "Convocation Inter-entreprise",
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
    label: "Convocation Intra-entreprise",
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
    label: "Annulation de session",
    subject: "SESSION ANNULEE",
    body: `SESSION ANNULEE

Bonjour,

Nous vous informons que nous avons dû annuler, faute de participants en nombre suffisant, la session :

IHMPA1 : UX design et ergonomie des sites Web à PARIS LA DEFENSE
du 25/02/2026 au 27/02/2026

Nous espérons pouvoir vous proposer très prochainement une nouvelle session.`
  },
  bonCommande: {
    label: "Bon de commande",
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

export function SettingsPage() {
  const { settings, loading, saving, error, updateSettings } = useSettings();
  const {
    connectionState,
    clientId,
    loading: gmailLoading,
    error: gmailError,
    connect,
    disconnect,
    setClientId
  } = useGmailAuth();

  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [localOpenAIKey, setLocalOpenAIKey] = useState("");
  const [localGoogleKey, setLocalGoogleKey] = useState("");
  const [localMapboxKey, setLocalMapboxKey] = useState("");
  const [localGoogleClientId, setLocalGoogleClientId] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // État pour le test de connexion OpenAI
  const [openAITestStatus, setOpenAITestStatus] =
    useState<OpenAITestStatus>("idle");
  const [openAITestError, setOpenAITestError] = useState<string | null>(null);

  // État pour le test de classification LLM
  const [selectedEmailSample, setSelectedEmailSample] =
    useState<string>("inter");
  const [customEmailSubject, setCustomEmailSubject] = useState("");
  const [customEmailBody, setCustomEmailBody] = useState("");
  const [useCustomEmail, setUseCustomEmail] = useState(false);
  const [classificationTestStatus, setClassificationTestStatus] =
    useState<ClassificationTestStatus>("idle");
  const [classificationResult, setClassificationResult] =
    useState<ClassificationResult | null>(null);
  const [classificationError, setClassificationError] = useState<string | null>(
    null
  );

  // État pour le test de géocodage
  const [geocodingTestAddress, setGeocodingTestAddress] = useState(
    "ORSYS La Défense, 1 Parvis de la Défense, 92044 Paris"
  );
  const [geocodingTestStatus, setGeocodingTestStatus] =
    useState<GeocodingTestStatus>("idle");
  const [geocodingTestResult, setGeocodingTestResult] =
    useState<GeocodingTestResult | null>(null);
  const [geocodingTestError, setGeocodingTestError] = useState<string | null>(
    null
  );
  const [geocacheStats, setGeocacheStats] = useState<{
    total: number;
    withCoords: number;
    withoutCoords: number;
  } | null>(null);

  // Synchroniser les valeurs locales au chargement
  useEffect(() => {
    if (!loading) {
      setLocalOpenAIKey(settings.openaiApiKey || "");
      setLocalGoogleKey(settings.googleApiKey || "");
      setLocalMapboxKey(settings.mapboxApiKey || "");
    }
  }, [loading, settings]);

  // Synchroniser le Client ID Google
  useEffect(() => {
    if (clientId) {
      setLocalGoogleClientId(clientId);
    }
  }, [clientId]);

  const handleSaveOpenAIKey = async () => {
    await updateSettings({ openaiApiKey: localOpenAIKey || undefined });
    showSaveSuccess();
  };

  const handleProviderChange = async (provider: GeocodingProvider) => {
    await updateSettings({ geocodingProvider: provider });
    showSaveSuccess();
  };

  const handleSaveGeocodingKeys = async () => {
    await updateSettings({
      googleApiKey: localGoogleKey || undefined,
      mapboxApiKey: localMapboxKey || undefined
    });
    showSaveSuccess();
  };

  const showSaveSuccess = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleSaveGoogleClientId = () => {
    if (localGoogleClientId.trim()) {
      setClientId(localGoogleClientId.trim());
      showSaveSuccess();
    }
  };

  /**
   * Teste la connexion à l'API OpenAI en appelant le endpoint /v1/models
   * Utilise la clé sauvegardée dans les settings
   */
  const handleTestOpenAIConnection = async () => {
    const apiKey = settings.openaiApiKey;

    if (!apiKey) {
      setOpenAITestStatus("error");
      setOpenAITestError("Veuillez d'abord sauvegarder une clé API.");
      return;
    }

    setOpenAITestStatus("testing");
    setOpenAITestError(null);

    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      });

      if (response.ok) {
        setOpenAITestStatus("success");
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error?.message ||
          `Erreur ${response.status}: ${response.statusText}`;
        setOpenAITestStatus("error");
        setOpenAITestError(errorMessage);
      }
    } catch (err) {
      setOpenAITestStatus("error");
      setOpenAITestError(
        err instanceof Error ? err.message : "Erreur de connexion réseau"
      );
    }
  };

  /**
   * Teste la classification LLM avec un email exemple ou personnalisé
   */
  const handleTestClassification = async () => {
    if (!settings.openaiApiKey) {
      setClassificationTestStatus("error");
      setClassificationError(
        "Veuillez d'abord configurer et sauvegarder une clé API OpenAI."
      );
      return;
    }

    setClassificationTestStatus("testing");
    setClassificationResult(null);
    setClassificationError(null);

    try {
      const emailToTest: EmailInput = useCustomEmail
        ? {
            id: "test-custom",
            subject: customEmailSubject || "(Sans sujet)",
            body: customEmailBody
          }
        : {
            id: `test-${selectedEmailSample}`,
            subject: EMAIL_SAMPLES[selectedEmailSample].subject,
            body: EMAIL_SAMPLES[selectedEmailSample].body
          };

      if (!emailToTest.body.trim()) {
        setClassificationTestStatus("error");
        setClassificationError(
          "Veuillez saisir un contenu d'email à classifier."
        );
        return;
      }

      const result = await classifyEmail(emailToTest);
      setClassificationResult(result);
      setClassificationTestStatus("success");
    } catch (err) {
      setClassificationTestStatus("error");
      setClassificationError(
        err instanceof Error ? err.message : "Erreur lors de la classification"
      );
    }
  };

  /**
   * Teste le géocodage d'une adresse
   */
  const handleTestGeocodage = async () => {
    if (!geocodingTestAddress.trim()) {
      setGeocodingTestStatus("error");
      setGeocodingTestError("Veuillez saisir une adresse à géocoder.");
      return;
    }

    setGeocodingTestStatus("testing");
    setGeocodingTestResult(null);
    setGeocodingTestError(null);

    const startTime = Date.now();

    try {
      // Vérifier si l'adresse est déjà dans le cache
      const statsBefore = await getGeocacheStats();

      const gps = await geocodeAddress(geocodingTestAddress);

      const statsAfter = await getGeocacheStats();
      const duration = Date.now() - startTime;

      // Si le cache a grandi, c'était un appel API, sinon c'était un cache hit
      const fromCache = statsAfter.total === statsBefore.total;

      setGeocodingTestResult({ gps, fromCache, duration });
      setGeocodingTestStatus("success");

      // Mettre à jour les stats du cache
      setGeocacheStats(statsAfter);
    } catch (err) {
      setGeocodingTestStatus("error");
      setGeocodingTestError(
        err instanceof Error ? err.message : "Erreur lors du géocodage"
      );
    }
  };

  /**
   * Charge les statistiques du cache de géocodage
   */
  const loadGeocacheStats = async () => {
    const stats = await getGeocacheStats();
    setGeocacheStats(stats);
  };

  /**
   * Précharge les adresses ORSYS connues dans le cache
   */
  const handlePreloadKnownLocations = async () => {
    const count = await preloadKnownLocations();
    await loadGeocacheStats();
    if (count > 0) {
      setGeocodingTestError(null);
    }
  };

  /**
   * Vide le cache de géocodage
   */
  const handleClearGeocache = async () => {
    await clearGeocache();
    await loadGeocacheStats();
    setGeocodingTestResult(null);
  };

  // Charger les stats du cache au montage
  useEffect(() => {
    loadGeocacheStats();
  }, []);

  if (loading) {
    return (
      <div className="text-left">
        <h1 className="text-2xl font-bold text-white mb-2">Paramètres</h1>
        <p className="text-gray-400">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="text-left max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-2">Paramètres</h1>
      <p className="text-gray-400 mb-6">Configuration de l'application</p>

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-600 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {saveSuccess && (
        <div className="mb-6 p-4 bg-green-900/30 border border-green-600 rounded-lg text-green-300">
          ✓ Paramètres sauvegardés
        </div>
      )}

      {/* Section API OpenAI */}
      <section className="mb-8 p-6 bg-gray-800/50 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🤖</span> API OpenAI
        </h2>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="openai-key"
              className="block text-sm text-gray-400 mb-2"
            >
              Clé API OpenAI
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="openai-key"
                  type={showOpenAIKey ? "text" : "password"}
                  value={localOpenAIKey}
                  onChange={(e) => setLocalOpenAIKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                  aria-label={showOpenAIKey ? "Masquer" : "Afficher"}
                >
                  {showOpenAIKey ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              <button
                onClick={handleSaveOpenAIKey}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white rounded-md transition-colors"
              >
                {saving ? "..." : "Sauvegarder"}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Nécessaire pour la classification et l'extraction des emails.
              Obtenez une clé sur{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                platform.openai.com
              </a>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="text-sm">
              Statut :{" "}
              {settings.openaiApiKey ? (
                <span className="text-green-400">✓ Configurée</span>
              ) : (
                <span className="text-yellow-400">⚠ Non configurée</span>
              )}
            </div>

            {/* Bouton Tester la connexion */}
            <button
              onClick={handleTestOpenAIConnection}
              disabled={
                openAITestStatus === "testing" || !settings.openaiApiKey
              }
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-md transition-colors text-sm"
            >
              {openAITestStatus === "testing" ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Test en cours...
                </span>
              ) : (
                "Tester la connexion"
              )}
            </button>
          </div>

          {/* Résultat du test */}
          {openAITestStatus === "success" && (
            <div className="mt-3 p-3 bg-green-900/30 border border-green-600 rounded text-green-300 text-sm flex items-center gap-2">
              <span>✅</span> Connexion réussie ! La clé API est valide.
            </div>
          )}
          {openAITestStatus === "error" && (
            <div className="mt-3 p-3 bg-red-900/30 border border-red-600 rounded text-red-300 text-sm flex items-center gap-2">
              <span>❌</span> {openAITestError || "Erreur de connexion"}
            </div>
          )}

          {/* Sélection du modèle OpenAI */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <label className="block text-sm text-gray-400 mb-2">
              Modèle OpenAI
            </label>
            <select
              value={settings.openaiModel || "gpt-4o-mini"}
              onChange={async (e) => {
                await updateSettings({
                  openaiModel: e.target.value as OpenAIModelId
                });
                showSaveSuccess();
              }}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md text-white focus:outline-none focus:border-indigo-500"
            >
              {OPENAI_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} - {model.description} ({model.pricing})
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500">
              GPT-4o Mini est recommandé pour un bon rapport qualité/prix. Les
              modèles plus puissants sont plus précis mais plus coûteux.
            </p>
          </div>
        </div>
      </section>

      {/* Section Test de classification LLM */}
      <section className="mb-8 p-6 bg-gray-800/50 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🧪</span> Test de classification LLM
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Testez la classification des emails en utilisant un exemple prédéfini
          ou en collant votre propre email.
        </p>

        <div className="space-y-4">
          {/* Sélection : exemple ou personnalisé */}
          <div className="flex flex-col sm:flex-row gap-4">
            <label
              className={`flex items-center gap-2 px-4 py-3 rounded-md border cursor-pointer transition-colors ${
                !useCustomEmail
                  ? "bg-indigo-600/20 border-indigo-500 text-white"
                  : "bg-gray-900 border-gray-600 text-gray-400 hover:border-gray-500"
              }`}
            >
              <input
                type="radio"
                name="email-source"
                checked={!useCustomEmail}
                onChange={() => setUseCustomEmail(false)}
                className="sr-only"
              />
              <span>📋 Email exemple</span>
            </label>
            <label
              className={`flex items-center gap-2 px-4 py-3 rounded-md border cursor-pointer transition-colors ${
                useCustomEmail
                  ? "bg-indigo-600/20 border-indigo-500 text-white"
                  : "bg-gray-900 border-gray-600 text-gray-400 hover:border-gray-500"
              }`}
            >
              <input
                type="radio"
                name="email-source"
                checked={useCustomEmail}
                onChange={() => setUseCustomEmail(true)}
                className="sr-only"
              />
              <span>✏️ Email personnalisé</span>
            </label>
          </div>

          {/* Sélecteur d'email exemple */}
          {!useCustomEmail && (
            <div>
              <label
                htmlFor="email-sample-select"
                className="block text-sm text-gray-400 mb-2"
              >
                Choisir un type d'email
              </label>
              <select
                id="email-sample-select"
                value={selectedEmailSample}
                onChange={(e) => setSelectedEmailSample(e.target.value)}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md text-white focus:outline-none focus:border-indigo-500"
              >
                {Object.entries(EMAIL_SAMPLES).map(([key, sample]) => (
                  <option key={key} value={key}>
                    {sample.label}
                  </option>
                ))}
              </select>
              <div className="mt-3 p-3 bg-gray-900 border border-gray-700 rounded-md">
                <p className="text-xs text-gray-500 mb-1">Sujet :</p>
                <p className="text-sm text-white mb-2">
                  {EMAIL_SAMPLES[selectedEmailSample].subject}
                </p>
                <p className="text-xs text-gray-500 mb-1">
                  Contenu (extrait) :
                </p>
                <p className="text-xs text-gray-400 whitespace-pre-wrap line-clamp-4">
                  {EMAIL_SAMPLES[selectedEmailSample].body.slice(0, 200)}...
                </p>
              </div>
            </div>
          )}

          {/* Zone de texte pour email personnalisé */}
          {useCustomEmail && (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="custom-email-subject"
                  className="block text-sm text-gray-400 mb-2"
                >
                  Sujet de l'email
                </label>
                <input
                  id="custom-email-subject"
                  type="text"
                  value={customEmailSubject}
                  onChange={(e) => setCustomEmailSubject(e.target.value)}
                  placeholder="Ex: Confirmation animation inter"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label
                  htmlFor="custom-email-body"
                  className="block text-sm text-gray-400 mb-2"
                >
                  Corps de l'email
                </label>
                <textarea
                  id="custom-email-body"
                  value={customEmailBody}
                  onChange={(e) => setCustomEmailBody(e.target.value)}
                  placeholder="Collez ici le contenu de l'email à classifier..."
                  rows={8}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-y"
                />
              </div>
            </div>
          )}

          {/* Bouton de test */}
          <div>
            <button
              onClick={handleTestClassification}
              disabled={
                classificationTestStatus === "testing" || !settings.openaiApiKey
              }
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded-md transition-colors"
            >
              {classificationTestStatus === "testing" ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Classification en
                  cours...
                </span>
              ) : (
                "🔍 Tester la classification"
              )}
            </button>
            {!settings.openaiApiKey && (
              <p className="mt-2 text-xs text-yellow-400">
                ⚠ Configurez d'abord votre clé API OpenAI ci-dessus.
              </p>
            )}
          </div>

          {/* Résultat de la classification */}
          {classificationTestStatus === "success" && classificationResult && (
            <div className="mt-4 p-4 bg-green-900/20 border border-green-600 rounded-lg">
              <h3 className="text-sm font-semibold text-green-400 mb-3">
                ✅ Classification réussie
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-900/50 p-3 rounded">
                  <p className="text-xs text-gray-500 mb-1">Type détecté</p>
                  <p className="text-white font-mono text-sm">
                    {classificationResult.type}
                  </p>
                </div>
                <div className="bg-gray-900/50 p-3 rounded">
                  <p className="text-xs text-gray-500 mb-1">Confiance</p>
                  <p className="text-white font-mono text-sm">
                    {Math.round(classificationResult.confidence * 100)}%
                  </p>
                </div>
                <div className="bg-gray-900/50 p-3 rounded sm:col-span-1">
                  <p className="text-xs text-gray-500 mb-1">Raison</p>
                  <p className="text-gray-300 text-sm">
                    {classificationResult.reason}
                  </p>
                </div>
              </div>
            </div>
          )}
          {classificationTestStatus === "error" && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-600 rounded-lg text-red-300 text-sm">
              <span>❌</span>{" "}
              {classificationError || "Erreur lors de la classification"}
            </div>
          )}
        </div>
      </section>

      {/* Section Géocodage */}
      <section className="mb-8 p-6 bg-gray-800/50 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🗺️</span> Géocodage
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-3">
              Provider de géocodage
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              {(["nominatim", "google", "mapbox"] as GeocodingProvider[]).map(
                (provider) => (
                  <label
                    key={provider}
                    className={`flex items-center gap-2 px-4 py-3 rounded-md border cursor-pointer transition-colors ${
                      settings.geocodingProvider === provider
                        ? "bg-indigo-600/20 border-indigo-500 text-white"
                        : "bg-gray-900 border-gray-600 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    <input
                      type="radio"
                      name="geocoding-provider"
                      value={provider}
                      checked={settings.geocodingProvider === provider}
                      onChange={() => handleProviderChange(provider)}
                      className="sr-only"
                    />
                    <span className="capitalize">{provider}</span>
                    {provider === "nominatim" && (
                      <span className="text-xs text-gray-500">(gratuit)</span>
                    )}
                  </label>
                )
              )}
            </div>
          </div>

          {settings.geocodingProvider === "google" && (
            <div>
              <label
                htmlFor="google-key"
                className="block text-sm text-gray-400 mb-2"
              >
                Clé API Google Maps
              </label>
              <div className="flex gap-2">
                <input
                  id="google-key"
                  type="password"
                  value={localGoogleKey}
                  onChange={(e) => setLocalGoogleKey(e.target.value)}
                  placeholder="AIza..."
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSaveGeocodingKeys}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white rounded-md transition-colors"
                >
                  Sauvegarder
                </button>
              </div>
            </div>
          )}

          {settings.geocodingProvider === "mapbox" && (
            <div>
              <label
                htmlFor="mapbox-key"
                className="block text-sm text-gray-400 mb-2"
              >
                Clé API Mapbox
              </label>
              <div className="flex gap-2">
                <input
                  id="mapbox-key"
                  type="password"
                  value={localMapboxKey}
                  onChange={(e) => setLocalMapboxKey(e.target.value)}
                  placeholder="pk...."
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSaveGeocodingKeys}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white rounded-md transition-colors"
                >
                  Sauvegarder
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Nominatim (OpenStreetMap) est gratuit mais limité à 1
            requête/seconde. Google et Mapbox offrent de meilleures
            performances.
          </p>
        </div>
      </section>

      {/* Section Test de géocodage */}
      <section className="mb-8 p-6 bg-gray-800/50 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>📍</span> Test de géocodage
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Testez la conversion d'adresse en coordonnées GPS. Les résultats sont
          mis en cache pour éviter les appels répétés.
        </p>

        <div className="space-y-4">
          {/* Statistiques du cache */}
          {geocacheStats && (
            <div className="flex flex-wrap gap-4 p-3 bg-gray-900/50 rounded-lg">
              <div className="text-sm">
                <span className="text-gray-500">Cache :</span>{" "}
                <span className="text-white font-mono">
                  {geocacheStats.total}
                </span>{" "}
                <span className="text-gray-500">entrées</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Avec GPS :</span>{" "}
                <span className="text-green-400 font-mono">
                  {geocacheStats.withCoords}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Sans GPS :</span>{" "}
                <span className="text-yellow-400 font-mono">
                  {geocacheStats.withoutCoords}
                </span>
              </div>
            </div>
          )}

          {/* Champ adresse */}
          <div>
            <label
              htmlFor="geocoding-test-address"
              className="block text-sm text-gray-400 mb-2"
            >
              Adresse à géocoder
            </label>
            <input
              id="geocoding-test-address"
              type="text"
              value={geocodingTestAddress}
              onChange={(e) => setGeocodingTestAddress(e.target.value)}
              placeholder="Ex: ORSYS La Défense, Paris"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Boutons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTestGeocodage}
              disabled={
                geocodingTestStatus === "testing" ||
                !geocodingTestAddress.trim()
              }
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded-md transition-colors"
            >
              {geocodingTestStatus === "testing" ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Géocodage...
                </span>
              ) : (
                "🔍 Tester le géocodage"
              )}
            </button>
            <button
              onClick={handlePreloadKnownLocations}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-sm"
            >
              📥 Précharger adresses ORSYS
            </button>
            <button
              onClick={handleClearGeocache}
              disabled={!geocacheStats || geocacheStats.total === 0}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-md transition-colors text-sm"
            >
              🗑️ Vider le cache
            </button>
          </div>

          {/* Résultat du test */}
          {geocodingTestStatus === "success" && geocodingTestResult && (
            <div className="mt-4 p-4 bg-green-900/20 border border-green-600 rounded-lg">
              <h3 className="text-sm font-semibold text-green-400 mb-3">
                ✅ Géocodage réussi
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 p-3 rounded">
                  <p className="text-xs text-gray-500 mb-1">Latitude</p>
                  <p className="text-white font-mono text-sm">
                    {geocodingTestResult.gps
                      ? geocodingTestResult.gps.lat.toFixed(6)
                      : "—"}
                  </p>
                </div>
                <div className="bg-gray-900/50 p-3 rounded">
                  <p className="text-xs text-gray-500 mb-1">Longitude</p>
                  <p className="text-white font-mono text-sm">
                    {geocodingTestResult.gps
                      ? geocodingTestResult.gps.lng.toFixed(6)
                      : "—"}
                  </p>
                </div>
                <div className="bg-gray-900/50 p-3 rounded">
                  <p className="text-xs text-gray-500 mb-1">Source</p>
                  <p
                    className={`font-mono text-sm ${geocodingTestResult.fromCache ? "text-cyan-400" : "text-orange-400"}`}
                  >
                    {geocodingTestResult.fromCache ? "Cache" : "API"}
                  </p>
                </div>
                <div className="bg-gray-900/50 p-3 rounded">
                  <p className="text-xs text-gray-500 mb-1">Durée</p>
                  <p className="text-white font-mono text-sm">
                    {geocodingTestResult.duration} ms
                  </p>
                </div>
              </div>
              {!geocodingTestResult.gps && (
                <p className="mt-3 text-sm text-yellow-400">
                  ⚠ Aucune coordonnée trouvée pour cette adresse.
                </p>
              )}
            </div>
          )}
          {geocodingTestStatus === "error" && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-600 rounded-lg text-red-300 text-sm">
              <span>❌</span> {geocodingTestError || "Erreur lors du géocodage"}
            </div>
          )}
        </div>
      </section>

      {/* Section Gmail */}
      <section className="mb-8 p-6 bg-gray-800/50 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>📧</span> Connexion Gmail
        </h2>
        <div className="space-y-4">
          {/* Client ID Google */}
          <div>
            <label
              htmlFor="google-client-id"
              className="block text-sm text-gray-400 mb-2"
            >
              Client ID Google OAuth
            </label>
            <div className="flex gap-2">
              <input
                id="google-client-id"
                type="text"
                value={localGoogleClientId}
                onChange={(e) => setLocalGoogleClientId(e.target.value)}
                placeholder="xxxx.apps.googleusercontent.com"
                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleSaveGoogleClientId}
                disabled={saving || !localGoogleClientId.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white rounded-md transition-colors"
              >
                Sauvegarder
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Créez un projet sur{" "}
              <a
                href="https://console.cloud.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                Google Cloud Console
              </a>{" "}
              et activez l'API Gmail.
            </p>
          </div>

          {/* État de connexion et bouton */}
          <div className="pt-4 border-t border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-sm">
                Statut :{" "}
                {connectionState.status === "connected" ? (
                  <span className="text-green-400">✓ Connecté</span>
                ) : connectionState.status === "loading" || gmailLoading ? (
                  <span className="text-yellow-400">
                    ⏳ Connexion en cours...
                  </span>
                ) : connectionState.status === "error" ? (
                  <span className="text-red-400">✗ Erreur</span>
                ) : (
                  <span className="text-gray-400">Non connecté</span>
                )}
              </div>

              {connectionState.status === "connected" ? (
                <button
                  onClick={disconnect}
                  disabled={gmailLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-md transition-colors"
                >
                  {gmailLoading ? "..." : "Se déconnecter"}
                </button>
              ) : (
                <button
                  onClick={connect}
                  disabled={gmailLoading || !clientId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-md transition-colors flex items-center gap-2"
                >
                  {gmailLoading ? (
                    "Connexion..."
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Se connecter avec Gmail
                    </>
                  )}
                </button>
              )}
            </div>

            {gmailError && (
              <div className="mt-3 p-3 bg-red-900/30 border border-red-600 rounded text-red-300 text-sm">
                {gmailError}
              </div>
            )}

            {!clientId && (
              <p className="mt-3 text-xs text-yellow-400">
                ⚠ Configurez d'abord votre Client ID Google ci-dessus.
              </p>
            )}

            {connectionState.tokenExpiry && (
              <p className="mt-2 text-xs text-gray-500">
                Token expire le :{" "}
                {new Date(connectionState.tokenExpiry).toLocaleString("fr-FR")}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Section Données */}
      <section className="p-6 bg-gray-800/50 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>💾</span> Données locales
        </h2>
        <p className="text-sm text-gray-400">
          Les fonctionnalités de gestion des données (export, import, purge)
          seront disponibles dans une prochaine version.
        </p>
      </section>
    </div>
  );
}
