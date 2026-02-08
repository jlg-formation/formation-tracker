# 07 - Export des données

## Vue d'ensemble

L'application permet d'exporter les données des formations dans 3 formats :

| Format   | Usage                                  | Librairie               |
| -------- | -------------------------------------- | ----------------------- |
| **JSON** | Sauvegarde, réimport, interopérabilité | Natif                   |
| **CSV**  | Tableurs (Excel, Google Sheets)        | Natif                   |
| **PDF**  | Rapport imprimable                     | jsPDF + jspdf-autotable |

---

## Export JSON

### Structure de sortie

```json
{
  "metadata": {
    "dateExtraction": "2026-02-08T10:30:00Z",
    "totalFormations": 156,
    "formationsAnnulees": 12,
    "emailsTraites": 1247,
    "version": "1.0.0"
  },
  "formations": [
    {
      "id": "1707385800000-abc123",
      "titre": "L'intelligence artificielle au service des développeurs",
      "codeFormation": "GIA",
      "codeEtendu": "GIAPA1",
      "statut": "confirmée",
      "dateDebut": "2026-02-04",
      "dateFin": "2026-02-06",
      "dates": ["2026-02-04", "2026-02-05", "2026-02-06"],
      "nombreJours": 3,
      "lieu": {
        "nom": "ORSYS Paris La Défense",
        "adresse": "Paroi Nord Grande Arche, 1 parvis de la Défense, 92044 Paris La Défense",
        "gps": { "lat": 48.8925, "lng": 2.2356 }
      },
      "typeSession": "inter",
      "niveauPersonnalisation": "standard",
      "nombreParticipants": 5,
      "participants": [
        { "nom": "ALVES Lionel", "email": "lionel.alves@wam-ingenierie.fr" }
      ],
      "motDePasseDocadmin": "6d3nSFCYT",
      "facturation": {
        "entite": "ORSYS"
      },
      "emailIds": ["msg123", "msg456"],
      "createdAt": "2026-02-08T10:30:00Z",
      "updatedAt": "2026-02-08T10:30:00Z"
    }
  ]
}
```

### Implémentation

```typescript
// project/src/services/export/json.ts

import { ExportData, Formation } from "../../types";
import { db } from "../../stores/db";

export async function exportToJson(
  formations: Formation[],
  filename = "orsys-formations.json"
): Promise<void> {
  const annulees = formations.filter((f) => f.statut === "annulée").length;

  const exportData: ExportData = {
    metadata: {
      dateExtraction: new Date().toISOString(),
      totalFormations: formations.length,
      formationsAnnulees: annulees,
      emailsTraites: await db.emails.count(),
      version: "1.0.0"
    },
    formations
  };

  const json = JSON.stringify(exportData, null, 2);
  downloadFile(json, filename, "application/json");
}

function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
```

---

## Export CSV

### Structure

```csv
ID,Code,Titre,Statut,Date Debut,Date Fin,Jours,Lieu,Adresse,Type,Niveau,Participants,Client,Entite Facturation
1707385800000-abc123,GIAPA1,L'intelligence artificielle...,confirmée,2026-02-04,2026-02-06,3,ORSYS Paris La Défense,"Paroi Nord...",inter,standard,5,,ORSYS
```

### Implémentation

```typescript
// project/src/services/export/csv.ts

import { Formation } from "../../types";

const CSV_HEADERS = [
  "ID",
  "Code",
  "Titre",
  "Statut",
  "Date Debut",
  "Date Fin",
  "Jours",
  "Lieu",
  "Adresse",
  "Latitude",
  "Longitude",
  "Type",
  "Niveau",
  "Participants",
  "Client",
  "Entite Facturation",
  "Reference Intra"
];

export function exportToCsv(
  formations: Formation[],
  filename = "orsys-formations.csv"
): void {
  const rows = formations.map((f) => [
    f.id,
    f.codeEtendu,
    escapeCsv(f.titre),
    f.statut,
    f.dateDebut,
    f.dateFin,
    f.nombreJours,
    escapeCsv(f.lieu.nom),
    escapeCsv(f.lieu.adresse),
    f.lieu.gps?.lat ?? "",
    f.lieu.gps?.lng ?? "",
    f.typeSession,
    f.niveauPersonnalisation,
    f.nombreParticipants,
    escapeCsv(f.client ?? ""),
    f.facturation?.entite ?? "",
    f.facturation?.referenceIntra ?? ""
  ]);

  const csvContent = [
    CSV_HEADERS.join(","),
    ...rows.map((row) => row.join(","))
  ].join("\n");

  // BOM pour Excel (encodage UTF-8)
  const bom = "\uFEFF";
  downloadFile(bom + csvContent, filename, "text/csv;charset=utf-8");
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

---

## Export PDF

### Aperçu du rapport

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    ORSYS Training Tracker                                   │
│                    ═══════════════════════                                  │
│                                                                             │
│  Rapport généré le 08/02/2026                                              │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  RÉSUMÉ                                                                │ │
│  │  ───────                                                               │ │
│  │  • Total formations : 156                                              │ │
│  │  • Formations annulées : 12                                            │ │
│  │  • Total jours : 342                                                   │ │
│  │  • Total participants : 1,847                                          │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  LISTE DES FORMATIONS                                                       │
│  ─────────────────────                                                      │
│                                                                             │
│  ┌────────┬────────────────────────────┬─────────────┬────────┬──────────┐ │
│  │ Code   │ Titre                      │ Dates       │ Lieu   │ Type     │ │
│  ├────────┼────────────────────────────┼─────────────┼────────┼──────────┤ │
│  │ GIAPA1 │ L'IA au service des dév... │ 04-06/02/26 │ Paris  │ Inter    │ │
│  │ BOA    │ Architecture logicielle    │ 10-12/02/26 │ Lyon   │ Inter    │ │
│  │ XXXZZ3 │ Cybersécurité et IA...     │ 21-29/01/26 │ Amiens │ Intra    │ │
│  │ ...    │ ...                        │ ...         │ ...    │ ...      │ │
│  └────────┴────────────────────────────┴─────────────┴────────┴──────────┘ │
│                                                                             │
│                                                            Page 1 / 8      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implémentation

```typescript
// project/src/services/export/pdf.ts

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Formation, FormationStats } from "../../types";

export function exportToPdf(
  formations: Formation[],
  stats: FormationStats,
  filename = "orsys-formations.pdf"
): void {
  const doc = new jsPDF();

  // Titre
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("ORSYS Training Tracker", 105, 20, { align: "center" });

  // Date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Rapport généré le ${formatDate(new Date())}`, 105, 28, {
    align: "center"
  });

  // Résumé
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Résumé", 14, 45);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`• Total formations : ${stats.total}`, 20, 55);
  doc.text(`• Formations annulées : ${stats.annulees}`, 20, 62);
  doc.text(`• Total jours : ${stats.totalJours}`, 20, 69);
  doc.text(`• Total participants : ${stats.totalParticipants}`, 20, 76);

  // Tableau des formations
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Liste des formations", 14, 95);

  const tableData = formations
    .filter((f) => f.statut === "confirmée")
    .map((f) => [
      f.codeEtendu,
      truncate(f.titre, 35),
      formatDateRange(f.dateDebut, f.dateFin),
      truncate(f.lieu.nom, 15),
      f.typeSession === "inter" ? "Inter" : "Intra",
      f.nombreParticipants.toString()
    ]);

  autoTable(doc, {
    startY: 100,
    head: [["Code", "Titre", "Dates", "Lieu", "Type", "Part."]],
    body: tableData,
    headStyles: {
      fillColor: [0, 102, 204], // Bleu ORSYS
      textColor: 255,
      fontStyle: "bold"
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 55 },
      2: { cellWidth: 30 },
      3: { cellWidth: 30 },
      4: { cellWidth: 15 },
      5: { cellWidth: 15 }
    }
  });

  // Numéros de page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.text(
      `Page ${i} / ${pageCount}`,
      doc.internal.pageSize.width - 20,
      doc.internal.pageSize.height - 10
    );
  }

  doc.save(filename);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const startStr = s.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit"
  });
  const endStr = e.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  });
  return `${startStr}-${endStr}`;
}

function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? str.substring(0, maxLength - 3) + "..." : str;
}
```

---

## Dépendances npm

```json
{
  "dependencies": {
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.1"
  }
}
```

Installation :

```bash
bun add jspdf jspdf-autotable
```

---

## Import de données

### Réimporter un fichier JSON

```typescript
// project/src/services/export/import.ts

import { ExportData, Formation } from "../../types";
import { db } from "../../stores/db";

export async function importFromJson(file: File): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const text = await file.text();
  const data: ExportData = JSON.parse(text);

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const formation of data.formations) {
    try {
      // Vérifier si déjà existant
      const existing = await db.formations.get(formation.id);

      if (existing) {
        skipped++;
        continue;
      }

      // Valider les champs requis
      if (!formation.codeEtendu || !formation.dateDebut) {
        errors.push(`Formation ${formation.id} : champs requis manquants`);
        continue;
      }

      await db.formations.put(formation);
      imported++;
    } catch (error) {
      errors.push(`Formation ${formation.id} : ${error}`);
    }
  }

  return { imported, skipped, errors };
}
```

---

## Options d'export dans l'UI

```typescript
interface ExportOptions {
  /** Inclure les formations annulées */
  includeAnnulees: boolean;
  /** Filtrer par période */
  dateRange?: { start: string; end: string };
  /** Filtrer par type */
  typeSession?: "inter" | "intra";
  /** Format de sortie */
  format: "json" | "csv" | "pdf";
}
```
