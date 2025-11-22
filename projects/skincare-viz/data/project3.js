import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

/* ------------------------------------------------------------
   Annotation data (brand summaries & top products)
------------------------------------------------------------ */
const top_brands_by_skin_url = "data/best_brand_for_skin_types.json";
const top_products_url       = "data/best_products_for_brand.json";

let best_brands = {};
let brand_top_products = {};
let annotationsReady = false;

// price buckets; 0 means “no ceiling / uncapped”
const budget_scale = [25, 40, 60, 80, 120, 200, 0];
function budgetForPrice(p) {
  const price = +p || 0;
  for (const t of budget_scale) if (t && price <= t) return t;
  return 0; // 0 again = "∞" (no ceiling)
}

function keyForLabelSkinBudget(label, skin, maxBudget) {
  return `${label}__${skin}__max${maxBudget}`;
}

async function loadAnnotationData() {
  try {
    const [brandsResp, prodsResp] = await Promise.all([
      fetch(top_brands_by_skin_url),
      fetch(top_products_url)
    ]);
    best_brands        = await brandsResp.json();
    brand_top_products = await prodsResp.json();
    annotationsReady = true;
    console.log("[annotations] loaded");
  } catch (e) {
    console.warn("[annotations] Could not load JSON files:", e);
  }
}

/* Ensure a simple info panel exists above the chart */
function ensureAnnotationPanel() {
  if (!d3.select("#annotations").empty()) return;

  const host = d3.select("main").empty() ? d3.select("body") : d3.select("main");
  host.append("aside")
    .attr("id", "annotations")
    .style("border", "1px solid #e5e7eb")
    .style("border-radius", "10px")
    .style("padding", "10px 12px")
    .style("margin", "10px 0")
    .style("background", "#fafafa")
    .style("display", "none")
    .html(`
      <h3 style="margin:.2rem 0 .4rem">Skin-Type Tips</h3>
      <div id="annotation-summary" style="font-weight:600;margin-bottom:.25rem">
        Pick a category, skin type & budget.
      </div>
      <div id="annotation-top-brands"></div>
      <div id="annotation-top-products" style="margin-top:.35rem"></div>
    `);
}

/* Renders friendly, non-jargony annotations */
function renderAnnotations(currentLabel, currentSkin, maxPrice) {
  ensureAnnotationPanel();

  const panel    = d3.select("#annotations");
  const summary  = d3.select("#annotation-summary");
  const brandsEl = d3.select("#annotation-top-brands");
  const prodsEl  = d3.select("#annotation-top-products");

  // Hide until we have a specific label+skin AND JSON is ready
  if (currentLabel === "All" || currentSkin === "All" || !annotationsReady) {
    panel.style("display", "none");
    return;
  }

  const budget = budgetForPrice(maxPrice);
  const key = keyForLabelSkinBudget(currentLabel, currentSkin, budget);
  const rankings = best_brands[key];

  if (!rankings) {
    panel.style("display", "none");
    return;
  }

  panel.style("display", null);
  summary.text(`${currentLabel} • ${currentSkin} • budget ≤ $${budget || "∞"}`);

  const block = (title, rows, kind) => {
    if (!rows || !rows.length) return "";
    const lines = rows.slice(0, 3).map(r => {
      const rating = Number.isFinite(+r.avg_rating) ? (+r.avg_rating).toFixed(2) : "–";
      const price  = Number.isFinite(+r.avg_price)  ? (+r.avg_price).toFixed(0)  : "–";
      const act    = Number.isFinite(+r.avg_active) ? (+r.avg_active).toFixed(1) : "–";

      if (kind === "actives") {
        return `<div class="row"><strong>${r.brand}</strong> uses several well-known actives on average (~${act}). <em>Note:</em> more isn’t always better—choose what fits your skin.</div>`;
      }
      if (kind === "rating") {
        return `<div class="row"><strong>${r.brand}</strong> is highly rated (⭐ ${rating}) around ~$${price}.</div>`;
      }
      if (kind === "value") {
        return `<div class="row"><strong>${r.brand}</strong> gives strong ratings for the price (⭐ ${rating} at ~$${price}).</div>`;
      }
      return `<div class="row"><strong>${r.brand}</strong></div>`;
    }).join("");
    return `<h4 style="margin:.4rem 0 .2rem">${title}</h4>${lines}`;
  };

  // Friendly, comparative titles
  const html =
      block("Similar formulas, different prices (brand-level):", rankings.top_by_avg_active, "actives")
    + block("Highest rated in this filter:",                     rankings.top_by_rating,     "rating")
    + block("Best value (rating per $):",                        rankings.top_by_value,      "value");

  brandsEl.html(html);

  // Optional: show top products for the actives leader
  const leaderBrand = rankings.top_by_avg_active?.[0]?.brand;
  if (leaderBrand) {
    const prodsForState = brand_top_products[key] || {};
    const topProds = prodsForState[leaderBrand] || [];
    if (topProds.length) {
      prodsEl.html(
        `<div><em>Example products from ${leaderBrand}:</em><br>` +
        topProds.map(p =>
          `• ${p.name} — ${p.active_count} actives, ⭐ ${(+p.rating).toFixed(1)}, $${(+p.price).toFixed(0)}`
        ).join("<br>") +
        `</div>`
      );
    } else {
      prodsEl.html("");
    }
  } else {
    prodsEl.html("");
  }
}

// Load annotation JSON in parallel
loadAnnotationData();

/* ------------------------------------------------------------
   BUBBLE CHART
------------------------------------------------------------ */
d3.csv("data/cosmetic_p.csv").then(data => {
  // Type casting
  data.forEach(d => {
    d.price = +d.price || 0;
    d.rank = +d.rank || 0;
    d.Combination = +d.Combination || 0;
    d.Dry = +d.Dry || 0;
    d.Normal = +d.Normal || 0;
    d.Oily = +d.Oily || 0;
    d.Sensitive = +d.Sensitive || 0;
  });

  const width = 1100, height = 750;

  const svg = d3.select("#brand-bubble-chart")
    .attr("width", width)
    .attr("height", height);

  // Layers
  const bubbleLayer = svg.append("g").attr("class", "bubble-layer");
  const labelLayer  = svg.append("g").attr("class", "label-layer");

  let brushRange = null; // reserved for future
  const axisG  = svg.append("g").attr("class", "x-axis");
  svg.append("g").attr("class", "x-brush"); // not used now

  // Tooltip (once)
  if (d3.select("#tooltip").empty()) {
    d3.select("body").append("div")
      .attr("id", "tooltip")
      .style("position", "absolute")
      .style("background", "white")
      .style("border", "1px solid #ccc")
      .style("padding", "6px 10px")
      .style("border-radius", "4px")
      .style("pointer-events", "none")
      .style("opacity", 0);
  }

  // Controls
  const categories = Array.from(new Set(data.map(d => d.Label))).sort();
  const skinTypes  = ["Combination", "Dry", "Normal", "Oily", "Sensitive"];
  const maxPrice   = d3.max(data, d => d.price) ?? 0;

  d3.select("#controls").html(`
    <label>Category: </label>
    <select id="categorySelect">
      <option value="All">All</option>
      ${categories.map(c => `<option value="${c}">${c}</option>`).join("")}
    </select>
    &nbsp;&nbsp;
    <label>Skin Type: </label>
    <select id="skinSelect">
      <option value="All">All</option>
      ${skinTypes.map(s => `<option value="${s}">${s}</option>`).join("")}
    </select>
    &nbsp;&nbsp;
    <label>Max Price: </label>
    <input type="range" id="priceSlider" min="0" max="${maxPrice}" value="${maxPrice}" step="1" style="width:200px;">
    <span id="priceLabel">${maxPrice}</span>
    &nbsp;&nbsp;
    <button id="resetBtn">Reset Filters</button>
  `);

  // Size scale
  const size = d3.scaleSqrt()
    .domain(d3.extent(data, d => d.price))
    .range([10, 60]);

  // Legend + arrow marker
  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%");
  defs.append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 8)
    .attr("refY", 5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 z")
    .attr("fill", "#555");

  const legendWidth = 200, legendHeight = 10;
  const legendGroup = svg.append("g")
    .attr("class", "legend-group")
    .attr("transform", `translate(${(width - legendWidth) / 2}, ${height - 20})`);
  legendGroup.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#legend-gradient)");
  legendGroup.append("text")
    .attr("x", legendWidth / 2)
    .attr("y", -10)
    .attr("font-size", "12px")
    .attr("text-anchor", "middle")
    .text("Rating (relative)");

  // ---------- UPDATE ----------
  function updateChart() {
    const selectedCategory = d3.select("#categorySelect").property("value");
    const selectedSkin     = d3.select("#skinSelect").property("value");
    const maxP             = +d3.select("#priceSlider").property("value");
    d3.select("#priceLabel").text(maxP);

    let filtered = data.filter(d =>
      (selectedCategory === "All" || d.Label === selectedCategory) &&
      (selectedSkin === "All" || d[selectedSkin] === 1) &&
      (brushRange ? (d.price >= brushRange[0] && d.price <= brushRange[1]) : d.price <= maxP)
    );

    // Keep top 20 by rating within the filter
    filtered = filtered.sort((a, b) => d3.descending(a.rank, b.rank)).slice(0, 20);

    // Color scale with safeguards
    let rMin = d3.min(filtered, d => d.rank);
    let rMax = d3.max(filtered, d => d.rank);
    if (!(rMin >= 0) || !(rMax >= 0)) { rMin = 3.0; rMax = 5.0; }
    else if (rMin === rMax) { rMin = Math.max(0, rMin - 0.2); rMax = Math.min(5, rMax + 0.2); }

    const color = d3.scaleSequential(d3.interpolateRdYlGn).domain([rMin, rMax]);

    const stops = gradient.selectAll("stop").data(d3.ticks(0, 1, 10));
    stops.enter().append("stop").merge(stops)
      .attr("offset", d => `${d * 100}%`)
      .attr("stop-color", d => d3.interpolateRdYlGn(d));
    stops.exit().remove();

    svg.selectAll(".legend-min, .legend-max").remove();
    legendGroup.append("text").attr("class", "legend-min").attr("x", 0).attr("y", -2).attr("font-size", "10px").text(rMin.toFixed(1));
    legendGroup.append("text").attr("class", "legend-max").attr("x", legendWidth).attr("y", -2).attr("font-size", "10px").attr("text-anchor", "end").text(rMax.toFixed(1));

    // X scale / axis layout
    const maxRadius   = d3.max(filtered, d => size(d.price)) || 60;
    const priceExtent = d3.extent(filtered, d => d.price);
    // if nothing is filtered, avoid NaNs
    if (!priceExtent[0] && !priceExtent[1]) return;

    const priceRange  = priceExtent[1] - priceExtent[0] || 1;
    const domainMin   = priceExtent[0] - priceRange * 0.05;
    const domainMax   = priceExtent[1] + priceRange * 0.15;

    const leftPad  = maxRadius + 20;
    const rightPad = maxRadius + 40;
    const xScale = d3.scaleLinear().domain([domainMin, domainMax]).range([leftPad, width - rightPad]);

    const axisY = height - 80;
    axisG.attr("transform", `translate(0, ${axisY})`);

    svg.selectAll(".price-arrow-label").data([1]).join("text")
      .attr("class", "price-arrow-label")
      .attr("x", (xScale.range()[0] + xScale.range()[1]) / 2)
      .attr("y", axisY - 10)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "#333")
      .text("Price");

    svg.selectAll(".price-axis-line").data([1]).join("line")
      .attr("class", "price-axis-line")
      .attr("x1", xScale.range()[0]).attr("y1", axisY)
      .attr("x2", xScale.range()[1]).attr("y2", axisY)
      .attr("stroke", "#555").attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)");

    filtered.forEach(d => { d.fx = xScale(d.price); if (!isFinite(d.y)) d.y = height / 2; });

    function ticked() {
      const [x0, x1] = xScale.range();
      const clampX = x => Math.max(x0, Math.min(x1, x));
      svg.selectAll("circle").attr("cx", d => clampX(d.fx)).attr("cy", d => d.y);
      svg.selectAll("g.brand-label").attr("transform", d => `translate(${clampX(d.fx)},${d.y})`);
    }

    const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat(d3.format("$~s"));
    axisG.call(xAxis);

    const simulation = d3.forceSimulation(filtered)
      .alphaDecay(0.05)
      .force("charge", d3.forceManyBody().strength(1.8))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(d => size(d.price) + 3))
      .force("x", d3.forceX(d => xScale(d.price)).strength(0.4))
      .force("y", d3.forceY(height / 2).strength(0.12))
      .on("tick", ticked);

    // Bubbles
    const node = bubbleLayer.selectAll("circle").data(filtered, d => d.name);
    svg.selectAll("g.brand-label").raise();

    node.enter()
      .append("circle")
      .attr("r", d => size(d.price))
      .attr("fill", d => color(d.rank))
      .attr("stroke", "#333").attr("stroke-width", 1)
      .attr("opacity", 0.9).attr("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).transition().duration(150).attr("r", size(d.price) * 1.15).attr("fill", "#3B82F6");
        d3.select("#tooltip").style("opacity", 1).html(`
          <strong>${d.name}</strong><br>
          Brand: ${d.brand}<br>
          Category: ${d.Label}<br>
          💲${d.price}<br>
          ⭐ Rating: ${d.rank.toFixed(2)}<br>
          Skin Types: ${["Combination","Dry","Normal","Oily","Sensitive"].filter(s => d[s] === 1).join(", ")}
        `).style("left", event.pageX + 10 + "px").style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", function () {
        const me = d3.select(this).datum();
        d3.select(this).transition().duration(200).attr("r", size(me.price)).attr("fill", color(me.rank));
        d3.select("#tooltip").style("opacity", 0);
      })
      .merge(node)
      .transition().duration(800)
      .attr("r", d => size(d.price))
      .attr("fill", d => color(d.rank));

    node.exit().remove();

    // Gridlines
    svg.selectAll(".x-grid").remove();
    const xTicks = xScale.ticks(8);
    svg.selectAll(".x-grid").data(xTicks).enter().append("line")
      .attr("class", "x-grid")
      .attr("x1", d => xScale(d)).attr("x2", d => xScale(d))
      .attr("y1", 0).attr("y2", height)
      .attr("stroke", "#ddd").attr("stroke-width", 1).attr("opacity", 0.6)
      .lower();

    // Brand labels centered in bubbles
    const labelG = labelLayer.selectAll("g.brand-label").data(filtered, d => d.name);
    labelG.exit().remove();

    const labelGEnter = labelG.enter().append("g").attr("class", "brand-label").attr("pointer-events", "none");
    labelGEnter.append("text").attr("class", "label-halo").attr("text-anchor", "middle").attr("dominant-baseline", "middle");
    labelGEnter.append("text").attr("class", "label-text").attr("text-anchor", "middle").attr("dominant-baseline", "middle");

    const labelGMerged = labelGEnter.merge(labelG);
    labelGMerged.each(function(d) {
      const g = d3.select(this);
      const halo = g.select(".label-halo").text(d.brand);
      const fill = g.select(".label-text").text(d.brand);
      const diameter = 2 * size(d.price);
      const base = 10 + 0.04 * diameter;
      const fs = Math.min(base, 16);
      halo.attr("font-size", fs);
      fill.attr("font-size", fs);
    });

    // ---- Live annotations tied to filters ----
    renderAnnotations(selectedCategory, selectedSkin, maxP);
  }

  // Reset
  d3.select("#resetBtn").on("click", () => {
    d3.select("#categorySelect").property("value", "All");
    d3.select("#skinSelect").property("value", "All");
    d3.select("#priceSlider").property("value", maxPrice);
    d3.select("#priceLabel").text(maxPrice);
    updateChart();
  });

  // Events
  d3.selectAll("#categorySelect, #skinSelect, #priceSlider")
    .on("change input", updateChart);

  // Initial render
  ensureAnnotationPanel();
  updateChart();
}).catch(err => {
  console.error("Failed to load CSV. Are you running via a local server?", err);
});
