(function () {
  "use strict";

  const main = document.querySelector("main[data-content-page]");
  if (!main || typeof window.apiRequest !== "function") {
    return;
  }

  function safeWebUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      return "";
    }
    try {
      const url = new URL(value.trim(), window.location.href);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function setContentStatus(message) {
    const status = document.querySelector("[data-content-status]");
    if (status) {
      status.textContent = message;
      status.hidden = !message;
    }
  }

  function renderList(container, values) {
    if (!Array.isArray(values)) {
      return;
    }
    container.replaceChildren();
    values.forEach(function (item, index) {
      const record = typeof item === "string" ? { title: item } : item;
      if (!record || typeof record !== "object") {
        return;
      }
      if (container.dataset.contentList === "emails") {
        const email = typeof item === "string" ? item.trim() : "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return;
        }
        const listItem = document.createElement("li");
        const link = document.createElement("a");
        link.href = "mailto:" + email;
        link.textContent = email;
        listItem.append(link);
        container.append(listItem);
        return;
      }

      const listItem = document.createElement("li");
      if (container.dataset.contentList === "transport_steps") {
        const number = document.createElement("span");
        number.className = "transport-steps__number";
        number.textContent = String(index + 1);
        const content = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = typeof record.title === "string" ? record.title : "";
        content.append(title);
        if (typeof record.description === "string" && record.description) {
          const description = document.createElement("span");
          description.textContent = record.description;
          content.append(description);
        }
        listItem.append(number, content);
      } else if (container.dataset.contentList === "value_added_services") {
        listItem.className = "value-added-card";
        const number = document.createElement("span");
        number.className = "value-added-card__number";
        number.textContent = String(index + 1).padStart(2, "0");
        const title = document.createElement("h3");
        title.textContent = typeof record.title === "string" ? record.title : "";
        listItem.append(number, title);
        if (typeof record.description === "string" && record.description) {
          const description = document.createElement("p");
          description.textContent = record.description;
          listItem.append(description);
        }
      } else {
        return;
      }
      container.append(listItem);
    });
  }

  async function loadPageContent() {
    const page = main.dataset.contentPage;
    try {
      const response = await window.apiRequest(
        "/api/v1/site-content?page=" + encodeURIComponent(page)
      );
      const content = response && response.content;
      if (!content || typeof content !== "object" || Array.isArray(content)) {
        throw new Error("Máy chủ chưa trả về nội dung trang đúng định dạng.");
      }

      main.querySelectorAll("[data-content-key]").forEach(function (element) {
        const value = content[element.dataset.contentKey];
        if (typeof value === "string" && value.trim()) {
          element.textContent = value;
        }
      });
      main.querySelectorAll("[data-content-image]").forEach(function (image) {
        const value = safeWebUrl(content[image.dataset.contentImage]);
        if (value) {
          image.src = value;
        }
      });
      main.querySelectorAll("[data-content-list]").forEach(function (container) {
        const key = container.dataset.contentList;
        if (Array.isArray(content[key])) {
          renderList(container, content[key]);
        }
      });
      setContentStatus("");
    } catch (error) {
      setContentStatus("Không thể tải nội dung mới nhất; đang hiển thị nội dung mặc định.");
      console.error("Unable to load published page content:", page, error);
    }
  }

  loadPageContent();
})();
