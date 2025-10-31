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

  let DATA = [];


  d3.csv(CSV_PATH, d3.autoType).then(rows => {
    rows.forEach(d => {
      if (d.Label && !d.category) d.category = d.Label; 
      if (typeof d.skin_type === "string") d.skin_type = d.skin_type.toLowerCase().trim();
      d.rank  = +d.rank;
      d.price = Number.isFinite(+d.price) ? +d.price : undefined;
    });


    DATA = rows.filter(d => d.Label && d.brand && d.name && Number.isFinite(d.rank));


    if (skinSel && !SKINS.includes((skinSel.value||"").toLowerCase())) skinSel.value = "oily";

    if (skinSel && !svg.empty()) {
      renderLeaderboard();
      ["input","change"].forEach(ev => skinSel.addEventListener(ev, renderLeaderboard));
    }
    if (!wsvg.empty()) {
      renderWinners(); 
    }
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
}


});
