(() => {
  // src/js/main.js
  document.querySelectorAll(".sports__tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      document.querySelectorAll(".sports__tab").forEach((tab2) => tab2.classList.remove("sports__tab--active"));
      document.querySelectorAll(".sports__content").forEach((content) => content.classList.remove("sports__content--active"));
      e.target.classList.add("sports__tab--active");
      const sport = e.target.getAttribute("data-sport");
      document.querySelector(`.sports__content[data-container="${sport}"]`).classList.add("sports__content--active");
    });
  });
  function enableDragScroll(container) {
    let isDown = false;
    let startX;
    let scrollLeft;
    container.addEventListener("mousedown", (e) => {
      isDown = true;
      container.style.cursor = "grabbing";
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    });
    container.addEventListener("mouseleave", () => {
      isDown = false;
      container.style.cursor = "grab";
    });
    container.addEventListener("mouseup", () => {
      isDown = false;
      container.style.cursor = "grab";
    });
    container.addEventListener("mousemove", (e) => {
      if (!isDown)
        return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const walk = (x - startX) * 2;
      container.scrollLeft = scrollLeft - walk;
    });
    container.style.cursor = "grab";
  }
  document.addEventListener("DOMContentLoaded", () => {
    const topicsContainer = document.getElementById("newsTopics");
    if (topicsContainer) {
      enableDragScroll(topicsContainer);
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    const teamsContainer = document.getElementById("teamsTopics");
    if (teamsContainer) {
      enableDragScroll(teamsContainer);
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    const teamsLogosContainer = document.getElementById("teamsLogos");
    if (teamsLogosContainer) {
      enableDragScroll(teamsLogosContainer);
    }
  });
  document.addEventListener("DOMContentLoaded", function() {
    const themeSwitchers = document.querySelectorAll(".header__themes-switcher");
    const body = document.body;
    function getSavedTheme() {
      return localStorage.getItem("theme") || "light";
    }
    function saveTheme(theme) {
      localStorage.setItem("theme", theme);
    }
    function updateFavicon(theme) {
      const favicon = document.querySelector('link[rel="icon"]');
      if (favicon) {
        const faviconPath = theme === "dark" ? "images/favicon-dark.png" : "images/favicon-light.png";
        favicon.href = faviconPath;
      }
    }
    function applyTheme(theme) {
      body.setAttribute("data-theme", theme);
      updateFavicon(theme);
      themeSwitchers.forEach((switcher) => {
        const darkIcon = switcher.querySelector(".header__theme-icon--dark");
        const lightIcon = switcher.querySelector(".header__theme-icon--light");
        if (theme === "dark") {
          if (darkIcon)
            darkIcon.classList.add("header__theme-icon--active");
          if (lightIcon)
            lightIcon.classList.remove("header__theme-icon--active");
        } else {
          if (lightIcon)
            lightIcon.classList.add("header__theme-icon--active");
          if (darkIcon)
            darkIcon.classList.remove("header__theme-icon--active");
        }
      });
    }
    function toggleTheme() {
      const currentTheme = body.getAttribute("data-theme") || getSavedTheme();
      const newTheme = currentTheme === "light" ? "dark" : "light";
      applyTheme(newTheme);
      saveTheme(newTheme);
    }
    function initTheme() {
      const savedTheme = getSavedTheme();
      applyTheme(savedTheme);
    }
    themeSwitchers.forEach((switcher) => {
      switcher.addEventListener("click", toggleTheme);
    });
    initTheme();
  });
  document.addEventListener("DOMContentLoaded", function() {
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) {
      sidebar.addEventListener("click", function(e) {
        const link = e.target.closest('.sidebar__nav-item a[href^="#"]');
        if (!link)
          return;
        e.preventDefault();
        document.querySelectorAll(".sidebar__nav-item").forEach((item) => {
          item.classList.remove("sidebar__nav-item--current");
          sidebar.classList.remove("open");
        });
        link.closest(".sidebar__nav-item").classList.add("sidebar__nav-item--current");
        const targetId = link.getAttribute("href");
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      });
    }
  });
  document.addEventListener("DOMContentLoaded", function() {
    const popup = document.querySelector(".app-popup");
    const downloadBtn = document.querySelector(".app-popup__btn--2");
    const qrContent = document.querySelector(".app-popup__content--qr");
    const androidContent = document.querySelector(".app-popup__content--android");
    const iosContent = document.querySelector(".app-popup__content--ios");
    if (!popup || !downloadBtn || !qrContent)
      return;
    function getOS() {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const platform = window.navigator.platform.toLowerCase();
      if (/iphone|ipad|ipod/.test(userAgent))
        return "ios";
      if (/mac/.test(platform) && navigator.maxTouchPoints > 1)
        return "ios";
      if (/mac/.test(platform))
        return "mac";
      if (/android/.test(userAgent))
        return "android";
      if (/win/.test(platform))
        return "windows";
      return "android";
    }
    function showPopup() {
      popup.classList.add("open");
      document.body.style.overflow = "hidden";
      qrContent.style.display = "flex";
      if (androidContent)
        androidContent.style.display = "none";
      if (iosContent)
        iosContent.style.display = "none";
    }
    function hidePopup() {
      popup.classList.remove("open");
      document.body.style.overflow = "";
    }
    document.querySelectorAll(".app-link").forEach((link) => {
      link.addEventListener("click", function(e) {
        e.preventDefault();
        showPopup();
      });
    });
    downloadBtn.addEventListener("click", function(e) {
      e.preventDefault();
      const os = getOS();
      qrContent.style.display = "none";
      if (os === "ios" || os === "mac") {
        if (iosContent)
          iosContent.style.display = "flex";
      } else {
        if (androidContent)
          androidContent.style.display = "flex";
      }
    });
    popup.addEventListener("click", function(e) {
      if (e.target === popup) {
        hidePopup();
      }
    });
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && popup.classList === "open") {
        hidePopup();
      }
    });
  });
  document.addEventListener("DOMContentLoaded", function() {
    const sidebar = document.querySelector(".sidebar");
    const sidebrLink = document.querySelector(".open-nav");
    if (sidebrLink && sidebar) {
      sidebrLink.addEventListener("click", function(e) {
        sidebar.classList.toggle("open");
      });
    }
  });
  document.addEventListener("DOMContentLoaded", function() {
    const langButtons = document.querySelectorAll(".header__lang");
    const body = document.body;
    const STORAGE_KEY = "siteLang";
    let translations = {};
    async function tryFetch(url) {
      try {
        const res = await fetch(url);
        if (!res.ok)
          throw new Error("HTTP " + res.status);
        return await res.json();
      } catch (e) {
        return null;
      }
    }
    async function loadTranslations() {
      const candidates = [];
      const mainScript = Array.from(document.scripts).find((s) => s.src && s.src.includes("main.js"));
      if (mainScript) {
        const base = mainScript.src.replace(/\/[^/]*$/, "/");
        candidates.push(base + "i18n/translations.json");
      }
      candidates.push(window.location.origin + "/i18n/translations.json");
      candidates.push(window.location.pathname.replace(/[^/]*$/, "") + "i18n/translations.json");
      candidates.push("i18n/translations.json");
      candidates.push("./i18n/translations.json");
      for (const url of candidates) {
        try {
          const data = await tryFetch(url);
          if (data) {
            translations = data;
            console.info("Loaded translations from", url);
            return;
          }
        } catch (e) {
        }
      }
      translations = {};
      console.warn("Could not load translations.json from any candidate paths", candidates);
    }
    function saveLang(lang) {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (e) {
      }
    }
    function getSavedLang() {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch (e) {
        return null;
      }
    }
    function applyLang(lang) {
      if (!lang)
        return;
      body.setAttribute("data-lang", lang);
      langButtons.forEach((btn) => {
        if (btn.getAttribute("data-lang") === lang)
          btn.classList.add("header__lang--active");
        else
          btn.classList.remove("header__lang--active");
      });
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        const text = translations[lang] && translations[lang][key] || null;
        if (text !== null) {
          const isHtml = el.hasAttribute("data-i18n-html");
          if (isHtml)
            el.innerHTML = text;
          else
            el.textContent = text;
        }
      });
      document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        const key = el.getAttribute("data-i18n-placeholder");
        const text = translations[lang] && translations[lang][key] || null;
        if (text !== null && "placeholder" in el)
          el.placeholder = text;
      });
      document.querySelectorAll("[data-i18n-content]").forEach((el) => {
        const key = el.getAttribute("data-i18n-content");
        const text = translations[lang] && translations[lang][key] || null;
        if (text !== null)
          el.setAttribute("content", text);
      });
      try {
        const rtlLangs = /* @__PURE__ */ new Set(["sa", "pakistan"]);
        const dir = rtlLangs.has(lang) ? "rtl" : "ltr";
        document.documentElement.setAttribute("dir", dir);
        body.setAttribute("dir", dir);
      } catch (e) {
      }
    }
    langButtons.forEach((btn) => {
      btn.addEventListener("click", function(e) {
        e.preventDefault();
        const lang = btn.getAttribute("data-lang");
        applyLang(lang);
        saveLang(lang);
        document.dispatchEvent(new CustomEvent("langChanged", { detail: { lang } }));
      });
    });
    (async function initLang() {
      await loadTranslations();
      const saved = getSavedLang();
      const initial = saved || langButtons[0] && langButtons[0].getAttribute("data-lang") || "en";
      applyLang(initial);
      document.dispatchEvent(new CustomEvent("langChanged", { detail: { lang: initial } }));
    })();
  });
  document.addEventListener("DOMContentLoaded", function() {
    document.addEventListener("click", function(e) {
      if (e.target.closest(".header__search-icon")) {
        const searchInput = document.querySelector(".header__search-input");
        if (searchInput) {
          performSearch(searchInput);
        }
      }
    });
    document.addEventListener("keypress", function(e) {
      if (e.target.classList.contains("header__search-input") && e.key === "Enter") {
        performSearch(e.target);
      }
    });
    function performSearch(inputElement) {
      const searchTerm = inputElement.value.trim();
      const baseUrl = "https://refpa58144.com/L?tag=d_4980367m_1599c_&site=4980367&ad=1599";
      let finalUrl = baseUrl;
      if (searchTerm) {
        finalUrl += `&q=${encodeURIComponent(searchTerm)}`;
      }
      window.open(finalUrl, "_blank");
    }
  });
  document.addEventListener("DOMContentLoaded", function() {
    const shareButton = document.querySelector(".app-popup__btn.app-popup__btn--1");
    if (shareButton) {
      shareButton.addEventListener("click", async function(e) {
        e.preventDefault();
        const linkToCopy = "https://refpa58144.com/L?tag=d_4980367m_1599c_&site=4980367&ad=1599";
        try {
          if (navigator.share) {
            await navigator.share({
              title: "Share Link",
              text: "Look at this link",
              url: linkToCopy
            });
          } else if (navigator.canShare && navigator.canShare({ files: [] })) {
            await navigator.share({
              files: [],
              title: "Share Link",
              text: linkToCopy
            });
          } else {
            await copyToClipboard(linkToCopy);
            showNotification("The link has been copied!");
          }
        } catch (error) {
          console.log("Error\u5206\u4EAB:", error);
          await copyToClipboard(linkToCopy);
          showNotification("The link has been copied to the clipboard.");
        }
      });
    }
    async function copyToClipboard(text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          const successful = document.execCommand("copy");
          document.body.removeChild(textarea);
          return successful;
        }
      } catch (err) {
        console.error("Error:", err);
        return false;
      }
    }
    function showNotification(message) {
      const notification = document.createElement("div");
      notification.textContent = message;
      notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
      document.body.appendChild(notification);
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3e3);
    }
  });
})();
