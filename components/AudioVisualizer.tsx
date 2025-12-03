import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface AudioVisualizerProps {
  data: Uint8Array | null;
  className?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ data, className = '' }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Clear previous
    svg.selectAll('*').remove();

    const n = data.length;
    // Downsample
    const step = Math.ceil(n / 32); 
    const simpleData = [];
    for(let i = 0; i < n; i+= step) {
        simpleData.push(data[i]);
    }

    const xScale = d3.scaleBand()
      .domain(simpleData.map((_, i) => i.toString()))
      .range([0, width])
      .padding(0.6);

    const yScale = d3.scaleLinear()
      .domain([0, 255])
      .range([height, height * 0.2]); // Keep bars grounded
      
    // Warm gradient for the bars
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "barGradient")
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");
    
    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#F28C38"); // Saffron
    
    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#D9453E"); // Paprika

    svg.selectAll('rect')
      .data(simpleData)
      .enter()
      .append('rect')
      .attr('x', (_, i) => xScale(i.toString()) || 0)
      .attr('y', d => yScale(d))
      .attr('width', xScale.bandwidth())
      .attr('height', d => height - yScale(d))
      .attr('fill', "url(#barGradient)")
      .attr('rx', 2);

  }, [data]);

  return (
    <svg ref={svgRef} className={`w-full h-full ${className}`} />
  );
};