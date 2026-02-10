/**
 * Store utilitaire pour consulter les emails bruts (IndexedDB)
 * Inclut pagination pour éviter de charger ~7000 emails d'un coup.
 */

import { db } from "./db";
import type { EmailRaw } from "../types";

export interface EmailsPage {
  items: EmailRaw[];
  totalItems: number;
}

export async function countEmails(): Promise<number> {
  return await db.emails.count();
}

/**
 * Retourne une page d'emails triés par date décroissante.
 * @param page 1-based
 */
export async function getEmailsPage(
  page: number,
  pageSize: number
): Promise<EmailsPage> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const safePage = Math.max(1, Math.floor(page));
  const offset = (safePage - 1) * safePageSize;

  const [totalItems, items] = await Promise.all([
    db.emails.count(),
    db.emails
      .orderBy("date")
      .reverse()
      .offset(offset)
      .limit(safePageSize)
      .toArray()
  ]);

  return { totalItems, items };
}
