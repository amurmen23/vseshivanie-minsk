/**
 * GET  /api/queue?slot=...  → { slot, next: N }   peek (no write)
 * POST /api/queue { slot }  → { slot, number: N } claim (atomic INCR)
 *
 * Storage: Vercel KV — Upstash Redis REST API.
 *   Vercel auto-sets these when you connect a KV store to the project:
 *     KV_REST_API_URL   – Upstash REST endpoint (no trailing slash needed)
 *     KV_REST_API_TOKEN – write token
 *
 *   Key format in Redis: bls:queue:YYYY-MM-DD_HH:MM
 *     where HH:MM is the start of the 20-min slot (e.g. 08:00 | 08:20 | 08:40)
 *
 *   Fallback: when env vars are absent, returns { next: 1 } / { number: 1 }
 *   so the front-end never breaks.
 */

/* ── Upstash REST helper ─────────────────────────────────────────────────── */

function kvBase() {
  const url = process.env.KV_REST_API_URL || "";
  return url.replace(/\/+$/, ""); // strip trailing slashes
}

function kvToken() {
  return process.env.KV_REST_API_TOKEN || "";
}

function kvReady() {
  const ready = !!(kvBase() && kvToken());
  if (!ready) {
    console.warn("[queue] KV_REST_API_URL or KV_REST_API_TOKEN is not set — using fallback");
  }
  return ready;
}

/**
 * Execute a single Redis command via Upstash REST API.
 * POST to the root endpoint with JSON body ["COMMAND", "arg1", ...]
 * Returns the `result` field from the response.
 */
async function upstash(command) {
  const base  = kvBase();
  const token = kvToken();
  console.log("[queue] upstash cmd:", command[0], command[1]);

  const res = await fetch(base, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(command),
  });

  const text = await res.text();
  console.log("[queue] upstash response:", res.status, text.slice(0, 200));

  if (!res.ok) {
    throw new Error("Upstash HTTP " + res.status + ": " + text.slice(0, 300));
  }

  let data;
  try { data = JSON.parse(text); } catch (_) {
    throw new Error("Upstash non-JSON response: " + text.slice(0, 100));
  }

  if (data.error) throw new Error("Upstash error: " + data.error);
  return data.result;
}

async function kvGet(key) {
  const result = await upstash(["GET", key]);
  return parseInt(result || "0", 10);
}

async function kvIncr(key) {
  const result = await upstash(["INCR", key]);
  return parseInt(String(result), 10);
}

/* ── Slot key ─────────────────────────────────────────────────────────────── */

/**
 * Build a slot key from a datetime string or Date.
 * Rounds minutes down to the nearest 20-min boundary (0, 20, or 40).
 * Returns: "YYYY-MM-DD_HH:MM"  e.g. "2026-05-17_08:40"
 */
function buildSlotKey(input) {
  const d = input ? new Date(input) : new Date();
  if (isNaN(d.getTime())) return buildSlotKey(null);

  const y   = d.getFullYear();
  const mo  = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh  = String(d.getHours()).padStart(2, "0");
  const mm  = String(Math.floor(d.getMinutes() / 20) * 20).padStart(2, "0");
  return `${y}-${mo}-${day}_${hh}:${mm}`;
}

function redisKey(slot) { return "bls:queue:" + slot; }

/* ── Handler ──────────────────────────────────────────────────────────────── */

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    /* ── peek ── */
    if (req.method === "GET") {
      const rawSlot = req.query.slot || "";
      // Accept either a pre-built slot key or a raw datetime string
      const slot = rawSlot.includes("_") ? rawSlot : buildSlotKey(rawSlot);
      console.log("[queue] GET peek slot:", slot);

      if (!kvReady()) {
        return res.status(200).json({ slot, result: 1, kv: false });
      }
      const count = await kvGet(redisKey(slot));
      return res.status(200).json({ slot, result: count + 1, kv: true });
    }

    /* ── claim ── */
    if (req.method === "POST") {
      const body    = req.body || {};
      const rawSlot = body.slot || body.arrivalDateTime || "";
      const slot    = rawSlot.includes("_") ? rawSlot : buildSlotKey(rawSlot);
      console.log("[queue] POST claim slot:", slot);

      if (!kvReady()) {
        return res.status(200).json({ slot, result: 1, kv: false });
      }
      const number = await kvIncr(redisKey(slot));
      return res.status(200).json({ slot, result: number, kv: true });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (e) {
    console.error("[queue] handler error:", e.message);
    // Always return a usable fallback so the form doesn't break
    return res.status(200).json({
      error:  e.message,
      result: 1,
      kv:     false,
    });
  }
};
