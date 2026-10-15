(function () {
  "use strict";

  const currentUrl = new URL(window.location.href);
  const dashboardPath = new URL("dashboard.html", currentUrl);

  function getSafeReturnUrl() {
    const requested = currentUrl.searchParams.get("returnTo");
    if (!requested) {
      return dashboardPath;
    }

    try {
      const destination = new URL(requested, currentUrl);
      const pagesPath = new URL(".", currentUrl).pathname;
      if (destination.origin !== currentUrl.origin || !destination.pathname.startsWith(pagesPath)) {
        return dashboardPath;
      }
      return destination;
    } catch (error) {
      return dashboardPath;
    }
  }

  function showMessage(container, message, kind) {
    container.replaceChildren();
    if (!message) {
      return;
    }
    const notice = document.createElement("p");
    notice.className = "notice " + (kind === "success" ? "notice--success" : "notice--error");
    notice.textContent = message;
    container.append(notice);
  }

  function getApiErrorMessage(error, fallback) {
    return error && typeof error.message === "string" && error.message
      ? error.message
      : fallback;
  }

  function setButtonLoading(button, loading, label) {
    if (loading) {
      button.dataset.originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = label;
      return;
    }
    button.disabled = false;
    if (button.dataset.originalLabel) {
      button.textContent = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }
  }

  function initializePasswordToggle() {
    const toggle = document.getElementById("toggle-password-visibility");
    const password = document.getElementById("login-password");
    if (!toggle || !password) {
      return;
    }

    toggle.addEventListener("click", function () {
      const showPassword = password.type === "password";
      password.type = showPassword ? "text" : "password";
      toggle.classList.toggle("is-visible", showPassword);
      toggle.setAttribute("aria-label", showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu");
      toggle.setAttribute("aria-pressed", String(showPassword));
    });
  }

  function initializeLogin() {
    const form = document.getElementById("login-form");
    if (!form) {
      return false;
    }

    const errorContainer = document.getElementById("login-error");
    const submitButton = document.getElementById("login-submit");
    const registerLink = document.getElementById("register-link");
    const registered = currentUrl.searchParams.get("registered") === "1";
    if (registered) {
      showMessage(errorContainer, "Đăng ký thành công. Bạn có thể đăng nhập bằng tài khoản vừa tạo.", "success");
    }

    if (registerLink) {
      const registerUrl = new URL("register.html", currentUrl);
      ["returnTo", "audience"].forEach(function (key) {
        const value = currentUrl.searchParams.get(key);
        if (value) {
          registerUrl.searchParams.set(key, value);
        }
      });
      registerLink.href = registerUrl.href;
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      showMessage(errorContainer, "");
      if (!form.reportValidity()) {
        return;
      }

      const identifier = document.getElementById("login-identifier").value.trim();
      const password = document.getElementById("login-password").value;
      if (!identifier || !password) {
        showMessage(errorContainer, "Vui lòng nhập email hoặc số điện thoại và mật khẩu.");
        return;
      }

      setButtonLoading(submitButton, true, "Đang đăng nhập...");
      try {
        const data = await window.apiRequest("/api/v1/auth/login", {
          method: "POST",
          body: { identifier: identifier, password: password }
        });
        const destination = getSafeReturnUrl();
        window.location.assign(destination.href);
      } catch (error) {
        showMessage(errorContainer, getApiErrorMessage(error, "Không thể đăng nhập. Vui lòng thử lại."));
      } finally {
        setButtonLoading(submitButton, false);
      }
    });
    return true;
  }

  function initializeRegistration() {
    const form = document.getElementById("register-form");
    if (!form) {
      return false;
    }

    const errorContainer = document.getElementById("register-error");
    const submitButton = document.getElementById("register-submit");
    const accountType = document.getElementById("account-type");
    const companyField = document.getElementById("company-name-field");
    const companyName = document.getElementById("company-name");
    const dateOfBirth = document.getElementById("date-of-birth");
    const audience = currentUrl.searchParams.get("audience");
    dateOfBirth.max = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);

    if (audience === "business") {
      accountType.value = "business";
    } else if (audience === "customer") {
      accountType.value = "customer";
    }

    function syncCompanyField() {
      const isBusiness = accountType.value === "business";
      companyField.hidden = !isBusiness;
      companyName.required = isBusiness;
      if (!isBusiness) {
        companyName.value = "";
        companyName.setCustomValidity("");
      }
    }

    accountType.addEventListener("change", syncCompanyField);
    syncCompanyField();

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      showMessage(errorContainer, "");
      if (!form.reportValidity()) {
        return;
      }

      const selectedAccountType = accountType.value;
      if (!["customer", "business"].includes(selectedAccountType)) {
        showMessage(errorContainer, "Chỉ hỗ trợ đăng ký tài khoản khách hàng cá nhân hoặc doanh nghiệp.");
        return;
      }

      const fullName = document.getElementById("full-name").value.trim();
      const email = document.getElementById("register-email").value.trim();
      const phone = document.getElementById("register-phone").value.trim();
      if (!fullName || !email || !phone) {
        showMessage(errorContainer, "Vui lòng nhập họ tên, email và số điện thoại hợp lệ.");
        return;
      }
      if (selectedAccountType === "business" && !companyName.value.trim()) {
        companyName.setCustomValidity("Vui lòng nhập tên doanh nghiệp.");
        companyName.reportValidity();
        companyName.addEventListener("input", function clearCustomValidity() {
          companyName.setCustomValidity("");
          companyName.removeEventListener("input", clearCustomValidity);
        });
        showMessage(errorContainer, "Vui lòng nhập tên doanh nghiệp.");
        return;
      }

      const password = document.getElementById("register-password").value;
      const passwordConfirmation = document.getElementById("confirm-password").value;
      if (password !== passwordConfirmation) {
        const confirmationField = document.getElementById("confirm-password");
        const passwordField = document.getElementById("register-password");
        const clearMismatch = function () {
          confirmationField.setCustomValidity("");
          confirmationField.removeEventListener("input", clearMismatch);
          passwordField.removeEventListener("input", clearMismatch);
        };
        confirmationField.setCustomValidity("Mật khẩu xác nhận chưa khớp.");
        confirmationField.reportValidity();
        confirmationField.addEventListener("input", clearMismatch);
        passwordField.addEventListener("input", clearMismatch);
        showMessage(errorContainer, "Mật khẩu và xác nhận mật khẩu chưa khớp.");
        return;
      }

      const payload = {
        account_type: selectedAccountType,
        full_name: fullName,
        email: email,
        phone: phone,
        date_of_birth: document.getElementById("date-of-birth").value,
        password: password,
        password_confirmation: passwordConfirmation,
        privacy_consent: document.getElementById("privacy-consent").checked
      };
      if (selectedAccountType === "business") {
        payload.company_name = companyName.value.trim();
      }

      setButtonLoading(submitButton, true, "Đang tạo tài khoản...");
      try {
        await window.apiRequest("/api/v1/auth/register", {
          method: "POST",
          body: payload
        });
        const loginUrl = new URL("login.html", currentUrl);
        ["returnTo", "audience"].forEach(function (key) {
          const value = currentUrl.searchParams.get(key);
          if (value) {
            loginUrl.searchParams.set(key, value);
          }
        });
        loginUrl.searchParams.set("registered", "1");
        window.location.assign(loginUrl.href);
      } catch (error) {
        showMessage(errorContainer, getApiErrorMessage(error, "Không thể tạo tài khoản. Vui lòng kiểm tra thông tin."));
      } finally {
        setButtonLoading(submitButton, false);
      }
    });
    return true;
  }

  function getUserFromResponse(data) {
    if (!data || typeof data !== "object") {
      return null;
    }
    if (data.user && typeof data.user === "object") {
      return data.user;
    }
    return data;
  }

  async function initializeDashboard() {
    const dashboard = document.querySelector("[data-auth-dashboard]");
    if (!dashboard) {
      return;
    }

    const status = document.getElementById("dashboard-status");
    const content = document.getElementById("dashboard-content");
    const logoutButton = document.getElementById("logout-submit");
    status.textContent = "Đang tải thông tin tài khoản...";
    logoutButton.disabled = true;

    try {
      const data = await window.apiRequest("/api/v1/auth/me");
      const user = getUserFromResponse(data);
      if (!user) {
        throw new Error("Máy chủ chưa trả về thông tin tài khoản.");
      }
      const role = typeof user.role === "string" ? user.role : "";
      const roleLabel = {
        customer: "Khách hàng cá nhân",
        business: "Khách hàng doanh nghiệp",
        staff: "Nhân viên",
        employee: "Nhân viên"
      };
      document.getElementById("dashboard-name").textContent =
        user.full_name || user.name || user.email || "Tài khoản TLyuN";
      document.getElementById("dashboard-role").textContent = roleLabel[role] || role || "Chưa xác định";
      const roleDescription = document.getElementById("dashboard-role-description");
      roleDescription.textContent = role === "staff" || role === "employee"
        ? "Tài khoản nhân viên. Quyền truy cập được máy chủ kiểm soát theo vai trò."
        : role === "business"
          ? "Tài khoản doanh nghiệp. Quyền truy cập được máy chủ kiểm soát theo vai trò."
          : "Quyền truy cập được máy chủ kiểm soát theo vai trò.";
      content.hidden = false;
      status.textContent = "";
      logoutButton.disabled = false;
    } catch (error) {
      if (error && error.status === 401) {
        const loginUrl = new URL("login.html", currentUrl);
        loginUrl.searchParams.set("returnTo", "dashboard.html");
        window.location.replace(loginUrl.href);
        return;
      }
      status.textContent = getApiErrorMessage(error, "Không thể tải thông tin tài khoản.");
      status.classList.add("notice", "notice--error");
      logoutButton.disabled = false;
    }

    logoutButton.addEventListener("click", async function () {
      logoutButton.disabled = true;
      status.classList.remove("notice--error");
      status.textContent = "Đang đăng xuất...";
      try {
        await window.apiRequest("/api/v1/auth/logout", { method: "POST", body: {} });
        window.location.assign(new URL("login.html", currentUrl).href);
      } catch (error) {
        status.classList.add("notice", "notice--error");
        status.textContent = getApiErrorMessage(error, "Không thể đăng xuất. Vui lòng thử lại.");
        logoutButton.disabled = false;
      }
    });
  }

  initializePasswordToggle();
  initializeLogin();
  initializeRegistration();
  initializeDashboard();
})();
