(function () {
  "use strict";

  const workspace = document.getElementById("admin-collections-workspace");
  const status = document.getElementById("admin-collections-status");
  const audienceSelect = document.getElementById("slide-audience");
  const pageSize = 20;
  const configs = {
    "service-slides": {
      label: "slide",
      titleField: "title",
      subtitleField: "alt",
      fields: ["title", "alt", "image_url", "sort_order", "is_published"],
      numberFields: ["sort_order"],
      booleanFields: ["is_published"]
    },
    articles: {
      label: "bài viết",
      titleField: "title",
      subtitleField: "summary",
      fields: ["title", "summary", "published_at", "image_url", "url", "sort_order", "is_published"],
      numberFields: ["sort_order"],
      booleanFields: ["is_published"]
    },
    customers: {
      label: "đối tác",
      titleField: "name",
      subtitleField: "logo_url",
      fields: ["name", "logo_url", "sort_order", "is_published"],
      numberFields: ["sort_order"],
      booleanFields: ["is_published"]
    },
    warehouses: {
      label: "kho",
      titleField: "name",
      subtitleField: "city",
      fields: ["name", "city", "warehouse_type", "storage_type", "area_m2", "price_per_m2", "price_unit", "image_url", "description", "sort_order", "is_published"],
      numberFields: ["area_m2", "price_per_m2", "sort_order"],
      booleanFields: ["is_published"]
    }
  };
  const state = {
    collection: "service-slides",
    items: [],
    page: 1,
    totalPages: 1
  };

  function setStatus(message, kind) {
    status.textContent = message || "";
    status.classList.toggle("admin-status--error", kind === "error");
    status.classList.toggle("admin-status--success", kind === "success");
  }

  function activeAudience() {
    return audienceSelect.value;
  }

  function endpoint(collection, action) {
    return "/api/v1/admin/" + collection + "/" + action;
  }

  function getForm(collection) {
    return document.getElementById(collection + "-form");
  }

  function resetForm(collection) {
    const form = getForm(collection);
    form.reset();
    form.elements.namedItem("id").value = "";
    const heading = document.getElementById(collection + "-form-heading");
    heading.textContent = "Thêm " + configs[collection].label;
    if (collection === "warehouses") {
      form.elements.namedItem("price_unit").value = "đ/m²/tháng";
    }
    form.elements.namedItem("is_published").checked = true;
    if (form.elements.namedItem("sort_order")) {
      form.elements.namedItem("sort_order").value = "0";
    }
  }

  function getItemsResponse(data) {
    if (!data || !Array.isArray(data.items)) {
      throw new Error("Máy chủ chưa trả về danh sách hợp lệ.");
    }
    return data.items;
  }

  function createItemCard(item, collection) {
    const config = configs[collection];
    const card = document.createElement("article");
    card.className = "admin-collection-item";

    const copy = document.createElement("div");
    copy.className = "admin-collection-item__copy";
    const title = document.createElement("strong");
    title.textContent = String(item[config.titleField] || "Chưa có tiêu đề");
    const subtitle = document.createElement("span");
    const detail = String(item[config.subtitleField] || "");
    const publication = item.is_published === false ? "Bản nháp" : "Đã xuất bản";
    subtitle.textContent = detail ? detail + " · " + publication : publication;
    copy.append(title, subtitle);

    const actions = document.createElement("div");
    actions.className = "admin-collection-item__actions";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Sửa";
    editButton.dataset.editId = String(item.id);
    editButton.setAttribute("aria-label", "Sửa " + title.textContent);
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Xóa";
    deleteButton.dataset.deleteId = String(item.id);
    deleteButton.setAttribute("aria-label", "Xóa " + title.textContent);
    actions.append(editButton, deleteButton);
    card.append(copy, actions);
    return card;
  }

  function renderPagination(container) {
    if (state.totalPages <= 1) {
      return;
    }
    const navigation = document.createElement("nav");
    navigation.className = "admin-pagination";
    navigation.setAttribute("aria-label", "Phân trang danh sách quản trị");
    const previous = document.createElement("button");
    previous.type = "button";
    previous.textContent = "Trang trước";
    previous.disabled = state.page <= 1;
    previous.addEventListener("click", function () {
      state.page -= 1;
      loadCollection(state.collection);
    });
    const label = document.createElement("span");
    label.textContent = "Trang " + state.page + " / " + state.totalPages;
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "Trang sau";
    next.disabled = state.page >= state.totalPages;
    next.addEventListener("click", function () {
      state.page += 1;
      loadCollection(state.collection);
    });
    navigation.append(previous, label, next);
    container.append(navigation);
  }

  function renderCollection(collection) {
    const list = document.getElementById(collection + "-list");
    list.replaceChildren();
    if (!state.items.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Chưa có " + configs[collection].label + " nào.";
      list.append(empty);
      return;
    }

    state.items.forEach(function (item) {
      list.append(createItemCard(item, collection));
    });
    renderPagination(list);
  }

  async function loadCollection(collection) {
    state.collection = collection;
    setStatus("Đang tải danh sách " + configs[collection].label + "...", "");
    const list = document.getElementById(collection + "-list");
    list.replaceChildren();
    const query = new URLSearchParams({
      page: String(state.page),
      limit: String(pageSize)
    });
    if (collection === "service-slides") {
      query.set("audience", activeAudience());
    }

    try {
      const data = await window.apiRequest(
        "/api/v1/admin/" + collection + "?" + query.toString()
      );
      state.items = getItemsResponse(data);
      const pagination = data.pagination || {};
      state.totalPages = Number.isInteger(pagination.total_pages) && pagination.total_pages > 0
        ? pagination.total_pages
        : 1;
      if (state.page > state.totalPages) {
        state.page = state.totalPages;
        return loadCollection(collection);
      }
      renderCollection(collection);
      setStatus("", "");
      return true;
    } catch (error) {
      state.items = [];
      setStatus(error.message || "Không thể tải danh sách.", "error");
      return false;
    }
  }

  function populateForm(collection, id) {
    const item = state.items.find(function (entry) {
      return String(entry.id) === id;
    });
    if (!item) {
      setStatus("Không tìm thấy mục cần chỉnh sửa trong danh sách hiện tại.", "error");
      return;
    }

    const form = getForm(collection);
    form.elements.namedItem("id").value = String(item.id);
    configs[collection].fields.forEach(function (field) {
      const control = form.elements.namedItem(field);
      if (control) {
        if (config.booleanFields.includes(field)) {
          control.checked = item[field] !== false;
        } else {
          control.value = item[field] === null || item[field] === undefined ? "" : String(item[field]);
        }
      }
    });
    document.getElementById(collection + "-form-heading").textContent = "Sửa " + configs[collection].label;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.elements.namedItem(configs[collection].fields[0]).focus();
  }

  function serializeForm(collection, form) {
    const payload = {};
    configs[collection].fields.forEach(function (field) {
      const control = form.elements.namedItem(field);
      if (configs[collection].booleanFields.includes(field)) {
        payload[field] = control.checked;
      } else {
        const value = control.value.trim();
        payload[field] = configs[collection].numberFields.includes(field) ? Number(value) : value;
      }
    });
    const id = form.elements.namedItem("id").value;
    if (id) {
      payload.id = id;
    }
    if (collection === "service-slides") {
      payload.audience = activeAudience();
    }
    return payload;
  }

  async function saveItem(collection, event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) {
      return;
    }

    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    setStatus("Đang lưu " + configs[collection].label + "...", "");
    try {
      await window.apiRequest(endpoint(collection, "save"), {
        method: "POST",
        body: serializeForm(collection, form)
      });
      resetForm(collection);
      state.page = 1;
      const loaded = await loadCollection(collection);
      if (!loaded) {
        return;
      }
      setStatus("Đã lưu " + configs[collection].label + " thành công.", "success");
    } catch (error) {
      setStatus(error.message || "Không thể lưu mục.", "error");
    } finally {
      submit.disabled = false;
    }
  }

  async function deleteItem(collection, id) {
    const item = state.items.find(function (entry) {
      return String(entry.id) === id;
    });
    const label = item ? String(item[configs[collection].titleField] || configs[collection].label) : configs[collection].label;
    if (!window.confirm("Bạn có chắc muốn xóa \"" + label + "\"?")) {
      return;
    }

    setStatus("Đang xóa " + configs[collection].label + "...", "");
    try {
      await window.apiRequest(endpoint(collection, "delete"), {
        method: "POST",
        body: { id: id }
      });
      const loaded = await loadCollection(collection);
      if (!loaded) {
        return;
      }
      setStatus("Đã xóa mục thành công.", "success");
    } catch (error) {
      setStatus(error.message || "Không thể xóa mục.", "error");
    }
  }

  document.querySelectorAll("[data-collection-tab]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      const collection = tab.dataset.collectionTab;
      document.querySelectorAll("[data-collection-tab]").forEach(function (candidate) {
        const selected = candidate === tab;
        candidate.setAttribute("aria-selected", String(selected));
        candidate.tabIndex = selected ? 0 : -1;
      });
      document.querySelectorAll("[data-collection-panel]").forEach(function (panel) {
        panel.hidden = panel.dataset.collectionPanel !== collection;
      });
      state.page = 1;
      loadCollection(collection);
    });
  });

  Object.keys(configs).forEach(function (collection) {
    const form = getForm(collection);
    form.addEventListener("submit", function (event) {
      saveItem(collection, event);
    });
    form.addEventListener("reset", function () {
      window.setTimeout(function () {
        form.elements.namedItem("id").value = "";
        document.getElementById(collection + "-form-heading").textContent = "Thêm " + configs[collection].label;
        if (collection === "warehouses") {
          form.elements.namedItem("price_unit").value = "đ/m²/tháng";
        }
        form.elements.namedItem("is_published").checked = true;
        if (form.elements.namedItem("sort_order")) {
          form.elements.namedItem("sort_order").value = "0";
        }
      }, 0);
    });
    document.getElementById(collection + "-list").addEventListener("click", function (event) {
      const editButton = event.target.closest("[data-edit-id]");
      if (editButton) {
        populateForm(collection, editButton.dataset.editId);
        return;
      }
      const deleteButton = event.target.closest("[data-delete-id]");
      if (deleteButton) {
        deleteItem(collection, deleteButton.dataset.deleteId);
      }
    });
  });

  audienceSelect.addEventListener("change", function () {
    if (state.collection === "service-slides") {
      state.page = 1;
      resetForm("service-slides");
      loadCollection("service-slides");
    }
  });

  window.requireAdmin(workspace).then(function (authorized) {
    if (authorized) {
      loadCollection(state.collection);
    }
  });
})();
