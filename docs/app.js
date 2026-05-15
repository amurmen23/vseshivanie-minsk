/**
 * Конфигурация уведомлений
 * -------------------------
 * Email: заявки уходят на bs.scale@rudolf.by через FormSubmit (без своего бэкенда).
 * При первом использовании FormSubmit отправит письмо для подтверждения на этот ящик.
 *
 * Telegram (опционально):
 * 1. Создайте бота у @BotFather, вставьте токен в TELEGRAM_BOT_API_KEY.
 * 2. Узнайте chat_id (например, через @userinfobot или getUpdates) — в TELEGRAM_CHAT_ID.
 */
const CONFIG = {
  /** Почта получателя заявок */
  ORDER_EMAIL: "bs.scale@rudolf.by",
  /**
   * Endpoint FormSubmit (AJAX: JSON или multipart с вложениями).
   * @see https://formsubmit.co/ajax/
   */
  FORMSUBMIT_AJAX: "https://formsubmit.co/ajax/bs.scale@rudolf.by",
  /**
   * Токен Telegram-бота (строка вида "123456:ABC-DEF...").
   * Оставьте пустым — запросы к Telegram не выполняются.
   */
  TELEGRAM_BOT_API_KEY: "",
  /**
   * ID чата или канала для уведомлений (число или строка, например "-100123..." для группы).
   */
  TELEGRAM_CHAT_ID: "",
};

/** Лимиты вложений к заявке */
const ATTACH_LIMITS = {
  maxFiles: 5,
  maxBytesPerFile: 10 * 1024 * 1024,
};

(function () {
  const modal = document.getElementById("order-modal");
  const form = document.getElementById("order-form");
  const messageEl = document.getElementById("form-message");
  const submitBtn = document.getElementById("submit-btn");
  const yearEl = document.getElementById("year");
  const fileInput = document.getElementById("order-file-input");
  const attachBtn = document.getElementById("order-attach-btn");
  const filesListEl = document.getElementById("order-files-list");

  /** @type {File[]} */
  let orderAttachmentFiles = [];

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  function openModal() {
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const firstInput = modal.querySelector('input[type="text"]');
    if (firstInput) firstInput.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (messageEl) {
      messageEl.classList.add("hidden");
      messageEl.textContent = "";
    }
    if (form) form.reset();
    clearOrderAttachments();
  }

  document.querySelectorAll("[data-open-modal]").forEach((btn) => {
    btn.addEventListener("click", openModal);
  });

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", closeModal);
  });

  const backdrop = modal?.querySelector("[data-modal-backdrop]");
  backdrop?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });

  /**
   * Дублирует заявку в Telegram (после успешной отправки на почту).
   */
  async function sendTelegramNotification(data) {
    const token = CONFIG.TELEGRAM_BOT_API_KEY?.trim();
    const chatId = CONFIG.TELEGRAM_CHAT_ID;
    if (!token || chatId === "" || chatId === undefined || chatId === null) {
      return { skipped: true };
    }

    const text =
      "<b>Новая заявка — Белсотра (лендинг)</b>\n\n" +
      "<b>Компания:</b> " +
      escapeHtml(data.company) +
      "\n" +
      "<b>Телефон:</b> " +
      escapeHtml(data.phone) +
      "\n" +
      "<b>Email:</b> " +
      escapeHtml(data.email) +
      (data.filesCount > 0
        ? "\n<b>Вложения:</b> " + data.filesCount + " файл(ов) (см. письмо на почте)"
        : "");

    const url = "https://api.telegram.org/bot" + encodeURIComponent(token) + "/sendMessage";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error("Telegram API: " + res.status + " " + errText);
    }
    return await res.json();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /**
   * Отправка на почту через FormSubmit (multipart + вложения) → CONFIG.ORDER_EMAIL
   */
  async function submitToEmail(data) {
    const files = data.files || [];
    const formData = new FormData();
    formData.append("_subject", "Заявка: взвешивание / счёт — ООО «Белсотра»");
    formData.append("_captcha", "false");
    formData.append("_replyto", data.email);
    formData.append("company", data.company);
    formData.append("phone", data.phone);
    formData.append("email", data.email);

    let messageBody =
      "Запрос на взвешивание или счёт.\n\n" +
      "Компания: " +
      data.company +
      "\n" +
      "Телефон: " +
      data.phone +
      "\n" +
      "Email: " +
      data.email +
      "\n\n" +
      "Клиент уведомлён: прикрепить реквизиты для выставления счета.";
    if (files.length) {
      messageBody +=
        "\n\nПрикреплено файлов с реквизитами: " +
        files.length +
        " (" +
        files.map(function (f) {
          return f.name;
        }).join(", ") +
        ").";
    }
    formData.append("message", messageBody);

    files.forEach(function (file) {
      formData.append("attachment", file, file.name);
    });

    const res = await fetch(CONFIG.FORMSUBMIT_AJAX, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || "Ошибка отправки формы");
    }
    return res.json();
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " Б";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
    return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
  }

  function renderOrderFilesList() {
    if (!filesListEl) return;
    filesListEl.innerHTML = "";
    if (!orderAttachmentFiles.length) {
      filesListEl.classList.add("hidden");
      return;
    }
    filesListEl.classList.remove("hidden");
    orderAttachmentFiles.forEach(function (file, index) {
      const li = document.createElement("li");
      li.className =
        "flex items-center gap-2 rounded border border-white/10 bg-navy-950/50 px-3 py-2";

      const nameSpan = document.createElement("span");
      nameSpan.className = "min-w-0 flex-1 truncate text-steel-200";
      nameSpan.textContent = file.name;
      nameSpan.title = file.name;

      const sizeSpan = document.createElement("span");
      sizeSpan.className = "shrink-0 text-steel-500";
      sizeSpan.textContent = formatSize(file.size);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className =
        "shrink-0 rounded p-1 text-steel-500 transition hover:bg-accent/20 hover:text-accent";
      removeBtn.setAttribute("aria-label", "Удалить файл «" + file.name + "»");
      removeBtn.innerHTML =
        '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
      removeBtn.addEventListener("click", function () {
        orderAttachmentFiles.splice(index, 1);
        renderOrderFilesList();
      });

      li.appendChild(nameSpan);
      li.appendChild(sizeSpan);
      li.appendChild(removeBtn);
      filesListEl.appendChild(li);
    });
  }

  function clearOrderAttachments() {
    orderAttachmentFiles = [];
    if (fileInput) fileInput.value = "";
    renderOrderFilesList();
  }

  attachBtn?.addEventListener("click", function () {
    fileInput?.click();
  });

  fileInput?.addEventListener("change", function () {
    if (!fileInput.files?.length) return;
    const incoming = Array.from(fileInput.files);
    fileInput.value = "";
    const next = orderAttachmentFiles.slice();
    for (let i = 0; i < incoming.length; i++) {
      const f = incoming[i];
      if (f.size > ATTACH_LIMITS.maxBytesPerFile) {
        showMessage(
          "Файл «" + f.name + "» слишком большой (макс. " + formatSize(ATTACH_LIMITS.maxBytesPerFile) + ").",
          true,
        );
        continue;
      }
      if (next.length >= ATTACH_LIMITS.maxFiles) {
        showMessage("Не больше " + ATTACH_LIMITS.maxFiles + " файлов.", true);
        break;
      }
      next.push(f);
    }
    orderAttachmentFiles = next;
    renderOrderFilesList();
  });

  function showMessage(text, isError) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.classList.remove("hidden", "text-emerald-400", "text-red-400");
    messageEl.classList.add(isError ? "text-red-400" : "text-emerald-400");
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const company = String(fd.get("company") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const email = String(fd.get("email") || "").trim();

    if (!company || !phone || !email) {
      showMessage("Заполните все поля.", true);
      return;
    }

    submitBtn.disabled = true;
    showMessage("Отправка…", false);

    try {
      await submitToEmail({
        company: company,
        phone: phone,
        email: email,
        files: orderAttachmentFiles.slice(),
      });

      try {
        await sendTelegramNotification({
          company: company,
          phone: phone,
          email: email,
          filesCount: orderAttachmentFiles.length,
        });
      } catch (tgErr) {
        console.warn("Telegram:", tgErr);
      }

      showMessage(
        "Заявка отправлена. Мы свяжемся с вами. Проверьте почту — при необходимости ответьте с реквизитами.",
        false,
      );
      form.reset();
      clearOrderAttachments();
      setTimeout(closeModal, 3200);
    } catch (err) {
      console.error(err);
      showMessage(
        "Не удалось отправить через форму. Напишите на bs.scale@rudolf.by или позвоните +375 29 628-61-16.",
        true,
      );
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
