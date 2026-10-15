(function () {
  "use strict";

  const state = {
    audience: "customer",
    slides: [],
    slideIndex: 0,
    timer: null
  };

  const sections = {
    hero: document.querySelector('[data-home-section="hero"]'),
    services: document.querySelector('[data-home-section="services"]'),
    articles: document.querySelector('[data-home-section="articles"]'),
    customers: document.querySelector('[data-home-section="customers"]')
  };

  function statusElement(section) {
    return section.querySelector("[data-status-container]");
  }

  function renderStatus(section, kind, message) {
    const status = statusElement(section);
    status.replaceChildren();
    if (!kind) {
      return;
    }

    const messageElement = document.createElement("p");
    messageElement.className = kind === "error" ? "notice notice--error" : kind === "empty" ? "empty-state" : "loading";
    messageElement.setAttribute("aria-busy", String(kind === "loading"));
    messageElement.textContent = message;
    status.append(messageElement);
  }

  function setLoading(section, message) {
    renderStatus(section, "loading", message || "Đang tải...");
  }

  function setError(section, error) {
    const message = error && typeof error.message === "string"
      ? error.message
      : "Không thể tải nội dung.";
    renderStatus(section, "error", message);
  }

  function setEmpty(section, message) {
    renderStatus(section, "empty", message || "Chưa có nội dung để hiển thị.");
  }

  function getCollection(data, keys) {
    if (Array.isArray(data)) {
      return data;
    }
    if (!data || typeof data !== "object") {
      throw new Error("Dữ liệu trả về không đúng định dạng.");
    }

    for (const key of keys) {
      if (Array.isArray(data[key])) {
        return data[key];
      }
    }
    throw new Error("Dữ liệu trả về không có danh sách hợp lệ.");
  }

  function getString(item, keys) {
    if (!item || typeof item !== "object") {
      return "";
    }
    for (const key of keys) {
      if (typeof item[key] === "string" && item[key].trim()) {
        return item[key].trim();
      }
    }
    return "";
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

  async function loadSettings() {
    const section = sections.hero;
    setLoading(section, "Đang tải cấu hình trang...");
    try {
      const settingsResponse = await window.apiRequest("/api/v1/site-settings");
      let settings = settingsResponse;
      if (settingsResponse && typeof settingsResponse === "object") {
        settings = settingsResponse.settings || settingsResponse.site_settings || settingsResponse;
      }
      if (Array.isArray(settings)) {
        settings = settings.reduce(function (result, entry) {
          const key = getString(entry, ["key", "name"]);
          if (key && entry.value !== undefined) {
            result[key] = entry.value;
          }
          return result;
        }, {});
      }

      if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        throw new Error("Cấu hình trang chưa đúng định dạng.");
      }

      const slogan = getString(settings, ["hero_slogan", "heroSlogan", "hero_title", "heroTitle", "slogan"]);
      if (slogan) {
        document.getElementById("hero-slogan").textContent = slogan;
      }

      const imageUrl = safeWebUrl(getString(settings, [
        "hero_image_url", "heroImageUrl", "hero_image", "heroImage", "hero_background_image"
      ]));
      const image = document.getElementById("hero-background");
      if (imageUrl) {
        image.src = imageUrl;
      }
      if (!slogan && !imageUrl) {
        setEmpty(section, "Chưa có cấu hình slogan hoặc ảnh nền; đang hiển thị nội dung mặc định.");
      } else {
        renderStatus(section, null);
      }
    } catch (error) {
      setError(section, error);
    }
  }

  document.getElementById("hero-background").addEventListener("error", function () {
    const image = this;
    const fallback = image.dataset.defaultSrc;
    const fallbackUrl = fallback ? new URL(fallback, document.baseURI).href : "";
    if (fallbackUrl && image.src !== fallbackUrl) {
      image.src = fallbackUrl;
    } else {
      image.hidden = true;
      console.error("Unable to load the homepage hero background image.");
    }
  });

  function getSlideImage(slide) {
    return safeWebUrl(getString(slide, ["image_url", "imageUrl", "image", "url"]));
  }

  function stopCarouselTimer() {
    if (state.timer !== null) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
  }

  function renderSlides() {
    const track = document.getElementById("service-carousel-track");
    const dots = document.getElementById("service-carousel-dots");
    track.replaceChildren();
    dots.replaceChildren();

    if (!state.slides.length) {
      return;
    }

    state.slides.forEach(function (slide, index) {
      const imageUrl = getSlideImage(slide);
      if (!imageUrl) {
        return;
      }

      const frame = document.createElement("a");
      frame.className = "service-slide";
      frame.href = "services.html";
      frame.setAttribute("aria-label", "Xem dịch vụ: " + (getString(slide, ["title", "name"]) || "Giải pháp kho hàng"));
      frame.tabIndex = index === state.slideIndex ? 0 : -1;
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = getString(slide, ["alt", "alt_text", "title", "name"]) || "Ảnh dịch vụ";
      image.width = 960;
      image.height = 640;
      image.loading = "lazy";
      image.decoding = "async";
      frame.append(image);
      track.append(frame);

      const dot = document.createElement("button");
      dot.className = "service-carousel__dot";
      dot.type = "button";
      dot.setAttribute("aria-label", "Hiển thị ảnh " + (index + 1) + " trên " + state.slides.length);
      dot.setAttribute("aria-current", String(index === state.slideIndex));
      dot.addEventListener("click", function () {
        state.slideIndex = index;
        updateSlideSelection();
        startCarouselTimer();
      });
      dots.append(dot);
    });

    updateSlideSelection();
  }

  function updateSlideSelection() {
    const slides = document.querySelectorAll("#service-carousel-track .service-slide");
    const dots = document.querySelectorAll("#service-carousel-dots .service-carousel__dot");
    slides.forEach(function (slide, index) {
      const active = index === state.slideIndex;
      slide.classList.toggle("service-slide--active", active);
      slide.setAttribute("aria-hidden", String(!active));
      slide.tabIndex = active ? 0 : -1;
    });
    dots.forEach(function (dot, index) {
      dot.setAttribute("aria-current", String(index === state.slideIndex));
    });
  }

  function startCarouselTimer() {
    stopCarouselTimer();
    if (state.slides.length < 2) {
      return;
    }
    state.timer = window.setInterval(function () {
      state.slideIndex = (state.slideIndex + 1) % state.slides.length;
      updateSlideSelection();
    }, 5000);
  }

  async function loadSlides() {
    const section = sections.services;
    const track = document.getElementById("service-carousel-track");
    setLoading(section, "Đang tải ảnh dịch vụ...");
    track.replaceChildren();
    stopCarouselTimer();
    try {
      const data = await window.apiRequest(
        "/api/v1/service-slides?audience=" + encodeURIComponent(state.audience)
      );
      const slides = getCollection(data, ["slides", "items", "service_slides"]);
      state.slides = slides.filter(function (slide) {
        return Boolean(getSlideImage(slide));
      });
      state.slideIndex = 0;

      if (!state.slides.length) {
        setEmpty(section, "Hiện chưa có ảnh dịch vụ.");
        return;
      }

      renderSlides();
      renderStatus(section, null);
      startCarouselTimer();
    } catch (error) {
      state.slides = [];
      setError(section, error);
    }
  }

  function renderArticles(items) {
    const list = document.getElementById("article-list");
    list.replaceChildren();

    items.forEach(function (item) {
      const title = getString(item, ["title", "name"]);
      if (!title) {
        return;
      }
      const card = document.createElement("article");
      card.className = "card article-card";

      const imageUrl = safeWebUrl(getString(item, [
        "image_url", "imageUrl", "image", "thumbnail_url", "thumbnailUrl", "thumbnail"
      ])) || new URL("../assets/images/warehouse-hero.jpg", document.baseURI).href;
      const image = document.createElement("img");
      image.className = "article-card__image";
      image.src = imageUrl;
      image.alt = getString(item, ["image_alt", "imageAlt", "alt_text", "alt"]) || title;
      image.width = 640;
      image.height = 480;
      image.loading = "lazy";
      image.decoding = "async";
      card.append(image);

      const content = document.createElement("div");
      content.className = "article-card__content";

      const publishedAt = getString(item, ["published_at", "publishedAt", "date"]);
      if (publishedAt) {
        const date = document.createElement("time");
        date.className = "article-card__date";
        date.dateTime = publishedAt;
        date.textContent = publishedAt;
        content.append(date);
      }

      const heading = document.createElement("h3");
      heading.className = "article-card__title";
      const href = safeWebUrl(getString(item, ["url", "link", "article_url", "articleUrl"]));
      if (href) {
        const link = document.createElement("a");
        link.href = href;
        link.textContent = title;
        heading.append(link);
      } else {
        heading.textContent = title;
      }
      content.append(heading);

      const summary = getString(item, ["summary", "excerpt", "description"]);
      if (summary) {
        const paragraph = document.createElement("p");
        paragraph.className = "article-card__summary";
        paragraph.textContent = summary;
        content.append(paragraph);
      }
      card.append(content);
      list.append(card);
    });
  }

  async function loadArticles() {
    const section = sections.articles;
    setLoading(section, "Đang tải bài viết...");
    try {
      const data = await window.apiRequest("/api/v1/articles");
      const items = getCollection(data, ["articles", "items", "results"]);
      renderArticles(items);
      if (!document.getElementById("article-list").childElementCount) {
        setEmpty(section, "Hiện chưa có bài viết.");
        return;
      }
      renderStatus(section, null);
    } catch (error) {
      setError(section, error);
    }
  }

  function renderCustomers(items) {
    const list = document.getElementById("customer-list");
    list.replaceChildren();

    items.forEach(function (item) {
      const name = getString(item, ["name", "display_name", "displayName", "company_name"]);
      if (!name) {
        return;
      }
      const listItem = document.createElement("li");
      listItem.className = "customer-list__item";
      const logoUrl = safeWebUrl(getString(item, ["logo_url", "logoUrl", "logo", "image_url"]));
      if (logoUrl) {
        const image = document.createElement("img");
        image.src = logoUrl;
        image.alt = name;
        image.width = 320;
        image.height = 128;
        image.loading = "lazy";
        image.decoding = "async";
        listItem.append(image);
      } else {
        listItem.textContent = name;
      }
      list.append(listItem);
    });
  }

  async function loadCustomers() {
    const section = sections.customers;
    setLoading(section, "Đang tải khách hàng và đối tác...");
    try {
      const data = await window.apiRequest("/api/v1/customers");
      const items = getCollection(data, ["customers", "partners", "items", "results"]);
      renderCustomers(items);
      if (!document.getElementById("customer-list").childElementCount) {
        setEmpty(section, "Hiện chưa có khách hàng hoặc đối tác để hiển thị.");
        return;
      }
      renderStatus(section, null);
    } catch (error) {
      setError(section, error);
    }
  }

  loadSettings();
  loadSlides();
  loadArticles();
  loadCustomers();
})();
