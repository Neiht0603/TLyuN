(function (global) {
  "use strict";

  function getUser(data) {
    if (!data || typeof data !== "object") {
      return null;
    }
    return data.user && typeof data.user === "object" ? data.user : data;
  }

  function setStatus(status, message, isError) {
    status.textContent = message;
    status.classList.toggle("admin-status--error", Boolean(isError));
  }

  async function requireAdmin(workspace) {
    const status = document.getElementById("admin-guard-status");
    if (!workspace || !status) {
      throw new Error("Thiếu vùng giao diện quản trị.");
    }

    try {
      const data = await global.apiRequest("/api/v1/auth/me");
      const user = getUser(data);
      const role = user && typeof user.role === "string" ? user.role.toLowerCase() : "";
      if (!["admin", "staff", "employee"].includes(role)) {
        setStatus(status, "Tài khoản hiện tại không có quyền quản trị nội dung.", true);
        return false;
      }

      workspace.hidden = false;
      status.textContent = "";
      status.hidden = true;
      return true;
    } catch (error) {
      if (error && error.status === 401) {
        const loginUrl = new URL("login.html", global.location.href);
        loginUrl.searchParams.set("returnTo", global.location.pathname.split("/").pop());
        global.location.assign(loginUrl.href);
        return false;
      }

      setStatus(
        status,
        error && error.status === 403
          ? "Tài khoản hiện tại không có quyền quản trị nội dung."
          : error && typeof error.message === "string"
            ? error.message
            : "Không thể xác minh quyền quản trị.",
        true
      );
      return false;
    }
  }

  global.requireAdmin = requireAdmin;
})(window);
