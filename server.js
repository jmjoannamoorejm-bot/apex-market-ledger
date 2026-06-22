const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const crypto = require("crypto");

loadEnvFile(path.join(__dirname, ".env"));

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DB_PATH = path.resolve(ROOT, process.env.DB_PATH || "data/db.json");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const SESSION_SECRET = process.env.SESSION_SECRET || "local-development-secret";
const SITE_NAME = process.env.SITE_NAME || "Apex Market Ledger";
const GITHUB_BACKUP_PATH = process.env.GITHUB_BACKUP_PATH || "data/render-db-backup.json";
const GITHUB_BACKUP_BRANCH = process.env.GITHUB_BACKUP_BRANCH || "main";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const state = loadDatabase();
let backupTimer = null;
let backupInFlight = false;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const rows = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const row of rows) {
    const line = row.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (process.env[key]) continue;
    process.env[key] = rest.join("=").replace(/^["']|["']$/g, "");
  }
}

function defaultDatabase() {
  return {
    users: [],
    sessions: [],
    deposits: [],
    withdrawals: [],
    supportMessages: [],
    wallet: {
      enabled: true,
      asset: "USDT",
      network: "TRC20",
      address: "",
      label: "Treasury Wallet"
    },
    system: {
      deposits: true,
      withdrawals: true,
      investments: true,
      kyc: true,
      support: true
    },
    createdAt: new Date().toISOString()
  };
}

function loadDatabase() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const fresh = defaultDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  try {
    return { ...defaultDatabase(), ...JSON.parse(fs.readFileSync(DB_PATH, "utf8")) };
  } catch {
    const backup = `${DB_PATH}.${Date.now()}.broken`;
    fs.renameSync(DB_PATH, backup);
    const fresh = defaultDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(fresh, null, 2));
    return fresh;
  }
}

function saveDatabase(options = {}) {
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2));
  if (options.remote !== false) scheduleRemoteBackup();
}

function githubBackupConfig() {
  const token = process.env.GITHUB_BACKUP_TOKEN;
  const repo = process.env.GITHUB_BACKUP_REPO;
  if (!token || !repo || !repo.includes("/")) return null;
  const [owner, name] = repo.split("/");
  return { token, owner, name };
}

function githubRequest(method, requestPath, payload) {
  const config = githubBackupConfig();
  if (!config) return Promise.resolve(null);
  const body = payload ? JSON.stringify(payload) : null;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.github.com",
      path: requestPath,
      method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "apex-market-ledger",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {})
      },
      timeout: 12000
    }, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => {
        responseBody += chunk;
      });
      res.on("end", () => {
        const parsed = responseBody ? JSON.parse(responseBody) : {};
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
        if (res.statusCode === 404) return resolve(null);
        reject(new Error(parsed.message || `GitHub backup request failed with ${res.statusCode}`));
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("GitHub backup request timed out"));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function getRemoteBackupFile() {
  const config = githubBackupConfig();
  if (!config) return null;
  const encodedPath = GITHUB_BACKUP_PATH.split("/").map(encodeURIComponent).join("/");
  return githubRequest("GET", `/repos/${config.owner}/${config.name}/contents/${encodedPath}?ref=${encodeURIComponent(GITHUB_BACKUP_BRANCH)}`);
}

async function restoreRemoteBackup() {
  try {
    const file = await getRemoteBackupFile();
    if (!file || !file.content) return false;
    const content = Buffer.from(file.content, "base64").toString("utf8");
    const restored = JSON.parse(content);
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, { ...defaultDatabase(), ...restored });
    saveDatabase({ remote: false });
    console.log("Restored database from GitHub backup.");
    return true;
  } catch (error) {
    console.warn(`GitHub backup restore skipped: ${error.message}`);
    return false;
  }
}

function scheduleRemoteBackup() {
  if (!githubBackupConfig()) return;
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    pushRemoteBackup().catch((error) => {
      console.warn(`GitHub backup save skipped: ${error.message}`);
    });
  }, 1500);
}

async function pushRemoteBackup() {
  if (backupInFlight || !githubBackupConfig()) return;
  backupInFlight = true;
  try {
    const config = githubBackupConfig();
    const current = await getRemoteBackupFile();
    const encodedPath = GITHUB_BACKUP_PATH.split("/").map(encodeURIComponent).join("/");
    await githubRequest("PUT", `/repos/${config.owner}/${config.name}/contents/${encodedPath}`, {
      message: "Update Render database backup",
      branch: GITHUB_BACKUP_BRANCH,
      content: Buffer.from(JSON.stringify(state, null, 2)).toString("base64"),
      ...(current?.sha ? { sha: current.sha } : {})
    });
    console.log("Saved database to GitHub backup.");
  } finally {
    backupInFlight = false;
  }
}

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").filter(Boolean).map((part) => {
      const [name, ...rest] = part.trim().split("=");
      return [decodeURIComponent(name), decodeURIComponent(rest.join("="))];
    })
  );
}

function setCookie(res, name, value) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
}

function clearCookie(res, name) {
  const existing = res.getHeader("Set-Cookie");
  const next = `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  if (!existing) return res.setHeader("Set-Cookie", next);
  res.setHeader("Set-Cookie", Array.isArray(existing) ? [...existing, next] : [existing, next]);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!password || !stored || !stored.includes(":")) return false;
  const [salt, expected] = stored.split(":");
  const actual = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function signSession(raw) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(raw).digest("hex");
}

function createSession(res, kind, ownerId) {
  const raw = crypto.randomBytes(24).toString("hex");
  const token = `${raw}.${signSession(raw)}`;
  state.sessions.push({
    id: makeId("sess"),
    token,
    kind,
    ownerId,
    createdAt: new Date().toISOString()
  });
  saveDatabase();
  setCookie(res, kind === "admin" ? "admin_sid" : "sid", token);
}

function validSignedToken(token) {
  if (!token || !token.includes(".")) return false;
  const [raw, sig] = token.split(".");
  return signSession(raw) === sig;
}

function currentUser(req) {
  const token = parseCookies(req).sid;
  if (!validSignedToken(token)) return null;
  const session = state.sessions.find((item) => item.token === token && item.kind === "user");
  if (!session) return null;
  return state.users.find((user) => user.id === session.ownerId) || null;
}

function currentAdmin(req) {
  const token = parseCookies(req).admin_sid;
  if (!validSignedToken(token)) return false;
  return state.sessions.some((item) => item.token === token && item.kind === "admin");
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, emailCode, withdrawalCode, ...safe } = user;
  return safe;
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) json(res, 401, { ok: false, error: "Login required" });
  return user;
}

function requireAdmin(req, res) {
  if (!currentAdmin(req)) {
    json(res, 401, { ok: false, error: "Admin login required" });
    return false;
  }
  return true;
}

function amount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 100) / 100;
}

function adminOverview() {
  const totalBalance = state.users.reduce((sum, user) => sum + Number(user.balances.availableBalance || 0), 0);
  return {
    users: state.users.length,
    verifiedUsers: state.users.filter((user) => user.emailVerified).length,
    pendingKyc: state.users.filter((user) => user.kyc?.status === "pending").length,
    pendingDeposits: state.deposits.filter((item) => item.status === "pending").length,
    pendingWithdrawals: state.withdrawals.filter((item) => item.status === "pending").length,
    supportMessages: state.supportMessages.filter((item) => item.status !== "closed").length,
    totalBalance
  };
}

async function sendVerificationEmail(to, code, purpose = "verification") {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false, reason: "Email provider not configured" };
  const payload = JSON.stringify({
    from,
    to,
    subject: `${SITE_NAME} ${purpose} code`,
    html: `<p>Your ${SITE_NAME} ${purpose} code is:</p><h2>${code}</h2><p>This code expires soon. If you did not request it, ignore this message.</p>`
  });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.resend.com",
      path: "/emails",
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      },
      timeout: 8000
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({ sent: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body });
      });
    });
    req.on("error", (error) => resolve({ sent: false, reason: error.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ sent: false, reason: "Email provider timeout" });
    });
    req.write(payload);
    req.end();
  });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method;

  try {
    if (method === "GET" && url.pathname === "/api/health") {
      return json(res, 200, { ok: true, site: SITE_NAME, time: new Date().toISOString() });
    }

    if (method === "GET" && url.pathname === "/api/config") {
      return json(res, 200, {
        ok: true,
        site: {
          name: SITE_NAME,
          email: process.env.COMPANY_EMAIL || "managementwilliwheyx@gmail.com",
          phone: process.env.COMPANY_PHONE || "+1 (720) 506-9106",
          address: process.env.COMPANY_ADDRESS || "600 Congress Ave, Austin, TX 78701"
        },
        wallet: state.wallet,
        system: state.system
      });
    }

    if (method === "POST" && url.pathname === "/api/register") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!email.includes("@") || password.length < 8) {
        return json(res, 400, { ok: false, error: "Valid email and 8+ character password required" });
      }
      if (state.users.some((user) => user.email === email)) {
        return json(res, 409, { ok: false, error: "Email already registered" });
      }
      const code = String(crypto.randomInt(100000, 999999));
      const user = {
        id: makeId("user"),
        firstName: String(body.firstName || "").trim(),
        lastName: String(body.lastName || "").trim(),
        email,
        phone: String(body.phone || "").trim(),
        country: String(body.country || "").trim(),
        accountType: String(body.accountType || "Individual").trim(),
        investmentGoal: String(body.investmentGoal || "").trim(),
        passwordHash: hashPassword(password),
        emailVerified: false,
        emailCode: { code, createdAt: new Date().toISOString() },
        kyc: { status: "not_submitted" },
        balances: {
          totalDeposits: 0,
          activeInvestments: 0,
          realizedProfit: 0,
          availableBalance: 0,
          activeInvestmentCount: 0
        },
        createdAt: new Date().toISOString()
      };
      state.users.push(user);
      saveDatabase();
      createSession(res, "user", user.id);
      const delivery = await sendVerificationEmail(email, code, "email verification");
      return json(res, 201, {
        ok: true,
        user: publicUser(user),
        emailDelivery: delivery.sent,
        devCode: process.env.NODE_ENV === "production" ? undefined : code
      });
    }

    if (method === "POST" && url.pathname === "/api/login") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const user = state.users.find((item) => item.email === email);
      if (!user || !verifyPassword(String(body.password || ""), user.passwordHash)) {
        return json(res, 401, { ok: false, error: "Invalid email or password" });
      }
      createSession(res, "user", user.id);
      return json(res, 200, { ok: true, user: publicUser(user) });
    }

    if (method === "POST" && url.pathname === "/api/logout") {
      const cookies = parseCookies(req);
      state.sessions = state.sessions.filter((item) => item.token !== cookies.sid && item.token !== cookies.admin_sid);
      saveDatabase();
      clearCookie(res, "sid");
      clearCookie(res, "admin_sid");
      return json(res, 200, { ok: true });
    }

    if (method === "GET" && url.pathname === "/api/me") {
      const user = requireUser(req, res);
      if (!user) return;
      return json(res, 200, { ok: true, user: publicUser(user) });
    }

    if (method === "POST" && url.pathname === "/api/email/send-code") {
      const user = requireUser(req, res);
      if (!user) return;
      const code = String(crypto.randomInt(100000, 999999));
      user.emailCode = { code, createdAt: new Date().toISOString() };
      saveDatabase();
      const delivery = await sendVerificationEmail(user.email, code, "email verification");
      return json(res, 200, {
        ok: true,
        emailDelivery: delivery.sent,
        devCode: process.env.NODE_ENV === "production" ? undefined : code
      });
    }

    if (method === "POST" && url.pathname === "/api/email/verify") {
      const user = requireUser(req, res);
      if (!user) return;
      const body = await readBody(req);
      if (!user.emailCode || String(body.code || "").trim() !== user.emailCode.code) {
        return json(res, 400, { ok: false, error: "Invalid verification code" });
      }
      user.emailVerified = true;
      user.emailCode = null;
      saveDatabase();
      return json(res, 200, { ok: true, user: publicUser(user) });
    }

    if (method === "POST" && url.pathname === "/api/kyc") {
      const user = requireUser(req, res);
      if (!user) return;
      const body = await readBody(req);
      user.kyc = {
        status: "pending",
        legalName: String(body.legalName || "").trim(),
        dateOfBirth: String(body.dateOfBirth || "").trim(),
        address: String(body.address || "").trim(),
        city: String(body.city || "").trim(),
        state: String(body.state || "").trim(),
        postalCode: String(body.postalCode || "").trim(),
        country: String(body.country || "").trim(),
        idType: String(body.idType || "").trim(),
        idNumber: String(body.idNumber || "").trim(),
        proofOfAddress: String(body.proofOfAddress || "").trim(),
        identityNote: String(body.identityNote || "").trim(),
        submittedAt: new Date().toISOString()
      };
      saveDatabase();
      return json(res, 200, { ok: true, user: publicUser(user) });
    }

    if (method === "POST" && url.pathname === "/api/deposits") {
      const user = requireUser(req, res);
      if (!user) return;
      if (!state.system.deposits || !state.wallet.enabled || !state.wallet.address) {
        return json(res, 403, { ok: false, error: "Deposits are currently unavailable" });
      }
      const body = await readBody(req);
      const depositAmount = amount(body.amount);
      if (!depositAmount) return json(res, 400, { ok: false, error: "Valid amount required" });
      const deposit = {
        id: makeId("dep"),
        userId: user.id,
        amount: depositAmount,
        asset: state.wallet.asset,
        network: state.wallet.network,
        txReference: String(body.txReference || "").trim(),
        status: "pending",
        createdAt: new Date().toISOString()
      };
      state.deposits.push(deposit);
      saveDatabase();
      return json(res, 201, { ok: true, deposit });
    }

    if (method === "POST" && url.pathname === "/api/withdrawals/code") {
      const user = requireUser(req, res);
      if (!user) return;
      const code = String(crypto.randomInt(100000, 999999));
      user.withdrawalCode = { code, createdAt: new Date().toISOString() };
      saveDatabase();
      const delivery = await sendVerificationEmail(user.email, code, "withdrawal authorization");
      return json(res, 200, {
        ok: true,
        emailDelivery: delivery.sent,
        devCode: process.env.NODE_ENV === "production" ? undefined : code
      });
    }

    if (method === "POST" && url.pathname === "/api/withdrawals") {
      const user = requireUser(req, res);
      if (!user) return;
      if (!state.system.withdrawals) return json(res, 403, { ok: false, error: "Withdrawals are currently unavailable" });
      const body = await readBody(req);
      const withdrawalAmount = amount(body.amount);
      if (!withdrawalAmount) return json(res, 400, { ok: false, error: "Valid amount required" });
      if (withdrawalAmount > Number(user.balances.availableBalance || 0)) {
        return json(res, 400, { ok: false, error: "Amount exceeds available balance" });
      }
      if (!user.withdrawalCode || String(body.code || "").trim() !== user.withdrawalCode.code) {
        return json(res, 400, { ok: false, error: "Valid withdrawal code required" });
      }
      const methodName = String(body.method || "crypto").trim();
      const withdrawal = {
        id: makeId("wd"),
        userId: user.id,
        amount: withdrawalAmount,
        method: methodName,
        destination: methodName === "bank" ? {
          accountName: String(body.accountName || "").trim(),
          bankName: String(body.bankName || "").trim(),
          accountNumber: String(body.accountNumber || "").trim(),
          routingNumber: String(body.routingNumber || "").trim()
        } : {
          asset: String(body.asset || "").trim(),
          network: String(body.network || "").trim(),
          walletAddress: String(body.walletAddress || "").trim()
        },
        status: "pending",
        createdAt: new Date().toISOString()
      };
      user.withdrawalCode = null;
      state.withdrawals.push(withdrawal);
      saveDatabase();
      return json(res, 201, { ok: true, withdrawal });
    }

    if (method === "POST" && url.pathname === "/api/support") {
      const body = await readBody(req);
      const message = {
        id: makeId("msg"),
        name: String(body.name || "").trim(),
        email: String(body.email || "").trim(),
        message: String(body.message || "").trim(),
        status: "open",
        createdAt: new Date().toISOString()
      };
      state.supportMessages.push(message);
      saveDatabase();
      return json(res, 201, { ok: true, message });
    }

    if (method === "POST" && url.pathname === "/api/admin/login") {
      const body = await readBody(req);
      const goodUser = String(body.username || "") === String(process.env.ADMIN_USERNAME || "admin");
      const goodPass = String(body.password || "") === String(process.env.ADMIN_PASSWORD || "change-this-password");
      if (!goodUser || !goodPass) return json(res, 401, { ok: false, error: "Invalid admin credentials" });
      createSession(res, "admin", "env-admin");
      return json(res, 200, { ok: true });
    }

    if (method === "GET" && url.pathname === "/api/admin/overview") {
      if (!requireAdmin(req, res)) return;
      return json(res, 200, {
        ok: true,
        overview: adminOverview(),
        wallet: state.wallet,
        system: state.system,
        users: state.users.map(publicUser),
        deposits: state.deposits,
        withdrawals: state.withdrawals,
        supportMessages: state.supportMessages
      });
    }

    if (method === "PATCH" && url.pathname === "/api/admin/wallet") {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      state.wallet = {
        enabled: Boolean(body.enabled),
        asset: String(body.asset || "USDT").trim(),
        network: String(body.network || "TRC20").trim(),
        address: String(body.address || "").trim(),
        label: String(body.label || "Treasury Wallet").trim()
      };
      saveDatabase();
      return json(res, 200, { ok: true, wallet: state.wallet });
    }

    if (method === "PATCH" && url.pathname === "/api/admin/system") {
      if (!requireAdmin(req, res)) return;
      const body = await readBody(req);
      state.system = {
        deposits: Boolean(body.deposits),
        withdrawals: Boolean(body.withdrawals),
        investments: Boolean(body.investments),
        kyc: Boolean(body.kyc),
        support: Boolean(body.support)
      };
      saveDatabase();
      return json(res, 200, { ok: true, system: state.system });
    }

    const balanceMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/balances$/);
    if (method === "PATCH" && balanceMatch) {
      if (!requireAdmin(req, res)) return;
      const user = state.users.find((item) => item.id === balanceMatch[1]);
      if (!user) return json(res, 404, { ok: false, error: "User not found" });
      const body = await readBody(req);
      user.balances = {
        totalDeposits: Number(body.totalDeposits || 0),
        activeInvestments: Number(body.activeInvestments || 0),
        realizedProfit: Number(body.realizedProfit || 0),
        availableBalance: Number(body.availableBalance || 0),
        activeInvestmentCount: Number(body.activeInvestmentCount || 0)
      };
      if (typeof body.emailVerified === "boolean") user.emailVerified = body.emailVerified;
      if (body.kycStatus) user.kyc = { ...(user.kyc || {}), status: String(body.kycStatus) };
      saveDatabase();
      return json(res, 200, { ok: true, user: publicUser(user) });
    }

    const statusMatch = url.pathname.match(/^\/api\/admin\/(deposits|withdrawals|supportMessages)\/([^/]+)$/);
    if (method === "PATCH" && statusMatch) {
      if (!requireAdmin(req, res)) return;
      const collection = state[statusMatch[1]];
      const item = collection.find((entry) => entry.id === statusMatch[2]);
      if (!item) return json(res, 404, { ok: false, error: "Record not found" });
      const body = await readBody(req);
      item.status = String(body.status || item.status);
      item.updatedAt = new Date().toISOString();
      saveDatabase();
      return json(res, 200, { ok: true, item });
    }

    return json(res, 404, { ok: false, error: "API route not found" });
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message || "Server error" });
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  let filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") return json(res, 200, { ok: true });
  if (req.url.startsWith("/api/")) return handleApi(req, res);
  return serveStatic(req, res);
});

restoreRemoteBackup().finally(() => {
  server.listen(PORT, HOST, () => {
    console.log(`${SITE_NAME} listening on http://${HOST}:${PORT}`);
  });
});
