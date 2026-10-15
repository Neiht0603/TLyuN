(function () {
  "use strict";

  const scriptUrl = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : document.baseURI;
  const componentUrls = {
    header: new URL("../../components/header.html", scriptUrl),
    footer: new URL("../../components/footer.html", scriptUrl)
  };
  const mobileMenuQuery = window.matchMedia("(max-width: 48rem)");

  function syncMenuState() {
    document.querySelectorAll("[data-menu-toggle]").forEach(function (toggle) {
      const menuId = toggle.getAttribute("aria-controls");
      const menu = menuId && document.getElementById(menuId);
      if (menu) {
        menu.hidden = mobileMenuQuery.matches;
        toggle.setAttribute("aria-expanded", "false");
        const header = toggle.closest("[data-overlay-header]");
        if (header) {
          header.classList.remove("menu-open");
        }
      }
    });
  }

  function updateHeaderOnScroll() {
    document.querySelectorAll("[data-overlay-header]").forEach(function (header) {
      header.classList.toggle("is-scrolled", window.scrollY > 24);
    });
  }

  async function loadComponent(element) {
    const name = element.dataset.component;
    const url = element.dataset.src || componentUrls[name];

    if (!url) {
      console.error("Unknown shared component:", name);
      return;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Component request failed with HTTP " + response.status);
      }

      const markup = await response.text();
      if (!markup.trim()) {
        throw new Error("Shared component is empty: " + name);
      }
      element.innerHTML = markup;
      if (name === "header" && !document.getElementById("home-hero")) {
        const header = element.querySelector("[data-overlay-header]");
        if (header) {
          header.classList.remove("site-header--overlay");
          header.removeAttribute("data-overlay-header");
        }
      }
    } catch (error) {
      console.error("Unable to load shared component:", name, error);
      element.dispatchEvent(new CustomEvent("component:error", {
        bubbles: true,
        detail: { component: name, error: error }
      }));
    }
  }

  function initializeMobileMenu() {
    document.addEventListener("click", function (event) {
      const toggle = event.target.closest("[data-menu-toggle]");
      if (toggle) {
        const menuId = toggle.getAttribute("aria-controls");
        const menu = menuId && document.getElementById(menuId);
        if (!menu) {
          console.error("Mobile menu target was not found:", menuId);
          return;
        }

        const isExpanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!isExpanded));
        menu.hidden = isExpanded;
        const header = toggle.closest("[data-overlay-header]");
        if (header) {
          header.classList.toggle("menu-open", !isExpanded && mobileMenuQuery.matches);
        }
        return;
      }

      if (mobileMenuQuery.matches && event.target.closest("[data-menu-link]")) {
        const header = event.target.closest(".site-header");
        const menu = header && header.querySelector("[data-mobile-menu]");
        const menuToggle = header && header.querySelector("[data-menu-toggle]");
        if (menu && menuToggle) {
          menu.hidden = true;
          menuToggle.setAttribute("aria-expanded", "false");
          const header = menuToggle.closest("[data-overlay-header]");
          if (header) {
            header.classList.remove("menu-open");
          }
        }
      }
    });
  }

  function initializeRetryButtons() {
    document.addEventListener("click", function (event) {
      const button = event.target.closest("[data-retry]");
      if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") {
        return;
      }

      const targetId = button.dataset.retryTarget;
      const target = targetId ? document.getElementById(targetId) : button;
      if (targetId && !target) {
        console.error("Retry target was not found:", targetId);
        return;
      }

      target.dispatchEvent(new CustomEvent("app:retry", {
        bubbles: true,
        detail: { button: button }
      }));
    });
  }

  async function initialize() {
    initializeMobileMenu();
    initializeRetryButtons();

    const componentElements = document.querySelectorAll("[data-component]");
    await Promise.all(Array.from(componentElements, loadComponent));
    syncMenuState();
    updateHeaderOnScroll();
    document.querySelectorAll("[data-current-year]").forEach(function (element) {
      element.textContent = String(new Date().getFullYear());
    });
  }

  mobileMenuQuery.addEventListener("change", syncMenuState);
  window.addEventListener("scroll", updateHeaderOnScroll, { passive: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
