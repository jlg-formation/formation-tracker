import { useState, useEffect } from "react";
import { useSettings } from "../../hooks/useSettings";
import { useGmailAuth } from "../../hooks/useGmailAuth";

type GeocodingProvider = "nominatim" | "google" | "mapbox";

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
          <div className="text-sm">
            Statut :{" "}
            {settings.openaiApiKey ? (
              <span className="text-green-400">✓ Configurée</span>
            ) : (
              <span className="text-yellow-400">⚠ Non configurée</span>
            )}
          </div>
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
