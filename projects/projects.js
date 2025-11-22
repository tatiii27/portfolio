// projects/projects.js
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// 1) target the SVG you already placed in projects/index.html
const svg = d3.select('#projects-pie-plot');

// 2) arc generator (radius 50 matches your viewBox)
const arcGen = d3.arc().innerRadius(0).outerRadius(50);

// 3) our toy data: slices for 1 and 2  →  ~33% / 67%
const data = [1, 2];

// 4) convert values → start/end angles
const total = d3.sum(data);
let angle = 0;
const arcs = data.map(d => {
  const startAngle = angle;
  const endAngle   = angle + (d / total) * 2 * Math.PI;
  angle = endAngle;
  return { startAngle, endAngle };
});

// 5) draw the slices
const colors = ['gold', 'purple']; // per spec

svg.selectAll('path')
  .data(arcs)
  .join('path')
  .attr('d', arcGen)
  .attr('fill', (d, i) => colors[i]);
