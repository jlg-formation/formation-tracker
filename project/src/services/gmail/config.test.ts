/**
 * Tests pour la configuration Gmail et le filtrage des emails
 * Clarification 010 : filtrage à la source via la query Gmail (q)
 */

import { describe, it, expect } from "vitest";
import { buildGmailQuery, EXCLUDED_SUBJECT_CONTAINS } from "./config";

describe("buildGmailQuery (clarification 010)", () => {
  it("doit inclure la base query ORSYS", () => {
    const q = buildGmailQuery();
    expect(q).toContain("from:orsys.fr");
    expect(q).toContain("after:2014/01/01");
  });

  it('doit exclure les sujets configurés via -subject":..."', () => {
    const q = buildGmailQuery();
    for (const term of EXCLUDED_SUBJECT_CONTAINS) {
      expect(q).toContain(`-subject:"${term}"`);
    }
  });

  it("doit appliquer afterDate tout en conservant les exclusions", () => {
    const q = buildGmailQuery("2026/01/01");
    expect(q).toContain("after:2026/01/01");
    for (const term of EXCLUDED_SUBJECT_CONTAINS) {
      expect(q).toContain(`-subject:"${term}"`);
    }
  });
});
