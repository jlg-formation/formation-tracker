/**
 * Composant YearlyChart - Graphique à barres des formations par année
 */

import { useCallback, useEffect, useRef } from "react";
import * as d3 from "d3";

interface YearlyChartProps {
  /** Données par année { année: nombre } */
  data: Record<number, number>;
  /** Largeur du graphique (optionnel, auto-resize par défaut) */
  width?: number;
  /** Hauteur du graphique */
  height?: number;
}

/**
 * Graphique à barres D3.js affichant les formations par année
 */
export function YearlyChart({
  data,
  width: fixedWidth,
  height = 300
}: YearlyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const drawChart = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

    // Nettoyer le SVG
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Dimensions
    const containerWidth = fixedWidth || containerRef.current.clientWidth;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = containerWidth - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Transformer les données
    const entries = Object.entries(data)
      .map(([year, count]) => ({ year: Number(year), count }))
      .sort((a, b) => a.year - b.year);

    if (entries.length === 0) return;

    // Échelles
    const xScale = d3
      .scaleBand()
      .domain(entries.map((d) => String(d.year)))
      .range([0, chartWidth])
      .padding(0.2);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(entries, (d) => d.count) || 0])
      .nice()
      .range([chartHeight, 0]);

    // Groupe principal
    const g = svg
      .attr("width", containerWidth)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Axe X
    g.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .style("fill", "#9ca3af")
      .style("font-size", "11px")
      .attr("transform", entries.length > 8 ? "rotate(-45)" : "rotate(0)")
      .style("text-anchor", entries.length > 8 ? "end" : "middle");

    g.selectAll(".domain, .tick line").style("stroke", "#4b5563");

    // Axe Y
    g.append("g")
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format("d")))
      .selectAll("text")
      .style("fill", "#9ca3af")
      .style("font-size", "11px");

    g.selectAll(".domain, .tick line").style("stroke", "#4b5563");

    // Grille horizontale
    g.append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickSize(-chartWidth)
          .tickFormat(() => "")
      )
      .selectAll("line")
      .style("stroke", "#374151")
      .style("stroke-dasharray", "3,3");

    g.select(".grid .domain").remove();

    // Barres avec animation
    const bars = g
      .selectAll(".bar")
      .data(entries)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => xScale(String(d.year)) || 0)
      .attr("y", chartHeight)
      .attr("width", xScale.bandwidth())
      .attr("height", 0)
      .attr("fill", "#6366f1")
      .attr("rx", 4);

    // Animation d'entrée
    bars
      .transition()
      .duration(600)
      .delay((_, i) => i * 50)
      .attr("y", (d) => yScale(d.count))
      .attr("height", (d) => chartHeight - yScale(d.count));

    // Tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "d3-tooltip")
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

    bars
      .on("mouseover", function (_event, d) {
        d3.select(this).attr("fill", "#818cf8");
        tooltip
          .style("visibility", "visible")
          .html(
            `<strong>${d.year}</strong><br/>${d.count} formation${d.count > 1 ? "s" : ""}`
          );
      })
      .on("mousemove", function (event) {
        tooltip
          .style("top", event.pageY - 10 + "px")
          .style("left", event.pageX + 10 + "px");
      })
      .on("mouseout", function () {
        d3.select(this).attr("fill", "#6366f1");
        tooltip.style("visibility", "hidden");
      });

    // Label Y
    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(height / 2))
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .style("fill", "#6b7280")
      .style("font-size", "12px")
      .text("Formations");

    // Cleanup tooltip on unmount
    return () => {
      tooltip.remove();
    };
  }, [data, fixedWidth, height]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Utiliser ResizeObserver pour détecter quand le conteneur a une largeur
    const resizeObserver = new ResizeObserver(() => {
      drawChart();
    });

    resizeObserver.observe(containerRef.current);

    // Dessiner une première fois après un léger délai (pour le rendu initial)
    const timeout = setTimeout(() => {
      drawChart();
    }, 50);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeout);
      // Nettoyer les tooltips
      d3.selectAll(".d3-tooltip").remove();
    };
  }, [drawChart]);

  if (Object.keys(data).length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Aucune donnée à afficher
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
