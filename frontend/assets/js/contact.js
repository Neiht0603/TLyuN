(function () {
  "use strict";

  const form = document.getElementById("contact-form");
  const status = document.getElementById("contact-status");
  const submitButton = document.getElementById("contact-submit");
  let isSubmitting = false;

  function showStatus(kind, message) {
    status.replaceChildren();
    if (!message) {
      return;
    }
    const notice = document.createElement("p");
    notice.className = kind === "error" ? "notice notice--error" : kind === "loading" ? "loading" : "notice notice--success";
    notice.setAttribute("aria-busy", String(kind === "loading"));
    notice.textContent = message;
    status.append(notice);
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    showStatus("", "");
    if (!form.reportValidity()) {
      return;
    }

    const payload = {
      full_name: document.getElementById("contact-full-name").value.trim(),
      email: document.getElementById("contact-email").value.trim(),
      phone: document.getElementById("contact-phone").value.trim(),
      message: document.getElementById("contact-message").value.trim(),
      privacy_consent: document.getElementById("privacy-consent").checked
    };
    if (!payload.full_name || !payload.email || !payload.phone || !payload.message || !payload.privacy_consent) {
      showStatus("error", "Vui lòng điền đầy đủ thông tin và đồng ý với chính sách quyền riêng tư.");
      return;
    }

    isSubmitting = true;
    submitButton.disabled = true;
    showStatus("loading", "Đang gửi liên hệ...");
    try {
      await window.apiRequest("/api/v1/contact-messages", {
        method: "POST",
        body: payload
      });
      form.reset();
      showStatus("success", "Đã gửi liên hệ thành công. Cảm ơn bạn đã nhắn cho TLyuN.");
    } catch (error) {
      showStatus(
        "error",
        error && typeof error.message === "string"
          ? error.message
          : "Không thể gửi liên hệ. Vui lòng thử lại."
      );
    } finally {
      isSubmitting = false;
      submitButton.disabled = false;
    }
  });
})();
