/**
 * Export PDF service
 * Génère un rapport PDF des formations avec jsPDF et autotable
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Formation } from "../../types";
import type { FormationStats } from "../../utils/stats";
import { formatDateFr, formatDateRange, truncate } from "./utils";

// Couleur ORSYS (bleu)
const ORSYS_BLUE: [number, number, number] = [0, 102, 204];
const GRAY_LIGHT: [number, number, number] = [245, 245, 245];

/**
 * Génère le PDF et le télécharge
 */
export function exportToPdf(
  formations: Formation[],
  stats: FormationStats,
  filename = "orsys-formations.pdf"
): void {
  const doc = new jsPDF();

  // Titre principal
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("ORSYS Training Tracker", 105, 20, { align: "center" });

  // Date de génération
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Rapport généré le ${formatDateFr(new Date())}`, 105, 28, {
    align: "center"
  });

  // Ligne de séparation
  doc.setDrawColor(0, 102, 204);
  doc.setLineWidth(0.5);
  doc.line(14, 35, 196, 35);

  // Section Résumé
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Résumé", 14, 47);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const summaryItems = [
    `• Total formations : ${stats.total}`,
    `• Formations annulées : ${stats.annulees}`,
    `• Total jours : ${stats.totalJours}`,
    `• Total participants : ${stats.totalParticipants}`,
    `• Inter-entreprises : ${stats.inter}`,
    `• Intra-entreprises : ${stats.intra}`
  ];

  let yPos = 57;
  for (const item of summaryItems) {
    doc.text(item, 20, yPos);
    yPos += 7;
  }

  // Section Liste des formations
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Liste des formations", 14, yPos + 10);

  // Préparation des données du tableau
  const confirmedFormations = formations.filter(
    (f) => f.statut === "confirmée"
  );
  const tableData = confirmedFormations.map((f) => [
    f.codeEtendu || "",
    truncate(f.titre, 35),
    formatDateRange(f.dateDebut, f.dateFin),
    truncate(f.lieu?.nom || "", 18),
    f.typeSession === "inter" ? "Inter" : "Intra",
    String(f.nombreParticipants || 0)
  ]);

  // Génération du tableau
  autoTable(doc, {
    startY: yPos + 15,
    head: [["Code", "Titre", "Dates", "Lieu", "Type", "Part."]],
    body: tableData,
    headStyles: {
      fillColor: ORSYS_BLUE,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9
    },
    alternateRowStyles: {
      fillColor: GRAY_LIGHT
    },
    styles: {
      fontSize: 8,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 58 },
      2: { cellWidth: 28 },
      3: { cellWidth: 35 },
      4: { cellWidth: 18 },
      5: { cellWidth: 15 }
    },
    didDrawPage: (data) => {
      // Pied de page avec numéro de page
      const pageCount = doc.getNumberOfPages();
      const currentPage = data.pageNumber;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Page ${currentPage} / ${pageCount}`,
        doc.internal.pageSize.width - 25,
        doc.internal.pageSize.height - 10
      );
    }
  });

  // Ajout des formations annulées si présentes
  const cancelledFormations = formations.filter((f) => f.statut === "annulée");
  if (cancelledFormations.length > 0) {
    // Nouvelle page si nécessaire
    // @ts-expect-error - autoTable adds lastAutoTable property
    const lastTableEnd = doc.lastAutoTable?.finalY || 200;
    if (lastTableEnd > 220) {
      doc.addPage();
    }

    const startY = lastTableEnd > 220 ? 20 : lastTableEnd + 15;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 0, 0);
    doc.text(`Formations annulées (${cancelledFormations.length})`, 14, startY);
    doc.setTextColor(0, 0, 0);

    const cancelledData = cancelledFormations.map((f) => [
      f.codeEtendu || "",
      truncate(f.titre, 35),
      formatDateRange(f.dateDebut, f.dateFin),
      truncate(f.lieu?.nom || "", 18)
    ]);

    autoTable(doc, {
      startY: startY + 5,
      head: [["Code", "Titre", "Dates", "Lieu"]],
      body: cancelledData,
      headStyles: {
        fillColor: [180, 0, 0],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [255, 240, 240]
      },
      styles: {
        fontSize: 8,
        cellPadding: 3
      }
    });
  }

  // Mettre à jour les numéros de page pour toutes les pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Page ${i} / ${pageCount}`,
      doc.internal.pageSize.width - 25,
      doc.internal.pageSize.height - 10
    );
  }

  // Téléchargement
  doc.save(filename);
}

/**
 * Génère le PDF en mémoire (pour tests ou prévisualisation)
 */
export function generatePdfBlob(
  formations: Formation[],
  stats: FormationStats
): Blob {
  const doc = new jsPDF();

  // Même contenu que exportToPdf mais retourne un Blob
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("ORSYS Training Tracker", 105, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Rapport généré le ${formatDateFr(new Date())}`, 105, 28, {
    align: "center"
  });

  // Résumé simplifié pour le blob
  doc.setFontSize(11);
  doc.text(`Total: ${stats.total} formations`, 20, 50);

  const tableData = formations
    .slice(0, 50)
    .map((f) => [
      f.codeEtendu || "",
      truncate(f.titre, 30),
      f.dateDebut,
      f.typeSession === "inter" ? "Inter" : "Intra"
    ]);

  autoTable(doc, {
    startY: 60,
    head: [["Code", "Titre", "Date", "Type"]],
    body: tableData,
    headStyles: {
      fillColor: ORSYS_BLUE,
      textColor: 255
    }
  });

  return doc.output("blob");
}
