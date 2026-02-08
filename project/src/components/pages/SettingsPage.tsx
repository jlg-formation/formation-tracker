import { useState } from "react";
import { useSettings } from "../../hooks/useSettings";

type GeocodingProvider = "nominatim" | "google" | "mapbox";

export function SettingsPage() {
  const { settings, loading, saving, error, updateSettings } = useSettings();
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [localOpenAIKey, setLocalOpenAIKey] = useState("");
  const [localGoogleKey, setLocalGoogleKey] = useState("");
  const [localMapboxKey, setLocalMapboxKey] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Synchroniser les valeurs locales au chargement
  useState(() => {
    if (!loading) {
      setLocalOpenAIKey(settings.openaiApiKey || "");
      setLocalGoogleKey(settings.googleApiKey || "");
      setLocalMapboxKey(settings.mapboxApiKey || "");
    }
  });

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
          <div className="text-sm">
            Statut :{" "}
            {settings.gmailToken ? (
              <span className="text-green-400">✓ Connecté</span>
            ) : (
              <span className="text-gray-400">Non connecté</span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            La connexion Gmail sera gérée depuis le panneau d'extraction.
          </p>
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
