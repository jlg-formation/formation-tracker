import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../../stores/db";
import type { EmailRaw } from "../../types";
import type { LLMCacheEntry } from "../../stores/llmCacheStore";

function formatDateTime(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleString("fr-FR");
  } catch {
    return isoDate;
  }
}

function renderJson(value: unknown): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function MailDetailPage() {
  const { emailId } = useParams<{ emailId: string }>();
  const [email, setEmail] = useState<EmailRaw | null>(null);
  const [analysis, setAnalysis] = useState<LLMCacheEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      if (!emailId) {
        setError("Identifiant d'email manquant");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [emailData, analysisData] = await Promise.all([
          db.emails.get(emailId),
          db.llmCache.get(emailId)
        ]);

        if (cancelled) return;

        if (!emailData) {
          setError(`Email non trouvé (id: ${emailId})`);
          setLoading(false);
          return;
        }

        setEmail(emailData);
        setAnalysis(analysisData ?? null);
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Erreur inconnue";
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [emailId]);

  if (loading) {
    return (
      <div className="text-left space-y-4">
        <div className="flex items-center gap-4">
          <Link
            to="/mails"
            className="text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            ← Retour à la liste
          </Link>
        </div>
        <div className="bg-gray-800 rounded-lg p-8 h-48 animate-pulse" />
        <div className="bg-gray-800 rounded-lg p-8 h-32 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-left space-y-4">
        <div className="flex items-center gap-4">
          <Link
            to="/mails"
            className="text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            ← Retour à la liste
          </Link>
        </div>
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-300">
          <p className="font-semibold">Erreur</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!email) {
    return null;
  }

  const classificationType =
    analysis?.classification?.type || email.type || null;

  return (
    <div className="text-left space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Link
          to="/mails"
          className="text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          ← Retour à la liste
        </Link>
      </div>

      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {email.subject || "(Sans sujet)"}
        </h1>
        <div className="text-gray-400">
          <span>{email.from}</span>
          <span className="mx-2">•</span>
          <span>{formatDateTime(email.date)}</span>
          <span className="mx-2">•</span>
          <span className="text-gray-500">id: {email.id}</span>
        </div>
        {classificationType && (
          <div className="mt-2">
            <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-indigo-600/30 text-indigo-300 border border-indigo-500/50">
              {classificationType}
            </span>
          </div>
        )}
      </div>

      {/* Section Analyse */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Analyse</h2>
          <p className="text-sm text-gray-400">
            Classification et extraction par le LLM
          </p>
        </div>
        <div className="p-4">
          {analysis ? (
            <div className="space-y-4">
              {/* Classification */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2">
                  Classification
                </h3>
                <pre className="whitespace-pre-wrap text-xs text-gray-200 bg-black/30 p-3 rounded border border-gray-700 overflow-x-auto">
                  {renderJson(analysis.classification)}
                </pre>
              </div>

              {/* Extraction */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2">
                  Extraction
                </h3>
                <pre className="whitespace-pre-wrap text-xs text-gray-200 bg-black/30 p-3 rounded border border-gray-700 overflow-x-auto">
                  {renderJson(analysis.extraction)}
                </pre>
              </div>

              {/* Métadonnées */}
              <div className="text-xs text-gray-500 pt-2 border-t border-gray-700">
                <span>Modèle : {analysis.modelVersion || "N/A"}</span>
                <span className="mx-2">•</span>
                <span>
                  Mis en cache :{" "}
                  {analysis.cachedAt
                    ? formatDateTime(analysis.cachedAt)
                    : "N/A"}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 py-4 text-center">
              Aucune analyse disponible pour cet email (cache LLM manquant).
            </div>
          )}
        </div>
      </div>

      {/* Section Email brut (accordéon) */}
      <details className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
        <summary className="cursor-pointer select-none px-4 py-3 bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white inline">
                Email brut
              </h2>
              <p className="text-sm text-gray-400">
                Contenu original de l'email
              </p>
            </div>
            <span className="text-gray-400 text-sm">Cliquer pour afficher</span>
          </div>
        </summary>
        <div className="p-4 space-y-4">
          {/* Métadonnées de l'email */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
              En-têtes
            </h3>
            <pre className="whitespace-pre-wrap text-xs text-gray-200 bg-black/30 p-3 rounded border border-gray-700 overflow-x-auto">
              {`From: ${email.from}\nSubject: ${email.subject}\nDate: ${email.date}\nThreadId: ${email.threadId}\nProcessed: ${email.processed}\nType (EmailRaw): ${email.type ?? "(non défini)"}`}
            </pre>
          </div>

          {/* Corps texte */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
              Corps (texte)
            </h3>
            <pre className="whitespace-pre-wrap text-xs text-gray-200 bg-black/30 p-3 rounded border border-gray-700 overflow-x-auto max-h-96 overflow-y-auto">
              {email.body || "(vide)"}
            </pre>
          </div>

          {/* Corps HTML */}
          {email.bodyHtml && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">
                Corps (HTML)
              </h3>
              <pre className="whitespace-pre-wrap text-xs text-gray-200 bg-black/30 p-3 rounded border border-gray-700 overflow-x-auto max-h-96 overflow-y-auto">
                {email.bodyHtml}
              </pre>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
