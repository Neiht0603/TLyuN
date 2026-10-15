(function () {
  "use strict";

  const workspace = document.getElementById("admin-content-workspace");
  const form = document.getElementById("admin-content-form");
  const status = document.getElementById("admin-content-status");
  const saveButton = document.getElementById("admin-content-save");
  const state = { activePage: "home", pages: null };

  function setStatus(message, kind) {
    status.textContent = message || "";
    status.classList.toggle("admin-status--error", kind === "error");
    status.classList.toggle("admin-status--success", kind === "success");
  }

  function parseLines(value) {
    return value.split(/\r?\n/).map(function (line) {
      return line.trim();
    }).filter(Boolean);
  }

  function formatLines(value, formatter) {
    if (!Array.isArray(value)) {
      return "";
    }
    return value.map(formatter).filter(Boolean).join("\n");
  }

  function formatStep(step) {
    if (typeof step === "string") {
      return step;
    }
    if (!step || typeof step !== "object") {
      return "";
    }
    return [step.title || step.name || "", step.description || ""].join("|").replace(/\|$/, "");
  }

  function formatValueAdded(item) {
    if (typeof item === "string") {
      return item;
    }
    if (!item || typeof item !== "object") {
      return "";
    }
    return [item.title || item.name || "", item.description || ""].join("|").replace(/\|$/, "");
  }

  function splitNamedLines(value, fieldName) {
    return parseLines(value).map(function (line) {
      const separator = line.indexOf("|");
      if (separator < 1) {
        throw new Error(fieldName + ": mỗi dòng cần có tên và mô tả, ngăn cách bằng dấu |.");
      }
      return {
        title: line.slice(0, separator).trim(),
        description: line.slice(separator + 1).trim()
      };
    });
  }

  function getPanel(page) {
    return form.querySelector('[data-content-panel="' + page + '"]');
  }

  function activatePage(page) {
    state.activePage = page;
    document.querySelectorAll("[data-content-tab]").forEach(function (tab) {
      const selected = tab.dataset.contentTab === page;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll("[data-content-panel]").forEach(function (panel) {
      const selected = panel.dataset.contentPanel === page;
      panel.hidden = !selected;
      panel.querySelectorAll("input, textarea, select, button").forEach(function (control) {
        control.disabled = !selected;
      });
    });
    setStatus("", "");
  }

  function populatePage(page) {
    const content = state.pages[page] || {};
    const panel = getPanel(page);
    panel.querySelectorAll("[name]").forEach(function (control) {
      const value = content[control.name];
      if (control.name === "emails") {
        control.value = formatLines(value, String);
      } else if (control.name === "transport_steps") {
        control.value = formatLines(value, formatStep);
      } else if (control.name === "value_added_services") {
        control.value = formatLines(value, formatValueAdded);
      } else {
        control.value = typeof value === "string" ? value : "";
      }
    });
  }

  function serializePage(page) {
    const panel = getPanel(page);
    const result = {};
    panel.querySelectorAll("[name]").forEach(function (control) {
      if (control.name === "emails") {
        const emails = parseLines(control.value);
        emails.forEach(function (email) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error("Email không hợp lệ: " + email);
          }
        });
        result.emails = emails;
      } else if (control.name === "transport_steps") {
        result.transport_steps = splitNamedLines(control.value, "Các bước vận chuyển");
      } else if (control.name === "value_added_services") {
        result.value_added_services = splitNamedLines(control.value, "Dịch vụ giá trị gia tăng");
      } else {
        result[control.name] = control.value.trim();
      }
    });
    return result;
  }

  async function loadContent() {
    setStatus("Đang tải nội dung trang...", "");
    try {
      const data = await window.apiRequest("/api/v1/admin/site-content");
      if (!data || !data.pages || typeof data.pages !== "object") {
        throw new Error("Máy chủ chưa trả về nội dung trang đúng định dạng.");
      }
      state.pages = data.pages;
      populatePage(state.activePage);
      setStatus("", "");
    } catch (error) {
      setStatus(error.message || "Không thể tải nội dung trang.", "error");
    }
  }

  document.querySelectorAll("[data-content-tab]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      const page = tab.dataset.contentTab;
      if (state.pages && state.pages[page]) {
        populatePage(page);
      }
      activatePage(page);
    });
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const panel = getPanel(state.activePage);
    if (!panel.querySelector(":invalid") && form.reportValidity()) {
      saveButton.disabled = true;
      setStatus("Đang lưu nội dung...", "");
      try {
        const pages = Object.assign({}, state.pages);
        pages[state.activePage] = serializePage(state.activePage);
        const result = await window.apiRequest("/api/v1/admin/site-content", {
          method: "POST",
          body: { pages: pages }
        });
        if (!result || !result.pages || typeof result.pages !== "object") {
          throw new Error("Máy chủ chưa xác nhận nội dung đã lưu.");
        }
        state.pages = result.pages;
        populatePage(state.activePage);
        setStatus("Đã lưu nội dung thành công.", "success");
      } catch (error) {
        setStatus(error.message || "Không thể lưu nội dung.", "error");
      } finally {
        saveButton.disabled = false;
      }
    } else {
      form.reportValidity();
    }
  });

  activatePage(state.activePage);
  window.requireAdmin(workspace).then(function (authorized) {
    if (authorized) {
      loadContent();
    }
  });
})();
