import { useEffect, useMemo, useState } from "react";
import { db } from "../../stores/db";
import { getEmailsPage } from "../../stores/emailsStore";
import type { EmailRaw } from "../../types";
import type { LLMCacheEntry } from "../../stores/llmCacheStore";

const ITEMS_PER_PAGE = 20;

function formatDateTime(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleString("fr-FR");
  } catch {
    return isoDate;
  }
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

function Pagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange
}: PaginationProps) {
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);

    if (currentPage <= 3) {
      endPage = Math.min(maxVisiblePages, totalPages - 1);
    } else if (currentPage >= totalPages - 2) {
      startPage = Math.max(2, totalPages - maxVisiblePages + 1);
    }

    if (startPage > 2) pages.push("...");
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    if (endPage < totalPages - 1) pages.push("...");

    pages.push(totalPages);

    return pages;
  }, [currentPage, totalPages]);

  if (totalPages <= 1) {
    return (
      <div className="text-sm text-gray-400">
        {totalItems > 0
          ? `${totalItems} email${totalItems > 1 ? "s" : ""}`
          : "Aucun email"}
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="text-sm text-gray-400">
        Affichage {startItem}-{endItem} sur {totalItems}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="btn px-3 py-1.5 rounded bg-gray-700 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
        >
          ◀
        </button>

        {pageNumbers.map((p, idx) =>
          typeof p === "string" ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-gray-500">
              {p}
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`btn px-3 py-1.5 rounded transition-colors ${
                currentPage === p
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="btn px-3 py-1.5 rounded bg-gray-700 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
        >
          ▶
        </button>
      </div>
    </div>
  );
}

function renderJson(value: unknown): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function MailsBrutsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [emails, setEmails] = useState<EmailRaw[]>([]);
  const [analysisByEmailId, setAnalysisByEmailId] = useState<
    Map<string, LLMCacheEntry | undefined>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const page = await getEmailsPage(currentPage, ITEMS_PER_PAGE);
        if (cancelled) return;

        setTotalItems(page.totalItems);
        setEmails(page.items);

        const emailIds = page.items.map((e) => e.id);
        const cacheEntries = await db.llmCache.bulkGet(emailIds);
        if (cancelled) return;

        const map = new Map<string, LLMCacheEntry | undefined>();
        for (const entry of cacheEntries) {
          if (entry) map.set(entry.emailId, entry);
        }
        setAnalysisByEmailId(map);
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
  }, [currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="text-left space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Mails bruts</h1>
        <p className="text-gray-400">
          Liste des emails en cache et analyse associée (classification +
          extraction)
        </p>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-300">
          <p className="font-semibold">Erreur de chargement</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="bg-gray-800 rounded-lg p-4 h-20 animate-pulse" />
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-800 rounded-lg p-4 h-28 animate-pulse"
            />
          ))}
        </div>
      ) : totalItems === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
          Aucun email en base. Lancez une extraction depuis le dashboard.
        </div>
      ) : (
        <>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
          />

          <div className="space-y-3">
            {emails.map((email) => {
              const analysis = analysisByEmailId.get(email.id);
              const classificationType =
                analysis?.classification?.type || email.type || null;

              return (
                <details
                  key={email.id}
                  className="bg-gray-900/30 rounded-lg border border-gray-700"
                >
                  <summary className="cursor-pointer select-none px-4 py-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {email.subject || "(Sans sujet)"}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {email.from} • {formatDateTime(email.date)} • id:{" "}
                          {email.id}
                        </div>
                        {classificationType && (
                          <div className="text-xs text-gray-500 mt-1">
                            Type: {classificationType}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        Cliquer pour afficher
                      </div>
                    </div>
                  </summary>

                  <div className="px-4 pb-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-white mb-2">
                        Email brut
                      </div>
                      <pre className="whitespace-pre-wrap text-xs text-gray-200 bg-black/30 p-3 rounded border border-gray-700 overflow-x-auto">
                        {`From: ${email.from}\nSubject: ${email.subject}\nDate: ${email.date}\nThreadId: ${email.threadId}\nProcessed: ${email.processed}\nType (EmailRaw): ${email.type ?? "(non défini)"}\n\n${email.body}`}
                      </pre>

                      {email.bodyHtml && (
                        <pre className="whitespace-pre-wrap text-xs text-gray-200 bg-black/30 p-3 rounded border border-gray-700 overflow-x-auto mt-3">
                          {email.bodyHtml}
                        </pre>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-white mb-2">
                        Analyse
                      </div>
                      {analysis ? (
                        <pre className="whitespace-pre-wrap text-xs text-gray-200 bg-black/30 p-3 rounded border border-gray-700 overflow-x-auto">
                          {renderJson({
                            emailId: analysis.emailId,
                            cachedAt: analysis.cachedAt,
                            modelVersion: analysis.modelVersion,
                            classification: analysis.classification,
                            extraction: analysis.extraction
                          })}
                        </pre>
                      ) : (
                        <div className="text-sm text-gray-400">
                          Aucune analyse disponible pour cet email (cache LLM
                          manquant).
                        </div>
                      )}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
}
