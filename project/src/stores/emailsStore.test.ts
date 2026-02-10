import "fake-indexeddb/auto";
/**
 * Tests unitaires pour emailsStore
 */

import { describe, it, expect, beforeEach } from "vitest";

import { db, resetDatabase } from "./db";
import { getEmailsPage } from "./emailsStore";
import type { EmailRaw } from "../types";

function createEmail(overrides: Partial<EmailRaw>): EmailRaw {
  const fallbackId = `id-${Math.random().toString(16).slice(2)}`;
  return {
    id: overrides.id ?? fallbackId,
    threadId: overrides.threadId ?? "t-1",
    from: overrides.from ?? "orsys@orsys.fr",
    subject: overrides.subject ?? "Sujet",
    date: overrides.date ?? new Date().toISOString(),
    body: overrides.body ?? "Body",
    bodyHtml: overrides.bodyHtml,
    processed: overrides.processed ?? false,
    type: overrides.type,
    formationId: overrides.formationId
  };
}

describe("emailsStore", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("retourne les emails triés par date décroissante", async () => {
    await db.emails.add(
      createEmail({ id: "e1", date: "2024-01-01T10:00:00.000Z" })
    );
    await db.emails.add(
      createEmail({ id: "e2", date: "2024-01-03T10:00:00.000Z" })
    );
    await db.emails.add(
      createEmail({ id: "e3", date: "2024-01-02T10:00:00.000Z" })
    );

    const page = await getEmailsPage(1, 10);
    expect(page.totalItems).toBe(3);
    expect(page.items.map((e) => e.id)).toEqual(["e2", "e3", "e1"]);
  });

  it("applique correctement offset/limit pour la pagination", async () => {
    const base = "2024-01-01T00:00:00.000Z";
    const dates = [
      "2024-01-05T00:00:00.000Z",
      "2024-01-04T00:00:00.000Z",
      "2024-01-03T00:00:00.000Z",
      "2024-01-02T00:00:00.000Z",
      base
    ];

    for (let i = 0; i < dates.length; i++) {
      await db.emails.add(createEmail({ id: `e${i + 1}`, date: dates[i] }));
    }

    const page1 = await getEmailsPage(1, 2);
    expect(page1.totalItems).toBe(5);
    expect(page1.items.map((e) => e.id)).toEqual(["e1", "e2"]);

    const page2 = await getEmailsPage(2, 2);
    expect(page2.items.map((e) => e.id)).toEqual(["e3", "e4"]);

    const page3 = await getEmailsPage(3, 2);
    expect(page3.items.map((e) => e.id)).toEqual(["e5"]);
  });
});
