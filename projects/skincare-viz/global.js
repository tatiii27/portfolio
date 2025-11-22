document.addEventListener("DOMContentLoaded", () => {
  "use strict";


  const CSV_PATH = "data/products_by_skin_type.csv";
  const SKINS = ["oily", "dry", "normal", "combination", "sensitive"];


  const brandColor = d3.scaleOrdinal(d3.schemeTableau10); 
  const labelColor = d3.scaleOrdinal(d3.schemeSet2);      


  const skinSel  = document.querySelector("#skinInput");
  const svg      = d3.select("#brandBoard");
  const tip      = d3.select("#tip");
  const pickBox  = document.querySelector("#brandPick");

  
  const wsvg       = d3.select("#labelWinners");
  const wtip       = d3.select("#wTip");
  const winnerPick = document.querySelector("#winnerPick");

  // bubble chart
  const catSel = document.querySelector("#catInput");
  const bsvg = d3.select("#brandBubbles");
  const btip = d3.select("#bubbleTip");

  let DATA = [];
  let CATEGORIES = [];


  d3.csv(CSV_PATH, d3.autoType).then(rows => {
    rows.forEach(d => {
      if (d.Label && !d.category) d.category = d.Label; 
      if (typeof d.skin_type === "string") d.skin_type = d.skin_type.toLowerCase().trim();
      if (typeof d.Label === "string") d.Label = d.Label.trim();
      if (typeof d.brand === "string") d.brand = d.brand.trim();
      if (typeof d.name === "string") d.name = d.name.trim();
      d.rank  = Number(d.rank);
      d.price = Number.isFinite(+d.price) ? +d.price : undefined;
    });


    DATA = rows.filter(d => d.Label && d.brand && d.name && SKINS.includes(d.skin_type) && Number.isFinite(d.rank) && d.rank > 0 && d.rank <=5);
    CATEGORIES = Array.from(new Set(DATA.map(d => d.Label))).sort((a,b)=>d3.ascending(a,b));

    if (skinSel && !SKINS.includes((skinSel.value||"").toLowerCase())) skinSel.value = "oily";

    if (skinSel && !svg.empty()) {
      renderLeaderboard();
      ["input","change"].forEach(ev => skinSel.addEventListener(ev, renderLeaderboard));
    }
    if (!wsvg.empty()) {
      renderWinners(); 
    }

    initBubbleChart();

  }).catch(err => console.error("CSV load error:", err));


  function renderLeaderboard() {
    if (!skinSel || svg.empty()) return;

    svg.selectAll("*").remove();
    tip.style("display","none");
    if (pickBox) pickBox.textContent = "";

    const chosen = (skinSel.value || "").toLowerCase();
    const skin = SKINS.includes(chosen) ? chosen : "oily";

    const group = d3.rollups(
      DATA.filter(d => d.skin_type === skin),
      v => ({
        avg: d3.mean(v, d => d.rank),
        top3: v.slice().sort((a,b) => d3.descending(a.rank, b.rank)).slice(0,3)
      }),
      d => d.brand
    )
    .map(([brand, stats]) => ({ brand, ...stats }))
    .filter(d => Number.isFinite(d.avg))
    .sort((a,b) => d3.descending(a.avg, b.avg))
    .slice(0, 12);


    brandColor.domain(group.map(d => d.brand));

    const W = +svg.attr("width") || 900;
    const H = +svg.attr("height") || 420;
    const M = { top: 30, right: 24, bottom: 44, left: 180 };
    const iw = W - M.left - M.right;
    const ih = H - M.top - M.bottom;

    const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

    const x = d3.scaleLinear().domain([0, 5]).range([0, iw]);
    const y = d3.scaleBand().domain(group.map(d => d.brand)).range([0, ih]).padding(0.15);

    g.append("g").attr("class","axis").attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(6));
    g.append("g").attr("class","axis")
      .call(d3.axisLeft(y).tickSizeOuter(0));

    g.selectAll("rect.bar").data(group).join("rect")
      .attr("class","bar")
      .attr("x", 0)
      .attr("y", d => y(d.brand))
      .attr("height", y.bandwidth())
      .attr("width", d => x(d.avg))
      .attr("fill", d => brandColor(d.brand))
      .on("mousemove", (e, d) => {
        tip.style("display","block")
          .style("left", e.pageX + 10 + "px")
          .style("top",  e.pageY + 10 + "px")
          .html(`<b>${d.brand}</b><br/>avg rating: <b>${d3.format(".2f")(d.avg)}</b>`);
      })
      .on("mouseleave", () => tip.style("display","none"))
      .on("click", (_, d) => {
        const t3 = d.top3.map(x => `• ${x.name} (${d3.format(".2f")(x.rank)})`).join("<br>");
        if (pickBox) pickBox.innerHTML =
          `<b>${d.brand}</b> — top products for <b>${skin}</b> skin:<br>${t3}`;
      });

    svg.append("text")
      .attr("x", 180)
      .attr("y", 18)
      .attr("class","caption")
      .text(`Click a bar for top picks.`);
  }

   
function renderWinners() {
  if (wsvg.empty()) return;

  
  const byLabel = d3.group(
    DATA.filter(d => d.Label && d.brand && d.name && Number.isFinite(d.price)),
    d => d.Label
  );

  const winners = Array.from(byLabel, ([label, arr]) => {
    const best = d3.greatest(arr, d => d.rank) || arr[0];
    const tied = arr.filter(x => x.rank === best.rank);
    const pick = tied.length > 1
      ? tied.sort((a,b) =>
          (d3.ascending(a.price ?? Infinity, b.price ?? Infinity)) ||
          d3.ascending(a.name, b.name)
        )[0]
      : best;
    return { label, brand: pick.brand, name: pick.name, rating: +pick.rank, price: +pick.price };
  }).sort((a,b) => d3.ascending(a.label, b.label));


  labelColor.domain(winners.map(d => d.label));

  
  const W = +wsvg.attr("width") || 900;
  const M = { top: 72, right: 220, bottom: 56, left: 160 }; 
  const iw = W - M.left - M.right;
  const ih = Math.max(240, winners.length * 36 + 10);
  wsvg.attr("height", ih + M.top + M.bottom);

  const root = wsvg.selectAll("g.root").data([null]).join("g")
    .attr("class", "root")
    .attr("transform", `translate(${M.left},${M.top})`);


  const x = d3.scaleLinear()
    .domain(d3.extent(winners, d => d.price)).nice()
    .range([0, iw]);

  const y = d3.scalePoint()
    .domain(winners.map(d => d.label))
    .range([0, ih])
    .padding(0.8);

  
  root.selectAll("g.x").data([null]).join("g")
    .attr("class","axis x")
    .attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x));

  root.selectAll("g.y").data([null]).join("g")
    .attr("class","axis y")
    .call(d3.axisLeft(y).tickSizeOuter(0));

  
  root.selectAll("text.xlab").data([null]).join("text")
    .attr("class", "xlab")
    .attr("x", iw / 2)
    .attr("y", ih + 40)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Price (USD)");

  
  root.selectAll("circle.win").remove();
  root.selectAll("circle.win").data(winners, d => d.label).join("circle")
    .attr("class","win")
    .attr("cx", d => x(d.price))
    .attr("cy", d => y(d.label))
    .attr("r", 10)
    .attr("fill", d => labelColor(d.label))
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .on("mousemove", (e, d) => {
      wtip.style("display","block")
        .style("left", e.pageX + 10 + "px")
        .style("top",  e.pageY + 10 + "px")
        .html(
          `<b>${d.label}</b><br/>${d.brand} — ${d.name}<br/>` +
          `rating: <b>${d.rating.toFixed(2)}</b> · $${d.price.toFixed(2)}`
        );
    })
    .on("mouseleave", () => wtip.style("display","none"))
    .on("click", (_, d) => {
      if (winnerPick) {
        winnerPick.innerHTML =
          `<b>${d.label}</b> — best overall:<br>` +
          `• ${d.brand} — ${d.name} <i>(${d.rating.toFixed(2)}, $${d.price.toFixed(2)})</i>`;
        winnerPick.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });


  const legend = root.selectAll("g.legend").data([null]).join("g")
    .attr("class", "legend")
    .attr("transform", `translate(${iw + 20},0)`);

  const legItem = legend.selectAll("g.item").data(winners, d => d.label);
  const legEnter = legItem.join(
    enter => enter.append("g").attr("class","item")
      .attr("transform", (_, i) => `translate(0, ${i * 20})`)
  );

  legEnter.selectAll("circle").data(d => [d]).join("circle")
    .attr("r", 6)
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("fill", d => labelColor(d.label));

  legEnter.selectAll("text").data(d => [d]).join("text")
    .attr("x", 12)
    .attr("y", 1)
    .attr("dominant-baseline", "middle")
    .style("font-size", "12px")
    .text(d => d.label);

    // =============== BRAND BUBBLE CHART (skin + category toggles) ===============
  function initBubbleChart() {
    const catSel = document.querySelector("#catInput");
    const bsvg   = d3.select("#brandBubbles");
    const btip   = d3.select("#bubbleTip");

    if (!catSel || bsvg.empty()) return;  // skip if section isn’t on the page

  // Build the category (Label) list once from DATA
  const labels = Array.from(new Set(
    DATA.filter(d => d.Label).map(d => d.Label.trim())
  )).sort((a,b) => d3.ascending(a, b));

  // Populate the category dropdown (All + labels)
  catSel.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "__all__";
  allOpt.textContent = "All";
  catSel.appendChild(allOpt);
  labels.forEach(L => {
    const o = document.createElement("option");
    o.value = L;
    o.textContent = L;
    catSel.appendChild(o);
  });

  // Draw once, then re-render on changes to BOTH toggles
  renderBubbles();
  catSel.addEventListener("change", renderBubbles);
  if (skinSel) {
    ["input", "change"].forEach(ev => skinSel.addEventListener(ev, renderBubbles));
  }

  function renderBubbles() {
    const W = +bsvg.attr("width")  || 900;
    const H = +bsvg.attr("height") || 520;

    const skin = (skinSel?.value || "oily").toLowerCase();
    const cat  = catSel.value || "__all__";

    // Filter rows by skin + (optional) category
    let subset = DATA.filter(d =>
      d.skin_type === skin &&
      Number.isFinite(d.rank) &&
      d.rank > 0 && d.rank <= 5
    );
    if (cat && cat !== "__all__") {
      subset = subset.filter(d => d.Label === cat);
    }

    // Group by brand → node per brand
    const nodes = Array.from(
      d3.group(subset, d => d.brand),
      ([brand, arr]) => ({
        brand,
        count: arr.length,
        avg: d3.mean(arr, d => d.rank),
        top3: arr.slice().sort((a,b) => d3.descending(a.rank, b.rank)).slice(0,3)
      })
    )
    .filter(d => d.brand && Number.isFinite(d.avg));

    // If no data, clear and show a note
    bsvg.selectAll("*").remove();
    if (nodes.length === 0) {
      bsvg.append("text")
          .attr("x", 20)
          .attr("y", 30)
          .attr("class", "caption")
          .text(`No brands found for ${skin}${cat==="__all__" ? "" : ` · ${cat}`}.`);
      return;
    }

    // Scales
    const size = d3.scaleSqrt()
      .domain(d3.extent(nodes, d => d.count))
      .range([10, 55]);  // bubble radius

    // Keep color intuitive: red=low rating, green=high rating
    const ratingMin = d3.min(nodes, d => d.avg);
    const ratingMax = d3.max(nodes, d => d.avg);
    const color = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain([Math.max(2.5, ratingMin ?? 2.5), Math.min(5, ratingMax ?? 5)]);

    // Root group
    const g = bsvg.append("g");

    // Draw nodes
    const circles = g.selectAll("circle")
      .data(nodes, d => d.brand)
      .join("circle")
      .attr("r", d => size(d.count))
      .attr("fill", d => color(d.avg))
      .attr("stroke", "#222")
      .attr("stroke-width", 1)
      .attr("opacity", 0.9)
      .attr("cursor", "pointer")
      .on("mousemove", (e, d) => {
        // tooltip
        btip.style("display","block")
            .style("left", e.pageX + 10 + "px")
            .style("top",  e.pageY + 10 + "px")
            .html(`
              <b>${d.brand}</b><br/>
              ${d.count} product${d.count>1?"s":""}${cat==="__all__" ? "" : ` · ${cat}`}<br/>
              ⭐ avg rating: <b>${d3.format(".2f")(d.avg)}</b>
            `);
      })
      .on("mouseleave", () => btip.style("display","none"))
      .on("click", (_, d) => {
        // On click, show top picks under your existing #brandPick box, if present
        if (pickBox) {
          const items = d.top3.map(p => `• ${p.name} (${d3.format(".2f")(p.rank)})`).join("<br>");
          pickBox.innerHTML = `<b>${d.brand}</b> — top picks for <b>${skin}</b>${cat==="__all__" ? "" : ` · <i>${cat}</i>`}:<br>${items}`;
          pickBox.scrollIntoView({behavior:"smooth", block:"nearest"});
        }
      });

    // Abbreviated labels
    const labelsSel = g.selectAll("text.brand")
      .data(nodes, d => d.brand)
      .join("text")
      .attr("class", "brand")
      .attr("font-size", "11px")
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none")
      .text(d => d.brand.length > 12 ? d.brand.slice(0,12) + "…" : d.brand);

    // Force simulation for layout
    const sim = d3.forceSimulation(nodes)
      .force("center", d3.forceCenter(W/2, H/2))
      .force("charge", d3.forceManyBody().strength(4))
      .force("collide", d3.forceCollide().radius(d => size(d.count) + 3))
      .on("tick", () => {
        circles.attr("cx", d => d.x).attr("cy", d => d.y);
        labelsSel.attr("x", d => d.x).attr("y", d => d.y + 4);
      });

    // Title/caption
    bsvg.append("text")
      .attr("x", 16)
      .attr("y", 20)
      .attr("class", "caption")
      .text(`skin: ${skin}${cat==="__all__" ? "" : ` · category: ${cat}`} — size=count, color=avg rating (higher=greener)`);
  }
}



});
