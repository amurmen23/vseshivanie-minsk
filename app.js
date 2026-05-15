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

  /* ── HTML-escape: prevents Telegram 400 from special chars in user input ── */
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ── Modal ── */
  function openModal() {
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    var first = modal.querySelector("input, select");
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

  /* ── Button state ── */
  var SPINNER =
    '<svg class="inline-block animate-spin mr-2" style="width:16px;height:16px;vertical-align:-3px"' +
    ' fill="none" viewBox="0 0 24 24">' +
    '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
    '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>' +
    "Отправка\u2026";

  function setLoading(on) {
    if (!submitBtn) return;
    submitBtn.disabled = on;
    submitBtn.innerHTML = on ? SPINNER : "Отправить заявку";
  }

  /* ── Telegram (parse_mode HTML + escaped user data) ── */
  function buildTelegramText(d) {
    var lines = [
      "<b>\uD83D\uDCCB Новая заявка \u2014 Белсотра</b>", "",
      "<b>Компания:</b> "           + esc(d.company),
      "<b>Телефон:</b> "            + esc(d.phone),
    ];
    if (d.weighingsCount) lines.push("<b>Кол-во взвешиваний:</b> " + esc(d.weighingsCount));
    if (d.carNumber)      lines.push("<b>Госномер / № авто:</b> "  + esc(d.carNumber));
    if (d.cargoType)      lines.push("<b>Тип груза:</b> "          + esc(d.cargoType));
    if (d.email)          lines.push("<b>Email:</b> "              + esc(d.email));
    return lines.join("\n");
  }

  function sendToTelegram(d) {
    return fetch(TG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:                 TG_CHAT_ID,
        text:                    buildTelegramText(d),
        parse_mode:              "HTML",
        disable_web_page_preview: true,
      }),
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) {
        throw new Error("Telegram " + res.status + ": " + t.slice(0, 120));
      });
    });
  }

  /* ── Email via /api/send-email ── */
  function sendToEmail(d) {
    return fetch("/api/send-email", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(d),
    }).then(function (res) {
      if (!res.ok) return res.json()
        .catch(function () { return {}; })
        .then(function (b) { throw new Error(b.error || "Email API " + res.status); });
    });
  }

  /* ── Form submit ── */
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var fd = new FormData(form);
      var d  = {
        company:        (fd.get("company")        || "").toString().trim(),
        phone:          (fd.get("phone")          || "").toString().trim(),
        weighingsCount: (fd.get("weighingsCount") || "").toString().trim(),
        carNumber:      (fd.get("carNumber")      || "").toString().trim(),
        cargoType:      (fd.get("cargoType")      || "").toString().trim(),
        email:          (fd.get("email")          || "").toString().trim(),
      };

      if (!d.company || !d.phone || !d.weighingsCount) {
        showMessage("Заполните компанию, телефон и количество взвешиваний.", true);
        return;
      }

      /* Block button immediately — synchronous, before any async work */
      setLoading(true);
      hideMessage();

      /* Fire both requests in parallel; allSettled never throws */
      Promise.allSettled([
        sendToTelegram(d),
        sendToEmail(d),
      ])
        .then(function (results) {
          var allFailed = results.every(function (r) { return r.status === "rejected"; });

          setLoading(false);

          if (allFailed) {
            results.forEach(function (r) { if (r.reason) console.warn(r.reason); });
            showMessage("Ошибка отправки. Позвоните: +375 29 628-61-16.", true);
            return;
          }

          showMessage("Заявка отправлена! Мы свяжемся с вами.", false);
          form.reset();
          setTimeout(closeModal, 2500);
        })
        .catch(function (err) {
          /* Safety net — should never be reached with allSettled */
          console.error("Unexpected error:", err);
          setLoading(false);
          showMessage("Ошибка отправки. Позвоните: +375 29 628-61-16.", true);
        });
    });
  }
})();
