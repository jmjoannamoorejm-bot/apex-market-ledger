const api = async (path, options = {}) => {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

const money = (value) => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
};

const setStatus = (selector, text, good = true) => {
  const el = document.querySelector(selector);
  if (!el) return;
  el.textContent = text;
  el.style.color = good ? "var(--green)" : "var(--red)";
};

const wireSupportFab = async () => {
  try {
    const config = await api("/api/config");
    const digits = String(config.site.phone || "").replace(/\D/g, "");
    if (!digits) return;
    const link = document.createElement("a");
    link.className = "support-fab";
    link.href = `https://wa.me/${digits}`;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Chat";
    document.body.appendChild(link);
  } catch {
    // The page still works without the floating support link.
  }
};

document.addEventListener("DOMContentLoaded", wireSupportFab);
