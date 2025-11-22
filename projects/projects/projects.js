// projects/projects.js
// Try multiple CDNs to avoid a blocked import
let d3;
try {
  d3 = await import('https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm');
} catch (e1) {
  console.warn('jsDelivr failed, trying unpkg…', e1);
  try {
    d3 = await import('https://unpkg.com/d3@7.9.0?module');
  } catch (e2) {
    console.error('Both D3 imports failed. Are you online or is the CDN blocked?', e2);
    throw e2;
  }
}

const svg = d3.select('#projects-pie-plot');
if (svg.empty()) {
  console.error('SVG #projects-pie-plot not found. Check the id in HTML.');
} else {
  const arcPath = d3.arc().innerRadius(0).outerRadius(50)({
    startAngle: 0,
    endAngle: 2 * Math.PI,
  });

  svg.append('path')
    .attr('d', arcPath)
    .attr('fill', 'red')
    .attr('stroke', 'red')      // helps you see it for sure
    .attr('stroke-width', 1);

  console.log('✅ D3 arc appended to #projects-pie-plot');
}
