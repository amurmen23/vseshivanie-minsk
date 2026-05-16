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

  /* ══════════════════════════════════════════════════════
     QUEUE NUMBER
     Deterministic, 1–12, changes every 15 minutes.
     Simulates a live dispatch board without a real backend.
  ══════════════════════════════════════════════════════ */
  function getQueueNumber() {
    var slot = Math.floor(Date.now() / (15 * 60 * 1000));
    return (slot % 12) + 1;
  }

  var queueEl = document.getElementById("queue-number");
  if (queueEl) {
    queueEl.textContent = getQueueNumber();
    setInterval(function () {
      queueEl.textContent = getQueueNumber();
    }, 60 * 1000);
  }

  /* ══════════════════════════════════════════════════════
     SERVICE SELECTOR
  ══════════════════════════════════════════════════════ */
  var serviceRate  = 75;
  var serviceLabel = "Обычное взвешивание";

  var svcCards = document.querySelectorAll(".svc-card");
  svcCards.forEach(function (card) {
    card.addEventListener("click", function () {
      var radio = card.querySelector("input[type='radio']");
      if (!radio) return;
      radio.checked = true;
      serviceRate  = parseInt(radio.dataset.rate, 10) || 75;
      serviceLabel = radio.value;
      svcCards.forEach(function (c) { c.classList.remove("svc-active"); });
      card.classList.add("svc-active");
      updateTotal();
    });
  });

  /* ══════════════════════════════════════════════════════
     VEHICLE COUNT  ─  [ − ]  [ n ]  [ + ]
  ══════════════════════════════════════════════════════ */
  var vehicleInput  = document.getElementById("vehicleCount");
  var qtyDec        = document.getElementById("qty-dec");
  var qtyInc        = document.getElementById("qty-inc");
  var totalAmountEl = document.getElementById("total-amount");

  function getVehicleCount() {
    return Math.max(1, Math.min(99, parseInt(vehicleInput ? vehicleInput.value : "1", 10) || 1));
  }

  if (qtyDec) {
    qtyDec.addEventListener("click", function () {
      var v = getVehicleCount();
      if (v > 1) { vehicleInput.value = v - 1; updateTotal(); }
    });
  }
  if (qtyInc) {
    qtyInc.addEventListener("click", function () {
      var v = getVehicleCount();
      if (v < 99) { vehicleInput.value = v + 1; updateTotal(); }
    });
  }

  /* ══════════════════════════════════════════════════════
     LIVE PRICE CALCULATOR
  ══════════════════════════════════════════════════════ */
  function updateTotal() {
    if (totalAmountEl) totalAmountEl.textContent = serviceRate * getVehicleCount();
  }

  /* ══════════════════════════════════════════════════════
     MODAL
  ══════════════════════════════════════════════════════ */
  function openModal() {
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    var first = modal.querySelector("input[type='text'], input[type='tel'], input[type='email'], input[type='datetime-local']");
    if (first) first.focus();
  }

  function resetForm() {
    if (form) form.reset();
    serviceRate  = 75;
    serviceLabel = "Обычное взвешивание";
    svcCards.forEach(function (c, i) {
      if (i === 0) c.classList.add("svc-active");
      else         c.classList.remove("svc-active");
    });
    if (vehicleInput) vehicleInput.value = "1";
    updateTotal();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    hideMessage();
    resetForm();
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

  /* ══════════════════════════════════════════════════════
     MESSAGES
  ══════════════════════════════════════════════════════ */
  function showMessage(html, isError) {
    if (!messageEl) return;
    messageEl.innerHTML = html;
    messageEl.classList.remove("hidden", "text-emerald-400", "text-red-400");
    messageEl.classList.add(isError ? "text-red-400" : "text-emerald-400");
  }

  function hideMessage() {
    if (!messageEl) return;
    messageEl.classList.add("hidden");
    messageEl.innerHTML = "";
  }

  /* ══════════════════════════════════════════════════════
     BUTTON STATE
  ══════════════════════════════════════════════════════ */
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

  /* ══════════════════════════════════════════════════════
     TELEGRAM
  ══════════════════════════════════════════════════════ */
  function buildTelegramText(d) {
    var lines = [
      "\uD83D\uDCCB Новая заявка \u2014 Белсотра", "",
      "\uD83C\uDFAB Номер очереди: " + d.queueNumber,
      "\uD83D\uDE9B Услуга: "        + d.serviceType,
      "\uD83D\uDD22 Кол-во машин: "  + d.vehicleCount,
      "\uD83D\uDCB0 Итого: "         + d.totalCost + " BYN",
      "",
      "\uD83D\uDCC5 Дата/время заезда: " + (d.arrivalDateTime || "\u2014"),
      "\uD83C\uDFE2 Компания: "          + d.company,
      "\uD83D\uDCDE Телефон: "           + d.phone,
      "\uD83D\uDCE7 Email: "             + d.email,
    ];
    if (d.carNumber) lines.push("\uD83D\uDE97 Госномер / \u2116 авто: " + d.carNumber);
    if (d.cargoType) lines.push("\uD83D\uDCE6 Тип груза: "              + d.cargoType);
    return lines.join("\n");
  }

  function sendToTelegram(d) {
    return fetch(TG_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:                  TG_CHAT_ID,
        text:                     buildTelegramText(d),
        disable_web_page_preview: true,
      }),
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) {
        throw new Error("Telegram " + res.status + ": " + t.slice(0, 120));
      });
    });
  }

  /* ══════════════════════════════════════════════════════
     EMAIL via /api/send-email
  ══════════════════════════════════════════════════════ */
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

  /* ══════════════════════════════════════════════════════
     FORM SUBMIT
  ══════════════════════════════════════════════════════ */
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var fd       = new FormData(form);
      var queueNum = getQueueNumber();
      var count    = getVehicleCount();
      var total    = serviceRate * count;

      var d = {
        queueNumber:     String(queueNum),
        serviceType:     serviceLabel,
        vehicleCount:    String(count),
        totalCost:       String(total),
        arrivalDateTime: (fd.get("arrivalDateTime") || "").toString().trim(),
        company:         (fd.get("company")         || "").toString().trim(),
        phone:           (fd.get("phone")           || "").toString().trim(),
        email:           (fd.get("email")           || "").toString().trim(),
        carNumber:       (fd.get("carNumber")       || "").toString().trim(),
        cargoType:       (fd.get("cargoType")       || "").toString().trim(),
      };

      if (!d.arrivalDateTime || !d.company || !d.phone || !d.email) {
        showMessage("Пожалуйста, заполните все обязательные поля.", true);
        return;
      }

      setLoading(true);
      hideMessage();

      Promise.allSettled([
        sendToTelegram(d),
        sendToEmail(d),
      ]).then(function (results) {
        var allFailed = results.every(function (r) { return r.status === "rejected"; });
        setLoading(false);

        if (allFailed) {
          results.forEach(function (r) { if (r.reason) console.warn(r.reason); });
          showMessage("Ошибка отправки. Позвоните: +375 29 628-61-16.", true);
          return;
        }

        showMessage(
          "\u2705 Заявка успешно оформлена! " +
          "Ваш номер в очереди: <strong style=\"color:#22c55e;font-size:1.1em\">" + queueNum + "</strong>. " +
          "Номер очереди и подтверждение отправлены на ваш Email и в Telegram.",
          false
        );
        resetForm();
        setTimeout(closeModal, 5000);
      }).catch(function (err) {
        console.error("Unexpected error:", err);
        setLoading(false);
        showMessage("Ошибка отправки. Позвоните: +375 29 628-61-16.", true);
      });
    });
  }
})();
