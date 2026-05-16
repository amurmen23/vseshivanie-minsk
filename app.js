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
     TIME-SLOT QUEUE  (LocalStorage)

     Key format:  bls_q_YYYY_M_D_H_B
       where B = 20-min block (0 = :00-:19, 1 = :20-:39, 2 = :40-:59)

     peekQueue(key)  → next available number (read-only)
     claimQueue(key) → assigns and increments (call on submit)
  ══════════════════════════════════════════════════════ */
  function slotKey(date) {
    var d = (date instanceof Date) ? date : (date ? new Date(date) : new Date());
    if (isNaN(d.getTime())) d = new Date();
    return [
      "bls_q",
      d.getFullYear(),
      d.getMonth() + 1,
      d.getDate(),
      d.getHours(),
      Math.floor(d.getMinutes() / 20),
    ].join("_");
  }

  function peekQueue(key) {
    try { return (parseInt(localStorage.getItem(key) || "0", 10)) + 1; }
    catch (e) { return 1; }
  }

  function claimQueue(key) {
    try {
      var n = peekQueue(key);
      localStorage.setItem(key, String(n));
      return n;
    } catch (e) { return 1; }
  }

  /* ── Navbar queue widget (current slot) ── */
  var queueEl = document.getElementById("queue-number");
  function refreshQueueWidget() {
    if (queueEl) queueEl.textContent = peekQueue(slotKey(null));
  }
  refreshQueueWidget();
  setInterval(refreshQueueWidget, 60 * 1000);

  /* ── Form queue preview (based on selected datetime) ── */
  var arrivalInput   = document.getElementById("arrivalDateTime");
  var queuePreviewEl = document.getElementById("queue-preview");
  var queuePreviewNum= document.getElementById("queue-preview-num");

  if (arrivalInput) {
    arrivalInput.addEventListener("change", function () {
      if (!this.value) {
        if (queuePreviewEl) queuePreviewEl.classList.add("hidden");
        return;
      }
      var n = peekQueue(slotKey(this.value));
      if (queuePreviewNum) queuePreviewNum.textContent = "#" + n;
      if (queuePreviewEl) queuePreviewEl.classList.remove("hidden");
    });
  }

  /* ══════════════════════════════════════════════════════
     DUAL-SERVICE COUNTERS
  ══════════════════════════════════════════════════════ */
  var qtyW = document.getElementById("qty-weighing");  // Взвешивание
  var qtyM = document.getElementById("qty-mcvtc");     // МСВТС
  var cardW = document.getElementById("card-weighing");
  var cardM = document.getElementById("card-mcvtc");
  var totalBlock = document.getElementById("total-block");
  var totalAmountEl = document.getElementById("total-amount");

  function getQty(el) {
    return Math.max(0, Math.min(99, parseInt(el ? el.value : "0", 10) || 0));
  }

  function makeCounter(decId, incId, inputEl, cardEl) {
    var dec = document.getElementById(decId);
    var inc = document.getElementById(incId);
    if (dec) dec.addEventListener("click", function () {
      var v = getQty(inputEl);
      if (v > 0) { inputEl.value = v - 1; onCounterChange(); }
    });
    if (inc) inc.addEventListener("click", function () {
      var v = getQty(inputEl);
      if (v < 99) { inputEl.value = v + 1; onCounterChange(); }
    });
  }

  makeCounter("dec-weighing", "inc-weighing", qtyW, cardW);
  makeCounter("dec-mcvtc",    "inc-mcvtc",    qtyM, cardM);

  function onCounterChange() {
    var w = getQty(qtyW);
    var m = getQty(qtyM);

    /* Card highlight */
    if (cardW) cardW.classList.toggle("svc-active", w > 0);
    if (cardM) cardM.classList.toggle("svc-active", m > 0);

    /* Итого */
    var total = w * 75 + m * 90;
    if (totalAmountEl) totalAmountEl.textContent = total;
    if (totalBlock) totalBlock.classList.toggle("hidden", total === 0);

    /* Submit button */
    if (submitBtn && !submitBtn.dataset.loading) {
      submitBtn.disabled = (total === 0);
    }
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
  }

  function hardReset() {
    if (form) form.reset();
    if (qtyW) qtyW.value = "0";
    if (qtyM) qtyM.value = "0";
    if (cardW) cardW.classList.remove("svc-active");
    if (cardM) cardM.classList.remove("svc-active");
    if (totalBlock) totalBlock.classList.add("hidden");
    if (queuePreviewEl) queuePreviewEl.classList.add("hidden");
    if (submitBtn) { submitBtn.disabled = true; delete submitBtn.dataset.loading; }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    hideMessage();
    hardReset();
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
    if (on) submitBtn.dataset.loading = "1";
    else    delete submitBtn.dataset.loading;
  }

  /* ══════════════════════════════════════════════════════
     TELEGRAM
  ══════════════════════════════════════════════════════ */
  function buildTelegramText(d) {
    var lines = [
      "\uD83D\uDCCB Новая заявка \u2014 Белсотра", "",
      "\uD83C\uDFAB Номер очереди: " + d.queueNumber,
    ];
    if (parseInt(d.qtyWeighing, 10) > 0)
      lines.push("\uD83D\uDE9B Обычное взвешивание: " + d.qtyWeighing + " авт. \xd7 75 = " + d.totalWeighing + " BYN");
    if (parseInt(d.qtyMcvtc, 10) > 0)
      lines.push("\uD83D\uDCC4 Оформление МСВТС: " + d.qtyMcvtc + " авт. \xd7 90 = " + d.totalMcvtc + " BYN");
    lines.push("\uD83D\uDCB0 ИТОГО: " + d.totalCost + " BYN");
    lines.push("");
    lines.push("\uD83D\uDCC5 Дата/время заезда: " + (d.arrivalDateTime || "\u2014"));
    lines.push("\uD83C\uDFE2 Компания: " + d.company);
    lines.push("\uD83D\uDCDE Телефон: "  + d.phone);
    lines.push("\uD83D\uDCE7 Email: "    + d.email);
    if (d.carNumber) lines.push("\uD83D\uDE97 Госномер: " + d.carNumber);
    if (d.cargoType) lines.push("\uD83D\uDCE6 Тип груза: " + d.cargoType);
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

      var fd  = new FormData(form);
      var w   = getQty(qtyW);
      var m   = getQty(qtyM);
      var total = w * 75 + m * 90;

      if (total === 0) {
        showMessage("Выберите хотя бы одну услугу (количество машин > 0).", true);
        return;
      }

      var arrivalVal = (fd.get("arrivalDateTime") || "").toString().trim();
      var key        = slotKey(arrivalVal || null);
      var queueNum   = claimQueue(key); // assign and save

      var d = {
        queueNumber:     String(queueNum),
        qtyWeighing:     String(w),
        totalWeighing:   String(w * 75),
        qtyMcvtc:        String(m),
        totalMcvtc:      String(m * 90),
        totalCost:       String(total),
        arrivalDateTime: arrivalVal,
        company:         (fd.get("company")   || "").toString().trim(),
        phone:           (fd.get("phone")     || "").toString().trim(),
        email:           (fd.get("email")     || "").toString().trim(),
        carNumber:       (fd.get("carNumber") || "").toString().trim(),
        cargoType:       (fd.get("cargoType") || "").toString().trim(),
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

        /* Refresh navbar widget after claiming a slot */
        refreshQueueWidget();

        showMessage(
          "\u2705 Заявка успешно оформлена! " +
          "Ваш номер в очереди: <strong style=\"color:#22c55e;font-size:1.15em\">" + queueNum + "</strong>. " +
          "Номер очереди и подтверждение отправлены на ваш Email и в Telegram.",
          false
        );
        hardReset();
        setTimeout(closeModal, 5500);
      }).catch(function (err) {
        console.error("Unexpected error:", err);
        setLoading(false);
        showMessage("Ошибка отправки. Позвоните: +375 29 628-61-16.", true);
      });
    });
  }
})();
