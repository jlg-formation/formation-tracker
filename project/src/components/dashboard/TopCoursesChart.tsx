/**
 * Composant TopCoursesChart - Graphique des formations les plus suivies
 */

import { useCallback, useEffect, useRef } from "react";
import * as d3 from "d3";

interface CourseData {
  code: string;
  count: number;
  titre: string;
}

interface TopCoursesChartProps {
  /** Données des formations (top 10) */
  data: CourseData[];
  /** Hauteur du graphique */
  height?: number;
}

/**
 * Graphique à barres horizontales D3.js affichant le top 10 des formations
 */
export function TopCoursesChart({ data, height = 350 }: TopCoursesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const drawChart = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

    // Nettoyer le SVG
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Dimensions
    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 10, right: 40, bottom: 20, left: 90 };
    const chartWidth = containerWidth - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Limiter à 10 entrées
    const entries = data.slice(0, 10);

    if (entries.length === 0) return;

    // Échelles
    const yScale = d3
      .scaleBand()
      .domain(entries.map((d) => d.code))
      .range([0, chartHeight])
      .padding(0.2);

    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(entries, (d) => d.count) || 0])
      .nice()
      .range([0, chartWidth]);

    // Groupe principal
    const g = svg
      .attr("width", containerWidth)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Axe Y (codes formations)
    g.append("g")
      .call(d3.axisLeft(yScale))
      .selectAll("text")
      .style("fill", "#9ca3af")
      .style("font-size", "11px")
      .style("font-family", "monospace");

    g.selectAll(".domain, .tick line").style("stroke", "#4b5563");

    // Axe X
    g.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format("d")))
      .selectAll("text")
      .style("fill", "#9ca3af")
      .style("font-size", "11px");

    // Grille verticale
    g.append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickSize(chartHeight)
          .tickFormat(() => "")
      )
      .selectAll("line")
      .style("stroke", "#374151")
      .style("stroke-dasharray", "3,3");

    g.select(".grid .domain").remove();

    // Palette de couleurs
    const colorScale = d3
      .scaleSequential()
      .domain([0, entries.length - 1])
      .interpolator(d3.interpolateViridis);

    // Barres avec animation
    const bars = g
      .selectAll(".bar")
      .data(entries)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("y", (d) => yScale(d.code) || 0)
      .attr("x", 0)
      .attr("height", yScale.bandwidth())
      .attr("width", 0)
      .attr("fill", (_, i) => colorScale(i))
      .attr("rx", 4);

    // Animation d'entrée
    bars
      .transition()
      .duration(600)
      .delay((_, i) => i * 60)
      .attr("width", (d) => xScale(d.count));

    // Labels de valeur
    g.selectAll(".label")
      .data(entries)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", (d) => xScale(d.count) + 5)
      .attr("y", (d) => (yScale(d.code) || 0) + yScale.bandwidth() / 2)
      .attr("dy", "0.35em")
      .style("fill", "#9ca3af")
      .style("font-size", "11px")
      .style("opacity", 0)
      .text((d) => d.count)
      .transition()
      .duration(600)
      .delay((_, i) => i * 60 + 300)
      .style("opacity", 1);

    // Tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "d3-tooltip-courses")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", "rgba(17, 24, 39, 0.95)")
      .style("border", "1px solid #4b5563")
      .style("border-radius", "6px")
      .style("padding", "8px 12px")
      .style("font-size", "13px")
      .style("color", "white")
      .style("pointer-events", "none")
      .style("z-index", "1000")
      .style("max-width", "300px");

    bars
      .on("mouseover", function (_event, d) {
        d3.select(this).style("opacity", 0.8);
        tooltip.style("visibility", "visible").html(
          `<strong>${d.code}</strong><br/>
           <span style="color: #9ca3af">${d.titre}</span><br/>
           <span style="color: #10b981">${d.count} session${d.count > 1 ? "s" : ""}</span>`
        );
      })
      .on("mousemove", function (event) {
        tooltip
          .style("top", event.pageY - 10 + "px")
          .style("left", event.pageX + 10 + "px");
      })
      .on("mouseout", function () {
        d3.select(this).style("opacity", 1);
        tooltip.style("visibility", "hidden");
      });

    // Cleanup tooltip on unmount
    return () => {
      tooltip.remove();
    };
  }, [data, height]);

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
      d3.selectAll(".d3-tooltip-courses").remove();
    };
  }, [drawChart]);

  if (data.length === 0) {
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
