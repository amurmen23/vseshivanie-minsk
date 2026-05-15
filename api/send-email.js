const { Resend } = require("resend");

/**
 * POST /api/send-email
 * Body JSON: { company, phone, carNumber, cargoType }
 *
 * Required env var (set in Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY — API-ключ из https://resend.com/api-keys
 */
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { company, phone, carNumber, cargoType } = req.body || {};

  if (!company || !phone) {
    return res.status(400).json({ error: "Поля company и phone обязательны" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not set");
    return res.status(500).json({ error: "Почтовый сервис не настроен" });
  }

  const rows = [
    ["Компания",          company],
    ["Телефон",           phone],
    carNumber  ? ["Госномер / № авто", carNumber]  : null,
    cargoType  ? ["Тип груза",          cargoType]  : null,
  ]
    .filter(Boolean)
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:12px 20px;font-size:13px;font-weight:700;color:#6b7280;
                   text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;
                   border-bottom:1px solid #e5e7eb;width:40%">${label}</td>
        <td style="padding:12px 20px;font-size:15px;color:#111827;
                   border-bottom:1px solid #e5e7eb">${value}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:580px;margin:40px auto 60px;background:#ffffff;
              border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.10);">

    <!-- Header -->
    <div style="background:#030b15;padding:30px 32px 26px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;
                color:#22c55e;text-transform:uppercase;">Станция взвешивания · Белсотра</p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3">
        Новая заявка на взвешивание
      </h1>
    </div>

    <!-- Table -->
    <div style="padding:8px 0;">
      <table style="width:100%;border-collapse:collapse;">
        ${rows}
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
        Заявка поступила с сайта <strong>Белсотра</strong> (rudolf.by).<br>
        Свяжитесь с клиентом как можно скорее.
      </p>
    </div>

  </div>
</body>
</html>`;

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: "Белсотра Лендинг <onboarding@resend.dev>",
    to:   "bs.scale@rudolf.by",
    subject: "Новая заявка на взвешивание",
    html,
  });

  if (error) {
    console.error("Resend error:", error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
};
