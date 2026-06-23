window.renderMarketCard = (market, showWatch = false, watched = false) => `
  <article class="card market-card">
    <div class="ticker-symbol">
      <span>${market.symbol}</span>
      <span class="${market.change >= 0 ? "up" : "down"}">${market.change >= 0 ? "+" : ""}${market.change.toFixed(2)}%</span>
    </div>
    <h3>${market.name}</h3>
    <p class="muted">${market.sector}</p>
    <div class="market-price">${money(market.price)}</div>
    <span class="spark ${market.change < 0 ? "spark-down" : ""}"></span>
    <dl class="market-meta">
      <div><dt>Range</dt><dd>${market.range}</dd></div>
      <div><dt>Volume</dt><dd>${market.volume}</dd></div>
      <div><dt>Risk</dt><dd>${market.risk}</dd></div>
    </dl>
    <div class="sentiment"><span style="width: ${market.sentiment}%"></span></div>
    <p class="muted">${market.event}</p>
    ${showWatch ? `<button class="btn full" data-watch-symbol="${market.symbol}">${watched ? "Remove Watch" : "Add Watch"}</button>` : ""}
  </article>
`;

const loadInvestmentsPage = async () => {
  const grid = document.querySelector("[data-market-grid]");
  if (!grid) return;
  try {
    const data = await api("/api/markets");
    grid.innerHTML = data.markets.map((market) => window.renderMarketCard(market)).join("");
  } catch (error) {
    grid.innerHTML = `<article class="card"><h3>Markets unavailable</h3><p class="muted">${error.message}</p></article>`;
  }
};

loadInvestmentsPage();
