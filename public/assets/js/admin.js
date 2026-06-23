const loginBox = document.querySelector("[data-admin-login]");
const adminApp = document.querySelector("[data-admin-app]");
let adminState = null;
let activePositionUserId = null;

const loadAdmin = async () => {
  try {
    adminState = await api("/api/admin/overview");
    loginBox.classList.add("hidden");
    adminApp.classList.remove("hidden");
    renderAdmin();
  } catch {
    loginBox.classList.remove("hidden");
    adminApp.classList.add("hidden");
  }
};

const renderAdmin = () => {
  const overview = adminState.overview;
  document.querySelector("[data-admin-users]").textContent = overview.users;
  document.querySelector("[data-admin-kyc]").textContent = overview.pendingKyc;
  document.querySelector("[data-admin-deposits]").textContent = overview.pendingDeposits;
  document.querySelector("[data-admin-withdrawals]").textContent = overview.pendingWithdrawals;
  document.querySelector("[data-admin-balance]").textContent = money(overview.totalBalance);
  document.querySelector("[data-backup-configured]").textContent = adminState.backupStatus?.configured ? "Yes" : "No";
  document.querySelector("[data-backup-save]").textContent = adminState.backupStatus?.lastSaveAt ? new Date(adminState.backupStatus.lastSaveAt).toLocaleString() : "-";
  document.querySelector("[data-backup-restore]").textContent = adminState.backupStatus?.lastRestoreAt ? new Date(adminState.backupStatus.lastRestoreAt).toLocaleString() : "-";
  document.querySelector("[data-backup-error]").textContent = adminState.backupStatus?.lastError || "-";
  document.querySelector("[name='realismScore']").value = adminState.projectReview?.realismScore ?? 85;
  document.querySelector("[name='notes']").value = adminState.projectReview?.notes || "";
  document.querySelector("[name='updatedAt']").value = adminState.projectReview?.updatedAt ? new Date(adminState.projectReview.updatedAt).toLocaleString() : "Not reviewed";

  document.querySelector("[name='walletEnabled']").checked = adminState.wallet.enabled;
  document.querySelector("[name='asset']").value = adminState.wallet.asset || "";
  document.querySelector("[name='network']").value = adminState.wallet.network || "";
  document.querySelector("[name='address']").value = adminState.wallet.address || "";
  document.querySelector("[name='label']").value = adminState.wallet.label || "";

  Object.entries(adminState.system).forEach(([key, value]) => {
    const input = document.querySelector(`[name='system_${key}']`);
    if (input) input.checked = value;
  });

  renderUsers();
  renderMarketControls();
  renderRecords("deposits", adminState.deposits, "[data-admin-deposit-rows]");
  renderRecords("withdrawals", adminState.withdrawals, "[data-admin-withdrawal-rows]");
  renderRecords("supportMessages", adminState.supportMessages, "[data-admin-message-rows]");
};

const renderUsers = () => {
  const rows = adminState.users.map((user) => `
    <tr>
      <td>${user.firstName || ""} ${user.lastName || ""}<br><span class="muted">${user.email}</span></td>
      <td>${user.emailVerified ? "Verified" : "Unverified"}<br>KYC: ${user.kyc?.status || "not_submitted"}</td>
      <td>${money(user.balances.totalDeposits)}</td>
      <td>${money(user.balances.activeInvestments)}</td>
      <td>${money(user.balances.realizedProfit)}</td>
      <td>${money(user.balances.availableBalance)}</td>
      <td>
        <button class="btn" data-edit-user="${user.id}">Adjust</button>
        <button class="btn" data-edit-positions="${user.id}">Positions</button>
      </td>
    </tr>
  `).join("");
  document.querySelector("[data-admin-user-rows]").innerHTML = rows || `<tr><td colspan="7">No users yet.</td></tr>`;

  document.querySelectorAll("[data-edit-user]").forEach((button) => {
    button.addEventListener("click", () => editUser(button.dataset.editUser));
  });
  document.querySelectorAll("[data-edit-positions]").forEach((button) => {
    button.addEventListener("click", () => openPositionEditor(button.dataset.editPositions));
  });
};

const renderMarketControls = () => {
  const wrap = document.querySelector("[data-admin-market-controls]");
  if (!wrap) return;
  wrap.innerHTML = (adminState.markets || []).map((market) => `
    <label class="card market-toggle">
      <input type="checkbox" name="${market.symbol}" ${market.visible ? "checked" : ""}>
      <strong>${market.symbol}</strong>
      <span class="muted">${market.name}</span>
    </label>
  `).join("");
};

const renderRecords = (type, records, selector) => {
  const rows = records.map((record) => `
    <tr>
      <td class="mono">${record.id}</td>
      <td>${record.userId || record.email || ""}</td>
      <td>${record.amount ? money(record.amount) : record.message || ""}</td>
      <td>${record.status}</td>
      <td>
        <select data-status-type="${type}" data-status-id="${record.id}">
          ${["pending", "approved", "rejected", "in_review", "resolved", "closed"].map((status) => `<option value="${status}" ${record.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </td>
    </tr>
  `).join("");
  document.querySelector(selector).innerHTML = rows || `<tr><td colspan="5">No records yet.</td></tr>`;
  document.querySelectorAll(`[data-status-type="${type}"]`).forEach((select) => {
    select.addEventListener("change", async () => {
      await api(`/api/admin/${type}/${select.dataset.statusId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: select.value })
      });
      loadAdmin();
    });
  });
};

const openPositionEditor = (id) => {
  const user = adminState.users.find((item) => item.id === id);
  if (!user) return;
  activePositionUserId = id;
  document.querySelector("[data-position-editor]").classList.remove("hidden");
  document.querySelector("[data-position-user]").textContent = `Editing positions for ${user.firstName || ""} ${user.lastName || ""} (${user.email})`;
  const positions = user.positions?.length ? user.positions : [
    { symbol: "TSLA", name: "Tesla Inc.", amount: 0, pnl: 0, status: "Active", settlementDate: "" }
  ];
  document.querySelector("[data-position-json]").value = JSON.stringify(positions, null, 2);
};

const editUser = async (id) => {
  const user = adminState.users.find((item) => item.id === id);
  if (!user) return;
  const fields = {
    totalDeposits: prompt("Total deposits", user.balances.totalDeposits),
    activeInvestments: prompt("Active investments value", user.balances.activeInvestments),
    realizedProfit: prompt("Realized profit", user.balances.realizedProfit),
    availableBalance: prompt("Available balance", user.balances.availableBalance),
    activeInvestmentCount: prompt("Active investment count", user.balances.activeInvestmentCount),
    emailVerified: confirm("Mark email as verified?"),
    kycStatus: prompt("KYC status", user.kyc?.status || "not_submitted")
  };
  try {
    await api(`/api/admin/users/${id}/balances`, {
      method: "PATCH",
      body: JSON.stringify(fields)
    });
    loadAdmin();
  } catch (error) {
    setStatus("[data-admin-status]", error.message, false);
  }
};

document.querySelector("[data-admin-login-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries()))
    });
    loadAdmin();
  } catch (error) {
    setStatus("[data-admin-login-status]", error.message, false);
  }
});

document.querySelector("[data-wallet-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api("/api/admin/wallet", {
      method: "PATCH",
      body: JSON.stringify({
        enabled: form.get("walletEnabled") === "on",
        asset: form.get("asset"),
        network: form.get("network"),
        address: form.get("address"),
        label: form.get("label")
      })
    });
    setStatus("[data-admin-status]", "Wallet settings updated.");
    loadAdmin();
  } catch (error) {
    setStatus("[data-admin-status]", error.message, false);
  }
});

document.querySelector("[data-system-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api("/api/admin/system", {
      method: "PATCH",
      body: JSON.stringify({
        deposits: form.get("system_deposits") === "on",
        withdrawals: form.get("system_withdrawals") === "on",
        investments: form.get("system_investments") === "on",
        kyc: form.get("system_kyc") === "on",
        support: form.get("system_support") === "on"
      })
    });
    setStatus("[data-admin-status]", "System settings updated.");
    loadAdmin();
  } catch (error) {
    setStatus("[data-admin-status]", error.message, false);
  }
});

document.querySelector("[data-market-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const visibility = {};
  (adminState.markets || []).forEach((market) => {
    visibility[market.symbol] = form.get(market.symbol) === "on";
  });
  try {
    await api("/api/admin/markets", {
      method: "PATCH",
      body: JSON.stringify({ visibility })
    });
    setStatus("[data-admin-status]", "Market visibility updated.");
    loadAdmin();
  } catch (error) {
    setStatus("[data-admin-status]", error.message, false);
  }
});

document.querySelector("[data-review-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api("/api/admin/review", {
      method: "PATCH",
      body: JSON.stringify({
        realismScore: form.get("realismScore"),
        notes: form.get("notes")
      })
    });
    setStatus("[data-admin-status]", "Project review saved.");
    loadAdmin();
  } catch (error) {
    setStatus("[data-admin-status]", error.message, false);
  }
});

document.querySelector("[data-position-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activePositionUserId) return;
  try {
    const positions = JSON.parse(document.querySelector("[data-position-json]").value || "[]");
    await api(`/api/admin/users/${activePositionUserId}/positions`, {
      method: "PATCH",
      body: JSON.stringify({ positions })
    });
    setStatus("[data-admin-status]", "Active investments updated.");
    document.querySelector("[data-position-editor]").classList.add("hidden");
    activePositionUserId = null;
    loadAdmin();
  } catch (error) {
    setStatus("[data-admin-status]", error.message, false);
  }
});

document.querySelector("[data-close-position-editor]")?.addEventListener("click", () => {
  document.querySelector("[data-position-editor]").classList.add("hidden");
  activePositionUserId = null;
});

loadAdmin();
