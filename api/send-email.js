const nodemailer = require("nodemailer");

/**
 * POST /api/send-email
 * Body JSON: { company, phone, carNumber, email }
 *
 * Required env vars (set in Vercel project settings):
 *   SMTP_HOST   — e.g. mail.rudolf.by
 *   SMTP_PORT   — e.g. 465 (SSL) or 587 (STARTTLS)
 *   SMTP_SECURE — "true" for port 465, "false" for 587
 *   SMTP_USER   — full login, e.g. bs.scale@rudolf.by
 *   SMTP_PASS   — application password
 *   MAIL_TO     — recipient, defaults to bs.scale@rudolf.by
 */
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { company, phone, carNumber, email } = req.body || {};

  if (!company || !phone) {
    return res.status(400).json({ error: "Поля company и phone обязательны" });
  }

  const {
    SMTP_HOST,
    SMTP_PORT = "465",
    SMTP_SECURE = "true",
    SMTP_USER,
    SMTP_PASS,
    MAIL_TO = "bs.scale@rudolf.by",
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error("SMTP env vars missing");
    return res.status(500).json({ error: "Почтовый сервер не настроен" });
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const rows = [
    ["Компания", company],
    ["Телефон", phone],
    carNumber ? ["Госномер / № авто", carNumber] : null,
    email ? ["Email", `<a href="mailto:${email}">${email}</a>`] : null,
  ]
    .filter(Boolean)
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:10px 16px;font-weight:600;color:#6b7280;white-space:nowrap;border-bottom:1px solid #e5e7eb;">${label}</td>
          <td style="padding:10px 16px;color:#111827;border-bottom:1px solid #e5e7eb;">${value}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#030b15;padding:28px 32px;">
      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;color:#22c55e;text-transform:uppercase;">Станция взвешивания</p>
      <h1 style="margin:8px 0 0;font-size:22px;color:#ffffff;">Новая заявка с лендинга</h1>
    </div>
    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;font-size:15px;">
        ${rows}
      </table>
    </div>
    <div style="padding:16px 32px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Заявка отправлена с сайта Белсотра. Ответьте клиенту на указанный email или по телефону.
      </p>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"Лендинг Белсотра" <${SMTP_USER}>`,
      to: MAIL_TO,
      subject: `Заявка: взвешивание — ${company}`,
      html,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("sendMail error:", err);
    return res.status(500).json({ error: "Ошибка отправки письма" });
  }
};
