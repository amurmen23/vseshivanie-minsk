/**
 * GET  /api/queue?slot=YYYY-MM-DD_H_B  → { slot, next: N }   peek (no increment)
 * POST /api/queue  { slot }             → { slot, number: N } claim (atomic INCR)
 *
 * Slot format: YYYY-MM-DD_H_B
 *   H = hour 0-23
 *   B = 20-min block (0 = :00-:19,  1 = :20-:39,  2 = :40-:59)
 *
 * Storage: Vercel KV (@vercel/kv).
 *   Env vars set automatically when you connect a KV DB in the Vercel dashboard:
 *     KV_REST_API_URL, KV_REST_API_TOKEN (+ read-only variant)
 *
 *   If KV is not configured the endpoint still works:
 *     GET  → { next: 1 }   (no persistent data available)
 *     POST → { number: 1 } (same)
 *   The client keeps a localStorage mirror as a same-browser fallback.
 */

let kv = null;
try {
  // Will throw at runtime if package is not installed
  kv = require("@vercel/kv").kv;
} catch (_) {}

const KV_AVAILABLE = () =>
  kv !== null &&
  process.env.KV_REST_API_URL &&
  process.env.KV_REST_API_TOKEN;

/* ── helpers ── */
function kvKey(slot) { return "queue:" + slot; }

async function peek(slot) {
  if (!KV_AVAILABLE()) return 0;
  try {
    const val = await kv.get(kvKey(slot));
    return parseInt(val || "0", 10);
  } catch (e) {
    console.error("KV get error:", e.message);
    return 0;
  }
}

async function claim(slot) {
  if (!KV_AVAILABLE()) return 1;
  try {
    return await kv.incr(kvKey(slot)); // atomic, returns new value
  } catch (e) {
    console.error("KV incr error:", e.message);
    return 1;
  }
}

/* ── handler ── */
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    const { slot } = req.query;
    if (!slot) return res.status(400).json({ error: "slot required" });
    const count = await peek(slot);
    return res.status(200).json({ slot, next: count + 1, kv: KV_AVAILABLE() });
  }

  if (req.method === "POST") {
    const { slot } = req.body || {};
    if (!slot) return res.status(400).json({ error: "slot required" });
    const number = await claim(slot);
    return res.status(200).json({ slot, number, kv: KV_AVAILABLE() });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
