let me = null;
let config = null;
let activity = [];
let markets = [];

const refreshDashboard = async () => {
  try {
    const [meResult, configResult, marketResult] = await Promise.all([api("/api/me"), api("/api/config"), api("/api/markets")]);
    me = meResult.user;
    activity = meResult.activity || [];
    config = configResult;
    markets = marketResult.markets || [];
    renderAccount();
    renderDashboardMarkets();
    renderPositions();
    renderTransactions();
  } catch {
    window.location.href = "/login/";
  }
};

const renderAccount = () => {
  document.querySelector("[data-user-name]").textContent = `${me.firstName || "Investor"} ${me.lastName || ""}`.trim();
  document.querySelector("[data-total-deposits]").textContent = money(me.balances.totalDeposits);
  document.querySelector("[data-active-investments]").textContent = money(me.balances.activeInvestments);
  document.querySelector("[data-realized-profit]").textContent = money(me.balances.realizedProfit);
  document.querySelector("[data-available-balance]").textContent = money(me.balances.availableBalance);
  document.querySelector("[data-email-status]").textContent = me.emailVerified ? "Verified" : "Unverified";
  document.querySelector("[data-kyc-status]").textContent = me.kyc?.status || "not_submitted";

  document.querySelector("[data-wallet-asset]").textContent = config.wallet.asset || "Asset not set";
  document.querySelector("[data-wallet-network]").textContent = config.wallet.network || "Network not set";
  document.querySelector("[data-wallet-address]").textContent = config.wallet.address || "Admin has not configured a wallet yet.";
  document.querySelector("[data-position-count]").textContent = `${(me.positions || []).length} positions`;
  document.querySelector("[data-activity-count]").textContent = `${activity.length} records`;
};

const showPanel = (name) => {
  document.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.add("hidden"));
  document.querySelector(`[data-panel="${name}"]`)?.classList.remove("hidden");
};

const renderDashboardMarkets = () => {
  const grid = document.querySelector("[data-dashboard-market-grid]");
  if (!grid) return;
  const watchlist = me.watchlist || [];
  grid.innerHTML = markets.map((market) => window.renderMarketCard(market, true, watchlist.includes(market.symbol))).join("");
  grid.querySelectorAll("[data-watch-symbol]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const result = await api("/api/watchlist", {
          method: "POST",
          body: JSON.stringify({ symbol: button.dataset.watchSymbol })
        });
        me.watchlist = result.watchlist;
        renderDashboardMarkets();
      } catch (error) {
        setStatus("[data-deposit-status]", error.message, false);
      }
    });
  });
};

const renderPositions = () => {
  const rows = document.querySelector("[data-position-rows]");
  if (!rows) return;
  const positions = me.positions || [];
  rows.innerHTML = positions.map((position) => `
    <tr>
      <td class="mono">${position.symbol}</td>
      <td>${position.name || position.symbol}</td>
      <td>${money(position.amount)}</td>
      <td class="${Number(position.pnl || 0) >= 0 ? "up" : "down"}">${money(position.pnl)}</td>
      <td>${position.status || "Active"}</td>
      <td>${position.settlementDate || "-"}</td>
    </tr>
  `).join("") || `<tr><td colspan="6">No active investments yet.</td></tr>`;
};

const renderTransactions = () => {
  const rows = document.querySelector("[data-transaction-rows]");
  if (!rows) return;
  rows.innerHTML = activity.map((item) => `
    <tr>
      <td>${item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</td>
      <td>${item.type}</td>
      <td>${item.asset || "-"}</td>
      <td>${money(item.amount)}</td>
      <td>${item.status}</td>
      <td>${item.reference || "-"}</td>
    </tr>
  `).join("") || `<tr><td colspan="6">No transactions yet.</td></tr>`;
};

document.querySelectorAll("[data-open-panel]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    showPanel(button.dataset.openPanel);
  });
});

document.querySelector("[data-copy-wallet]")?.addEventListener("click", async () => {
  const address = config?.wallet?.address || "";
  if (!address) return setStatus("[data-deposit-status]", "Wallet is not configured.", false);
  await navigator.clipboard.writeText(address);
  setStatus("[data-deposit-status]", "Wallet address copied.");
});

document.querySelector("[data-send-email-code]")?.addEventListener("click", async () => {
  try {
    const result = await api("/api/email/send-code", { method: "POST", body: "{}" });
    const extra = result.devCode ? ` Local code: ${result.devCode}` : "";
    setStatus("[data-verify-status]", `Verification code requested. Delivery: ${result.emailDelivery ? "sent" : "not configured"}.${extra}`);
  } catch (error) {
    setStatus("[data-verify-status]", error.message, false);
  }
});

document.querySelector("[data-verify-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/email/verify", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries()))
    });
    setStatus("[data-verify-status]", "Email verified.");
    refreshDashboard();
  } catch (error) {
    setStatus("[data-verify-status]", error.message, false);
  }
});

document.querySelector("[data-kyc-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/kyc", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries()))
    });
    setStatus("[data-kyc-submit-status]", "KYC submitted for review.");
    refreshDashboard();
  } catch (error) {
    setStatus("[data-kyc-submit-status]", error.message, false);
  }
});

document.querySelector("[data-deposit-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/deposits", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries()))
    });
    setStatus("[data-deposit-status]", "Deposit request submitted for admin review.");
    event.currentTarget.reset();
  } catch (error) {
    setStatus("[data-deposit-status]", error.message, false);
  }
});

document.querySelector("[data-send-withdrawal-code]")?.addEventListener("click", async () => {
  try {
    const result = await api("/api/withdrawals/code", { method: "POST", body: "{}" });
    const extra = result.devCode ? ` Local code: ${result.devCode}` : "";
    setStatus("[data-withdraw-status]", `Withdrawal code requested. Delivery: ${result.emailDelivery ? "sent" : "not configured"}.${extra}`);
  } catch (error) {
    setStatus("[data-withdraw-status]", error.message, false);
  }
});

document.querySelector("[name='method']")?.addEventListener("change", (event) => {
  document.querySelector("[data-bank-fields]").classList.toggle("hidden", event.target.value !== "bank");
  document.querySelector("[data-crypto-fields]").classList.toggle("hidden", event.target.value !== "crypto");
});

document.querySelector("[data-withdraw-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/withdrawals", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries()))
    });
    setStatus("[data-withdraw-status]", "Withdrawal request submitted.");
    event.currentTarget.reset();
  } catch (error) {
    setStatus("[data-withdraw-status]", error.message, false);
  }
});

refreshDashboard();
