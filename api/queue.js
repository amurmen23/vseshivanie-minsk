/**
 * GET  /api/queue?slot=YYYY-MM-DD_H_B  → { slot, next: N }   peek (no increment)
 * POST /api/queue  { slot }             → { slot, number: N } claim (atomic INCR)
 *
 * Slot format: YYYY-MM-DD_H_B
 *   H = hour 0-23
 *   B = 20-min block  (0 = :00-:19 | 1 = :20-:39 | 2 = :40-:59)
 *
 * Storage: Vercel KV (Upstash REST API).
 *   Required env vars — set automatically when you connect a KV store
 *   in the Vercel dashboard (Storage → Create → KV → Connect to project):
 *     KV_REST_API_URL   — e.g. https://YOUR.upstash.io
 *     KV_REST_API_TOKEN — your rest token
 *
 *   No npm package is needed — we talk to the Upstash REST API directly
 *   via native fetch, which is always available in Vercel Node runtime.
 *
 *   Graceful fallback: if env vars are absent, returns 1 (no persistent data).
 *   The client also mirrors counters in localStorage as an extra safety net.
 */

const KV_URL   = () => process.env.KV_REST_API_URL;
const KV_TOKEN = () => process.env.KV_REST_API_TOKEN;
const KV_OK    = () => !!(KV_URL() && KV_TOKEN());

function kvKey(slot) { return "bls:queue:" + slot; }

/**
 * GET /get/<key>  → { result: "N" | null }
 */
async function kvGet(key) {
  if (!KV_OK()) return 0;
  const r = await fetch(KV_URL() + "/get/" + encodeURIComponent(key), {
    headers: { Authorization: "Bearer " + KV_TOKEN() },
  });
  if (!r.ok) throw new Error("KV GET " + r.status);
  const { result } = await r.json();
  return parseInt(result || "0", 10);
}

/**
 * POST /incr/<key>  → { result: N }   (atomic, returns new value)
 */
async function kvIncr(key) {
  if (!KV_OK()) return 1;
  const r = await fetch(KV_URL() + "/incr/" + encodeURIComponent(key), {
    method:  "POST",
    headers: { Authorization: "Bearer " + KV_TOKEN() },
  });
  if (!r.ok) throw new Error("KV INCR " + r.status);
  const { result } = await r.json();
  return parseInt(result, 10);
}

/* ── handler ── */
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    /* ── peek ── */
    if (req.method === "GET") {
      const { slot } = req.query;
      if (!slot) return res.status(400).json({ error: "slot required" });
      const count = await kvGet(kvKey(slot));
      return res.status(200).json({ slot, next: count + 1, kv: KV_OK() });
    }

    /* ── claim ── */
    if (req.method === "POST") {
      const { slot } = req.body || {};
      if (!slot) return res.status(400).json({ error: "slot required" });
      const number = await kvIncr(kvKey(slot));
      return res.status(200).json({ slot, number, kv: KV_OK() });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("queue handler error:", e.message);
    return res.status(500).json({ error: e.message, number: 1, next: 1 });
  }
};
