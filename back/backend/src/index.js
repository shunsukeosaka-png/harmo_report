import crypto from "crypto";
import cors from "cors";
import express from "express";
import pg from "pg";

const { Pool } = pg;

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const APP_ORIGIN = process.env.APP_ORIGIN;
const ALLOWED_ORIGINS = (APP_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const LOGIN_ID = process.env.LOGIN_ID ?? "9999";
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD ?? "9999";
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "sid";
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 12);
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE ?? "Lax").trim();
const COOKIE_SECURE_RAW = (process.env.COOKIE_SECURE ?? "auto").trim().toLowerCase();
const SESSION_COOKIE_DOMAIN = (process.env.SESSION_COOKIE_DOMAIN ?? "").trim();

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (ALLOWED_ORIGINS.length === 0) {
  console.error("APP_ORIGIN is required (comma-separated allowed)");
  process.exit(1);
}

function parseBoolLike(value) {
  if (value === "1" || value === "true" || value === "yes" || value === "on") return true;
  if (value === "0" || value === "false" || value === "no" || value === "off") return false;
  return null;
}

const cookieSameSiteNormalized =
  COOKIE_SAMESITE.length > 0
    ? COOKIE_SAMESITE[0].toUpperCase() + COOKIE_SAMESITE.slice(1).toLowerCase()
    : "Lax";
const validSameSiteValues = new Set(["Lax", "Strict", "None"]);
if (!validSameSiteValues.has(cookieSameSiteNormalized)) {
  console.error("COOKIE_SAMESITE must be one of: Lax, Strict, None");
  process.exit(1);
}

const cookieSecureAuto = process.env.NODE_ENV === "production";
const cookieSecureExplicit = parseBoolLike(COOKIE_SECURE_RAW);
if (COOKIE_SECURE_RAW !== "auto" && cookieSecureExplicit === null) {
  console.error("COOKIE_SECURE must be one of: auto, true, false");
  process.exit(1);
}
const cookieSecure = COOKIE_SECURE_RAW === "auto" ? cookieSecureAuto : cookieSecureExplicit;
if (cookieSameSiteNormalized === "None" && !cookieSecure) {
  console.error("COOKIE_SAMESITE=None requires COOKIE_SECURE=true");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        if (idx < 0) return [part, ""];
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
}

function cookieBaseAttrs() {
  const attrs = ["Path=/", "HttpOnly", `SameSite=${cookieSameSiteNormalized}`];
  if (cookieSecure) {
    attrs.push("Secure");
  }
  if (SESSION_COOKIE_DOMAIN) {
    attrs.push(`Domain=${SESSION_COOKIE_DOMAIN}`);
  }
  return attrs.join("; ");
}

function setSessionCookie(res, token, expiresAt) {
  const maxAgeSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieBaseAttrs()}; Max-Age=${maxAgeSeconds}`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=; ${cookieBaseAttrs()}; Max-Age=0`);
}

async function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const ttlMs = Math.max(1, SESSION_TTL_HOURS) * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);
  await pool.query("INSERT INTO auth_sessions(id, user_id, expires_at) VALUES($1, $2, $3)", [
    sessionId,
    userId,
    expiresAt.toISOString(),
  ]);
  return { sessionId, expiresAt };
}

async function findActiveSession(sessionId) {
  const r = await pool.query(
    `
    SELECT id, user_id, expires_at
    FROM auth_sessions
    WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()
    LIMIT 1
    `,
    [sessionId]
  );
  return r.rows[0] ?? null;
}

async function revokeSession(sessionId) {
  await pool.query("UPDATE auth_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL", [
    sessionId,
  ]);
}

async function requireAuth(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies[SESSION_COOKIE_NAME];
    if (!sessionId) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const session = await findActiveSession(sessionId);
    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    req.auth = { userId: session.user_id, sessionId: session.id };
    next();
  } catch (e) {
    next(e);
  }
}

app.get("/health", async (_req, res) => {
  try {
    const r = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, db: r.rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post("/v1/auth/login", async (req, res) => {
  const { id, password } = req.body ?? {};

  if (typeof id !== "string" || typeof password !== "string") {
    return res.status(400).json({ ok: false, error: "id and password are required" });
  }

  if (id !== LOGIN_ID || password !== LOGIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: "invalid credentials" });
  }

  try {
    const { sessionId, expiresAt } = await createSession(id);
    setSessionCookie(res, sessionId, expiresAt);
    return res.json({ ok: true });
  } catch (e) {
    console.error("Failed to create session", e);
    return res.status(500).json({ ok: false, error: "session create failed" });
  }
});

app.get("/v1/auth/me", requireAuth, async (req, res) => {
  res.json({ ok: true, user_id: req.auth.userId });
});

app.post("/v1/auth/logout", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (sessionId) {
    await revokeSession(sessionId);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.post("/v1/customers", requireAuth, async (req, res) => {
  const { name } = req.body ?? {};
  if (!name || typeof name !== "string" || name.length > 200) {
    return res.status(400).json({ error: "name is required (<=200 chars)" });
  }
  const r = await pool.query("INSERT INTO customers(name) VALUES($1) RETURNING id, name, created_at", [
    name.trim(),
  ]);
  res.status(201).json(r.rows[0]);
});

app.get("/v1/customers", requireAuth, async (req, res) => {
  const q = (req.query.query ?? "").toString().trim();
  if (!q) {
    const r = await pool.query("SELECT id, name, created_at FROM customers ORDER BY id DESC LIMIT 50");
    return res.json({ items: r.rows });
  }
  const r = await pool.query(
    "SELECT id, name, created_at FROM customers WHERE name ILIKE $1 ORDER BY id DESC LIMIT 50",
    [`%${q}%`]
  );
  res.json({ items: r.rows });
});

app.post("/v1/visits", requireAuth, async (req, res) => {
  const { customer_id, visited_at, summary, body } = req.body ?? {};

  if (!Number.isInteger(customer_id)) {
    return res.status(400).json({ error: "customer_id must be integer" });
  }
  if (!summary || typeof summary !== "string" || summary.length > 200) {
    return res.status(400).json({ error: "summary is required (<=200 chars)" });
  }
  if (!body || typeof body !== "string" || body.length > 10000) {
    return res.status(400).json({ error: "body is required (<=10000 chars)" });
  }

  const visitedAtValue = visited_at ? new Date(visited_at) : new Date();
  if (Number.isNaN(visitedAtValue.getTime())) {
    return res.status(400).json({ error: "visited_at is invalid date" });
  }

  const r = await pool.query(
    `INSERT INTO visits(customer_id, visited_at, summary, body)
     VALUES($1, $2, $3, $4)
     RETURNING id, customer_id, visited_at, summary, body, created_at`,
    [customer_id, visitedAtValue.toISOString(), summary.trim(), body]
  );

  res.status(201).json(r.rows[0]);
});

app.get("/v1/visits", requireAuth, async (req, res) => {
  const customerId = req.query.customer_id ? Number(req.query.customer_id) : null;
  const from = req.query.from ? new Date(req.query.from.toString()) : null;
  const to = req.query.to ? new Date(req.query.to.toString()) : null;

  const where = [];
  const params = [];
  let i = 1;

  if (customerId && Number.isFinite(customerId)) {
    where.push(`v.customer_id = $${i++}`);
    params.push(customerId);
  }
  if (from && !Number.isNaN(from.getTime())) {
    where.push(`v.visited_at >= $${i++}`);
    params.push(from.toISOString());
  }
  if (to && !Number.isNaN(to.getTime())) {
    where.push(`v.visited_at < $${i++}`);
    params.push(to.toISOString());
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const r = await pool.query(
    `
    SELECT
      v.id, v.customer_id, c.name AS customer_name,
      v.visited_at, v.summary, v.body, v.created_at
    FROM visits v
    JOIN customers c ON c.id = v.customer_id
    ${whereSql}
    ORDER BY v.visited_at DESC
    LIMIT 100
    `,
    params
  );

  res.json({ items: r.rows });
});

app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
  console.log(`CORS origins allowed: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(
    `Session cookie settings: SameSite=${cookieSameSiteNormalized}, Secure=${cookieSecure}, Domain=${SESSION_COOKIE_DOMAIN || "(none)"}`
  );
});
