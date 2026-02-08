/**
 * Composant TypePieChart - Camembert Inter/Intra
 */

import { useCallback, useEffect, useRef } from "react";
import * as d3 from "d3";

interface TypePieChartProps {
  /** Nombre de formations inter */
  inter: number;
  /** Nombre de formations intra */
  intra: number;
  /** Taille du graphique (diamètre) */
  size?: number;
}

interface PieData {
  label: string;
  value: number;
  color: string;
}

/**
 * Camembert D3.js affichant la répartition Inter/Intra
 */
export function TypePieChart({ inter, intra, size = 280 }: TypePieChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const drawChart = useCallback(() => {
    if (!svgRef.current) return;

    // Nettoyer le SVG
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const total = inter + intra;
    if (total === 0) return;

    // Dimensions
    const margin = 10;
    const radius = size / 2 - margin;

    // Données
    const data: PieData[] = [
      { label: "Inter", value: inter, color: "#3b82f6" },
      { label: "Intra", value: intra, color: "#a855f7" }
    ].filter((d) => d.value > 0);

    // Groupe principal centré
    const g = svg
      .attr("width", size)
      .attr("height", size)
      .append("g")
      .attr("transform", `translate(${size / 2},${size / 2})`);

    // Générateur de pie
    const pie = d3
      .pie<PieData>()
      .value((d) => d.value)
      .sort(null)
      .padAngle(0.02);

    // Générateur d'arc
    const arc = d3
      .arc<d3.PieArcDatum<PieData>>()
      .innerRadius(radius * 0.5) // Donut
      .outerRadius(radius);

    // Arc pour les labels
    const labelArc = d3
      .arc<d3.PieArcDatum<PieData>>()
      .innerRadius(radius * 0.75)
      .outerRadius(radius * 0.75);

    // Arcs
    const arcs = g
      .selectAll(".arc")
      .data(pie(data))
      .enter()
      .append("g")
      .attr("class", "arc");

    // Dessiner les portions avec animation
    arcs
      .append("path")
      .attr("fill", (d) => d.data.color)
      .attr("stroke", "#1f2937")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .transition()
      .duration(800)
      .attrTween("d", function (d) {
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return (t) => arc(interpolate(t)) || "";
      });

    // Labels de pourcentage
    arcs
      .append("text")
      .attr("transform", (d) => `translate(${labelArc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .style("fill", "white")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("opacity", 0)
      .text((d) => `${Math.round((d.data.value / total) * 100)}%`)
      .transition()
      .duration(400)
      .delay(600)
      .style("opacity", 1);

    // Texte central - Total
    const centerGroup = g.append("g").attr("class", "center-text");

    centerGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.3em")
      .style("fill", "#e5e7eb")
      .style("font-size", "28px")
      .style("font-weight", "bold")
      .text(total);

    centerGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em")
      .style("fill", "#9ca3af")
      .style("font-size", "12px")
      .text("formations");

    // Tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "d3-tooltip-pie")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", "rgba(17, 24, 39, 0.95)")
      .style("border", "1px solid #4b5563")
      .style("border-radius", "6px")
      .style("padding", "8px 12px")
      .style("font-size", "13px")
      .style("color", "white")
      .style("pointer-events", "none")
      .style("z-index", "1000");

    // Événements sur les paths (après animation)
    setTimeout(() => {
      arcs
        .selectAll("path")
        .on("mouseover", function (_event, d) {
          const pieData = d as d3.PieArcDatum<PieData>;
          d3.select(this)
            .transition()
            .duration(200)
            .attr("transform", function () {
              const [x, y] = arc.centroid(pieData);
              return `translate(${x * 0.1},${y * 0.1})`;
            });
          tooltip.style("visibility", "visible").html(
            `<strong style="color: ${pieData.data.color}">${pieData.data.label}</strong><br/>
             ${pieData.data.value} formation${pieData.data.value > 1 ? "s" : ""}<br/>
             <span style="color: #9ca3af">${Math.round((pieData.data.value / total) * 100)}% du total</span>`
          );
        })
        .on("mousemove", function (event) {
          tooltip
            .style("top", event.pageY - 10 + "px")
            .style("left", event.pageX + 10 + "px");
        })
        .on("mouseout", function () {
          d3.select(this)
            .transition()
            .duration(200)
            .attr("transform", "translate(0,0)");
          tooltip.style("visibility", "hidden");
        });
    }, 850);

    // Cleanup tooltip on unmount
    return () => {
      tooltip.remove();
    };
  }, [inter, intra, size]);

  useEffect(() => {
    drawChart();

    return () => {
      // Nettoyer les tooltips
      d3.selectAll(".d3-tooltip-pie").remove();
    };
  }, [drawChart]);

  const total = inter + intra;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Aucune donnée à afficher
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <svg ref={svgRef} />

      {/* Légende */}
      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-500"></div>
          <span className="text-gray-300">
            Inter <span className="text-gray-500">({inter})</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-500"></div>
          <span className="text-gray-300">
            Intra <span className="text-gray-500">({intra})</span>
          </span>
        </div>
      </div>
    </div>
  );
}
