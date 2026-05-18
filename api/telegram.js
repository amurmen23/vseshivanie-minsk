/**
 * POST /api/telegram
 * Body JSON: { text: string }
 *
 * Env (Vercel): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const text = (req.body && req.body.text) || "";

  if (!token || !chatId) {
    console.error("Telegram environment variables are missing");
    return res.status(500).json({ error: "Server configuration error" });
  }

  if (!String(text).trim()) {
    return res.status(400).json({ error: "Missing text" });
  }

  try {
    const tgUrl = "https://api.telegram.org/bot" + token + "/sendMessage";
    const response = await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error("Telegram API error: " + response.status + " — " + errText.slice(0, 200));
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to send to Telegram:", error);
    return res.status(500).json({ error: error.message || "Telegram send failed" });
  }
};
