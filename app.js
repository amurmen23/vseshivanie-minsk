(function () {
  var TG_TOKEN   = "8866127264:AAHR2WV8YmJ37yEPZEUQW32fS4Ztx_vJslU";
  var TG_CHAT_ID = "971858829";
  var TG_URL     = "https://api.telegram.org/bot" + TG_TOKEN + "/sendMessage";

  var modal     = document.getElementById("order-modal");
  var form      = document.getElementById("order-form");
  var messageEl = document.getElementById("form-message");
  var submitBtn = document.getElementById("submit-btn");
  var yearEl    = document.getElementById("year");

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ── Modal open / close ── */
  function openModal() {
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    var first = modal.querySelector('input[type="text"]');
    if (first) first.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    hideMessage();
    if (form) form.reset();
  }

  document.querySelectorAll("[data-open-modal]").forEach(function (btn) {
    btn.addEventListener("click", openModal);
  });
  document.querySelectorAll("[data-close-modal]").forEach(function (btn) {
    btn.addEventListener("click", closeModal);
  });

  var backdrop = modal && modal.querySelector("[data-modal-backdrop]");
  if (backdrop) backdrop.addEventListener("click", closeModal);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) closeModal();
  });

  /* ── Messages ── */
  function showMessage(text, isError) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.classList.remove("hidden", "text-emerald-400", "text-red-400");
    messageEl.classList.add(isError ? "text-red-400" : "text-emerald-400");
  }

  function hideMessage() {
    if (!messageEl) return;
    messageEl.classList.add("hidden");
    messageEl.textContent = "";
  }

  /* ── Submit button loading state ── */
  var SPINNER =
    '<svg class="inline-block animate-spin mr-2" style="width:16px;height:16px;vertical-align:-3px" fill="none" viewBox="0 0 24 24">' +
    '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
    '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>' +
    "Отправка…";

  function setLoading(on) {
    if (!submitBtn) return;
    submitBtn.disabled = on;
    submitBtn.innerHTML = on ? SPINNER : "Отправить заявку";
  }

  /* ── Telegram ── */
  function buildTelegramText(company, phone, carNumber, cargoType) {
    var lines = [
      "<b>📋 Новая заявка — Белсотра</b>",
      "",
      "<b>Компания:</b> " + company,
      "<b>Телефон:</b> "  + phone,
    ];
    if (carNumber)  lines.push("<b>Госномер / № авто:</b> " + carNumber);
    if (cargoType)  lines.push("<b>Тип груза:</b> "         + cargoType);
    return lines.join("\n");
  }

  async function sendToTelegram(company, phone, carNumber, cargoType) {
    var res = await fetch(TG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text: buildTelegramText(company, phone, carNumber, cargoType),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) throw new Error("Telegram " + res.status);
  }

  /* ── Email via Vercel serverless function ── */
  async function sendToEmail(company, phone, carNumber, cargoType) {
    var res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company:   company,
        phone:     phone,
        carNumber: carNumber,
        cargoType: cargoType,
      }),
    });
    if (!res.ok) {
      var body = await res.json().catch(function () { return {}; });
      throw new Error(body.error || "Email API " + res.status);
    }
  }

  /* ── Form submit ── */
  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var fd        = new FormData(form);
      var company   = (fd.get("company")   || "").toString().trim();
      var phone     = (fd.get("phone")     || "").toString().trim();
      var carNumber = (fd.get("carNumber") || "").toString().trim();
      var cargoType = (fd.get("cargoType") || "").toString().trim();

      if (!company || !phone) {
        showMessage("Заполните название компании и телефон.", true);
        return;
      }

      setLoading(true);
      hideMessage();

      /* Send to Telegram first, then email (both non-blocking failures) */
      var tgError    = null;
      var emailError = null;

      try { await sendToTelegram(company, phone, carNumber, cargoType); }
      catch (err) { tgError = err; console.warn("Telegram:", err); }

      try { await sendToEmail(company, phone, carNumber, cargoType); }
      catch (err) { emailError = err; console.warn("Email:", err); }

      setLoading(false);

      if (tgError && emailError) {
        showMessage("Ошибка отправки. Позвоните: +375 29 628-61-16.", true);
        return;
      }

      showMessage("Заявка отправлена! Мы свяжемся с вами.", false);
      form.reset();
      setTimeout(closeModal, 2500);
    });
  }
})();
