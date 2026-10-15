(function () {
  "use strict";

  const form = document.getElementById("warehouse-filter-form");
  const list = document.getElementById("warehouse-list");
  const pagination = document.getElementById("warehouse-pagination");
  const loadingState = document.getElementById("warehouse-loading-state");
  const emptyState = document.getElementById("warehouse-empty-state");
  const errorState = document.getElementById("warehouse-error-state");
  const errorMessage = document.getElementById("warehouse-error-message");
  const pageSize = 8;
  const state = {
    page: 1,
    totalPages: 1
  };

  function getCollection(data) {
    if (Array.isArray(data)) {
      return data;
    }
    if (!data || typeof data !== "object") {
      throw new Error("Dữ liệu danh sách kho không đúng định dạng.");
    }
    const items = data.warehouses || data.items || data.results || data.data;
    if (Array.isArray(items)) {
      return items;
    }
    throw new Error("Máy chủ chưa trả về danh sách kho hợp lệ.");
  }

  function getValue(item, keys) {
    for (const key of keys) {
      const value = item && item[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
    }
    return "";
  }

  function getImageUrl(item) {
    const value = getValue(item, ["image_url", "imageUrl", "image", "photo_url", "photoUrl"]);
    if (typeof value !== "string") {
      return "";
    }
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function formatPrice(value) {
    if (value === "" || value === null || value === undefined) {
      return "Chưa cập nhật";
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return new Intl.NumberFormat("vi-VN").format(value);
    }
    const text = String(value).trim();
    if (/^\d+$/.test(text)) {
      return new Intl.NumberFormat("vi-VN").format(Number(text));
    }
    return text || "Chưa cập nhật";
  }

  function showState(name) {
    loadingState.hidden = name !== "loading";
    emptyState.hidden = name !== "empty";
    errorState.hidden = name !== "error";
  }

  function renderWarehouse(item) {
    const card = document.createElement("article");
    card.className = "warehouse-card";

    const media = document.createElement("div");
    media.className = "warehouse-card__media";
    const imageUrl = getImageUrl(item);
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = getValue(item, ["name", "warehouse_name", "warehouseName"]) || "Hình ảnh kho";
      image.loading = "lazy";
      image.decoding = "async";
      media.append(image);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "warehouse-card__placeholder";
      placeholder.textContent = "Hình ảnh kho";
      media.append(placeholder);
    }

    const price = document.createElement("span");
    price.className = "warehouse-card__price";
    const priceValue = getValue(item, ["price_per_m2", "price_per_sqm", "price", "rental_price", "unit_price"]);
    const priceUnit = getValue(item, ["price_unit", "priceUnit", "unit"]) || "m²/tháng";
    price.textContent = formatPrice(priceValue) + " " + String(priceUnit).trim();
    media.append(price);

    const content = document.createElement("div");
    content.className = "warehouse-card__content";
    const title = document.createElement("h2");
    const warehouseName = getValue(item, ["name", "warehouse_name", "warehouseName"]);
    const warehouseType = getValue(item, ["warehouse_type_name", "type_name", "type", "warehouse_type"]);
    const city = getValue(item, ["city", "region", "city_name", "cityName"]);
    title.textContent = warehouseName || (
      (warehouseType ? String(warehouseType) : "Kho") + (city ? " – " + city : "")
    );
    content.append(title);

    const details = document.createElement("dl");
    details.className = "warehouse-card__details";
    const area = getValue(item, ["area_m2", "area_sqm", "storage_area", "size"]);
    if (area !== "") {
      const areaRow = document.createElement("div");
      const areaLabel = document.createElement("dt");
      areaLabel.textContent = "Diện tích:";
      const areaValue = document.createElement("dd");
      const numericArea = Number(area);
      areaValue.textContent = Number.isFinite(numericArea)
        ? new Intl.NumberFormat("vi-VN").format(numericArea) + " m²"
        : String(area) + " m²";
      areaRow.append(areaLabel, areaValue);
      details.append(areaRow);
    }

    const location = getValue(item, ["address", "district", "location_detail", "locationDetail"]);
    const locationRow = document.createElement("div");
    const locationLabel = document.createElement("dt");
    locationLabel.textContent = "Địa điểm:";
    const locationValue = document.createElement("dd");
    locationValue.textContent = [location, city].filter(Boolean).join(", ") || "Đang cập nhật";
    locationRow.append(locationLabel, locationValue);
    details.append(locationRow);
    content.append(details);
    card.append(media, content);
    return card;
  }

  function getPagination(data, itemCount) {
    const meta = data && typeof data === "object"
      ? data.pagination || data.meta || data
      : {};
    const current = Number(meta.current_page || meta.page || state.page);
    const pages = Number(meta.total_pages || meta.last_page || meta.pages || 0);
    const total = Number(meta.total || meta.total_items || 0);
    const totalPages = pages > 0
      ? pages
      : total > 0
        ? Math.ceil(total / pageSize)
        : itemCount < pageSize
          ? Math.max(1, current)
          : current + 1;
    return {
      current: Number.isFinite(current) && current > 0 ? current : state.page,
      totalPages: Math.max(1, totalPages)
    };
  }

  function renderPagination() {
    pagination.replaceChildren();
    if (state.totalPages <= 1) {
      return;
    }

    function addButton(label, page, options) {
      const button = document.createElement("button");
      button.className = "warehouse-pagination__button";
      button.type = "button";
      button.textContent = label;
      button.disabled = Boolean(options.disabled);
      if (options.current) {
        button.setAttribute("aria-current", "page");
        button.setAttribute("aria-label", "Trang " + page + ", trang hiện tại");
      } else if (options.label) {
        button.setAttribute("aria-label", options.label);
      }
      button.addEventListener("click", function () {
        state.page = page;
        loadWarehouses();
      });
      pagination.append(button);
    }

    addButton("Trước", Math.max(1, state.page - 1), {
      disabled: state.page <= 1,
      label: "Trang trước"
    });
    const visiblePages = new Set([1, state.totalPages]);
    for (let page = Math.max(1, state.page - 1); page <= Math.min(state.totalPages, state.page + 1); page += 1) {
      visiblePages.add(page);
    }
    let previousPage = 0;
    Array.from(visiblePages).sort(function (a, b) {
      return a - b;
    }).forEach(function (page) {
      if (previousPage && page - previousPage > 1) {
        const ellipsis = document.createElement("span");
        ellipsis.className = "warehouse-pagination__ellipsis";
        ellipsis.setAttribute("aria-hidden", "true");
        ellipsis.textContent = "…";
        pagination.append(ellipsis);
      }
      addButton(String(page), page, { current: page === state.page });
      previousPage = page;
    });
    addButton("Sau", Math.min(state.totalPages, state.page + 1), {
      disabled: state.page >= state.totalPages,
      label: "Trang sau"
    });
  }

  function buildRequestUrl() {
    const parameters = new URLSearchParams();
    const fields = [
      ["city", "warehouse-city"],
      ["warehouse_type", "warehouse-type"],
      ["storage_type", "storage-type"],
      ["min_price", "min-price"],
      ["max_price", "max-price"],
      ["sort_by", "sort-by"],
      ["sort_order", "sort-order"]
    ];
    fields.forEach(function (field) {
      const value = document.getElementById(field[1]).value.trim();
      if (value) {
        parameters.set(field[0], value);
      }
    });
    parameters.set("page", String(state.page));
    parameters.set("limit", String(pageSize));
    return "/api/v1/warehouses?" + parameters.toString();
  }

  async function loadWarehouses() {
    showState("loading");
    list.replaceChildren();
    pagination.replaceChildren();
    try {
      const data = await window.apiRequest(buildRequestUrl());
      const items = getCollection(data);
      if (!items.length) {
        state.page = 1;
        state.totalPages = 1;
        showState("empty");
        return;
      }

      items.forEach(function (item) {
        list.append(renderWarehouse(item));
      });
      const pageInfo = getPagination(data, items.length);
      state.page = pageInfo.current;
      state.totalPages = pageInfo.totalPages;
      showState("");
      renderPagination();
    } catch (error) {
      errorMessage.textContent = error && typeof error.message === "string"
        ? error.message
        : "Không thể tải danh sách kho. Vui lòng thử lại.";
      showState("error");
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const minimum = document.getElementById("min-price");
    const maximum = document.getElementById("max-price");
    maximum.setCustomValidity("");
    if (minimum.value && maximum.value && Number(maximum.value) < Number(minimum.value)) {
      maximum.setCustomValidity("Giá đến phải lớn hơn hoặc bằng giá từ.");
      maximum.reportValidity();
      return;
    }
    state.page = 1;
    loadWarehouses();
  });

  form.addEventListener("input", function (event) {
    if (event.target.id === "max-price") {
      event.target.setCustomValidity("");
    }
  });
  loadWarehouses();
})();
