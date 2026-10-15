(function () {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const carouselTrack = document.getElementById("services-showcase-track");
  const carouselPagination = document.getElementById("services-showcase-pagination");
  const carouselStatus = document.getElementById("services-showcase-status");
  const carouselState = {
    slides: [],
    index: 0,
    timer: null
  };
  const draftKeys = {
    transport: "tlyun.quoteDraft.transport"
  };
  const loginUrl = new URL("login.html", window.location.href);
  loginUrl.searchParams.set("returnTo", "services.html");

  const forms = [
    {
      name: "transport",
      form: document.getElementById("transport-quote-form"),
      status: document.getElementById("transport-quote-status"),
      endpoint: "/api/v1/transport-quotes",
      fields: [
        ["pickup-location", "pickup_location", "text"],
        ["delivery-location", "delivery_location", "text"],
        ["weight-kg", "weight_kg", "number"],
        ["length-cm", "length_cm", "number"],
        ["width-cm", "width_cm", "number"],
        ["height-cm", "height_cm", "number"],
        ["vehicle-type", "vehicle_type", "text"],
        ["booking-type", "booking_type", "text"],
        ["transport-quantity", "quantity", "integer"],
        ["transport-notes", "notes", "text"]
      ]
    }
  ];

  function getSlideImage(slide) {
    if (!slide || typeof slide !== "object") {
      return "";
    }
    const value = [slide.image_url, slide.imageUrl, slide.image, slide.url]
      .find(function (candidate) {
        return typeof candidate === "string" && candidate.trim();
      });
    if (!value) {
      return "";
    }
    try {
      const imageUrl = new URL(value.trim(), window.location.href);
      return imageUrl.protocol === "http:" || imageUrl.protocol === "https:" ? imageUrl.href : "";
    } catch (error) {
      return "";
    }
  }

  function renderCarouselStatus(message, isError) {
    carouselStatus.replaceChildren();
    if (!message) {
      return;
    }
    const status = document.createElement("p");
    status.className = isError ? "notice notice--error" : "loading";
    status.setAttribute("aria-busy", String(!isError));
    status.textContent = message;
    carouselStatus.append(status);
  }

  function renderFallbackSlide() {
    carouselTrack.replaceChildren();
    carouselPagination.replaceChildren();
    const carousel = document.getElementById("services-showcase-carousel");
    const fallbackPath = carousel.dataset.fallbackImage;
    if (!fallbackPath) {
      return;
    }

    const image = document.createElement("img");
    image.src = new URL(fallbackPath, document.baseURI).href;
    image.alt = "Kho hàng TLyuN";
    image.width = 960;
    image.height = 640;
    image.fetchPriority = "high";
    carouselTrack.append(image);
  }

  function renderServiceSlides() {
    carouselTrack.replaceChildren();
    carouselPagination.replaceChildren();
    if (!carouselState.slides.length) {
      return;
    }

    const slide = carouselState.slides[carouselState.index];
    const image = document.createElement("img");
    image.src = getSlideImage(slide);
    image.alt = typeof slide.alt === "string" && slide.alt.trim()
      ? slide.alt.trim()
      : typeof slide.title === "string" && slide.title.trim()
        ? slide.title.trim()
        : "Hình ảnh dịch vụ kho vận";
    image.width = 960;
    image.height = 640;
    image.decoding = "async";
    image.fetchPriority = "high";
    carouselTrack.append(image);

    carouselState.slides.forEach(function (_, index) {
      const indicator = document.createElement("button");
      indicator.className = "services-showcase__indicator";
      indicator.type = "button";
      indicator.setAttribute("aria-label", "Hiển thị hình ảnh dịch vụ " + (index + 1));
      indicator.setAttribute("aria-pressed", String(index === carouselState.index));
      indicator.addEventListener("click", function () {
        carouselState.index = index;
        renderServiceSlides();
        startServiceCarousel();
      });
      carouselPagination.append(indicator);
    });
  }

  function stopServiceCarousel() {
    if (carouselState.timer !== null) {
      window.clearInterval(carouselState.timer);
      carouselState.timer = null;
    }
  }

  function startServiceCarousel() {
    stopServiceCarousel();
    if (reducedMotion.matches || carouselState.slides.length < 2) {
      return;
    }
    carouselState.timer = window.setInterval(function () {
      carouselState.index = (carouselState.index + 1) % carouselState.slides.length;
      renderServiceSlides();
    }, 5000);
  }

  async function loadServiceSlides() {
    renderCarouselStatus("Đang tải hình ảnh dịch vụ...");
    stopServiceCarousel();
    try {
      const data = await window.apiRequest("/api/v1/service-slides?audience=customer");
      const collection = Array.isArray(data)
        ? data
        : data && Array.isArray(data.slides)
          ? data.slides
          : data && Array.isArray(data.items)
            ? data.items
            : data && Array.isArray(data.service_slides)
              ? data.service_slides
              : null;
      if (!collection) {
        throw new Error("Dữ liệu hình ảnh dịch vụ không đúng định dạng.");
      }

      carouselState.slides = collection.filter(function (slide) {
        return Boolean(getSlideImage(slide));
      });
      carouselState.index = 0;
      renderServiceSlides();
      if (!carouselState.slides.length) {
        renderFallbackSlide();
        renderCarouselStatus("Hiện chưa có hình ảnh dịch vụ.", true);
        return;
      }
      renderCarouselStatus("");
      startServiceCarousel();
    } catch (error) {
      carouselState.slides = [];
      renderFallbackSlide();
      renderCarouselStatus(
        error && typeof error.message === "string"
          ? error.message
          : "Không thể tải hình ảnh dịch vụ.",
        true
      );
    }
  }

  function renderStatus(formState, kind, message) {
    formState.status.replaceChildren();
    if (!kind) {
      return;
    }

    const element = document.createElement("p");
    element.className = kind === "error" ? "notice notice--error" : kind === "loading" ? "loading" : "notice notice--success";
    element.setAttribute("aria-busy", String(kind === "loading"));
    element.textContent = message;
    formState.status.append(element);
  }

  function collectValues(formState) {
    return formState.fields.reduce(function (values, field) {
      const element = document.getElementById(field[0]);
      const rawValue = element.value.trim();

      if (field[2] === "number" || field[2] === "integer") {
        values[field[1]] = rawValue === "" ? "" : Number(rawValue);
      } else {
        values[field[1]] = rawValue;
      }
      return values;
    }, {});
  }

  function restoreDraft(formState) {
    let stored;
    try {
      stored = sessionStorage.getItem(draftKeys[formState.name]);
      if (!stored) {
        return;
      }

      const values = JSON.parse(stored);
      if (!values || typeof values !== "object" || Array.isArray(values)) {
        throw new Error("Bản nháp biểu mẫu không đúng định dạng.");
      }

      formState.fields.forEach(function (field) {
        if (Object.prototype.hasOwnProperty.call(values, field[1])) {
          document.getElementById(field[0]).value = String(values[field[1]]);
        }
      });
      sessionStorage.removeItem(draftKeys[formState.name]);
      renderStatus(formState, "success", "Đã khôi phục thông tin đã nhập trước khi đăng nhập. Nhấn Tìm báo giá để tiếp tục.");
    } catch (error) {
      console.error("Unable to restore quote form draft:", error);
      sessionStorage.removeItem(draftKeys[formState.name]);
      renderStatus(formState, "error", "Không thể khôi phục bản nháp. Vui lòng nhập lại thông tin.");
    }
  }

  function saveDraft(formState) {
    try {
      sessionStorage.setItem(draftKeys[formState.name], JSON.stringify(collectValues(formState)));
    } catch (error) {
      console.error("Unable to save quote form draft:", error);
      renderStatus(formState, "error", "Không thể lưu bản nháp trong phiên này. Vui lòng thử lại sau khi đăng nhập.");
      return false;
    }
    return true;
  }

  function validateForm(formState) {
    if (!formState.form.reportValidity()) {
      return false;
    }

    const values = collectValues(formState);
    const invalid = formState.fields.find(function (field) {
      if (field[2] === "text") {
        return formState.form.elements[field[1]].required && !values[field[1]];
      }
      if (field[2] === "integer") {
        return !Number.isInteger(values[field[1]]) || values[field[1]] < 1;
      }
      if (field[2] === "number") {
        return !Number.isFinite(values[field[1]]) || values[field[1]] <= 0;
      }
      return false;
    });

    if (invalid) {
      const element = document.getElementById(invalid[0]);
      element.setCustomValidity("Vui lòng nhập giá trị hợp lệ lớn hơn 0.");
      element.reportValidity();
      element.addEventListener("input", function clearCustomValidity() {
        element.setCustomValidity("");
        element.removeEventListener("input", clearCustomValidity);
      });
      return false;
    }

    if (formState.name === "transport" && !["whole_vehicle", "goods_only"].includes(values.booking_type)) {
      const bookingType = document.getElementById("booking-type");
      bookingType.setCustomValidity("Vui lòng chọn thuê nguyên xe hoặc gửi hàng.");
      bookingType.reportValidity();
      bookingType.addEventListener("change", function clearCustomValidity() {
        bookingType.setCustomValidity("");
        bookingType.removeEventListener("change", clearCustomValidity);
      });
      return false;
    }

    return true;
  }

  async function isAuthenticated() {
    try {
      await window.apiRequest("/api/v1/auth/me", { method: "GET" });
      return true;
    } catch (error) {
      if (error && error.status === 401) {
        return false;
      }
      throw error;
    }
  }

  async function handleSubmit(formState, event) {
    event.preventDefault();
    renderStatus(formState, null);
    if (!validateForm(formState)) {
      return;
    }

    const submitButton = formState.form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    renderStatus(formState, "loading", "Đang kiểm tra phiên đăng nhập...");

    try {
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        if (saveDraft(formState)) {
          window.location.assign(loginUrl.href);
        }
        return;
      }

      renderStatus(formState, "loading", "Đang gửi yêu cầu...");
      await window.apiRequest(formState.endpoint, {
        method: "POST",
        body: collectValues(formState)
      });
      sessionStorage.removeItem(draftKeys[formState.name]);
      formState.form.reset();
      renderStatus(formState, "success", "Đã gửi yêu cầu. Báo giá sẽ được cung cấp sau khi hệ thống xử lý.");
    } catch (error) {
      if (error && error.status === 401) {
        if (saveDraft(formState)) {
          window.location.assign(loginUrl.href);
        }
        return;
      }
      renderStatus(
        formState,
        "error",
        error && typeof error.message === "string" ? error.message : "Không thể gửi yêu cầu. Vui lòng thử lại."
      );
    } finally {
      submitButton.disabled = false;
    }
  }

  forms.forEach(function (formState) {
    restoreDraft(formState);
    formState.fields.forEach(function (field) {
      const element = document.getElementById(field[0]);
      element.addEventListener("input", function () {
        element.setCustomValidity("");
      });
      element.addEventListener("change", function () {
        element.setCustomValidity("");
      });
    });
    formState.form.addEventListener("submit", function (event) {
      handleSubmit(formState, event);
    });
  });

  reducedMotion.addEventListener("change", startServiceCarousel);
  loadServiceSlides();
})();
