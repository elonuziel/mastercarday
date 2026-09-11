/**
 * Mastercard Day Israel - Web Application Controller
 * Handles data fetching, live countdown to 10th of the month,
 * category filtering, search, view modes, and 1-click coupon copying.
 */

(() => {
  // Application State
  const state = {
    allDeals: [],
    filteredDeals: [],
    categories: ["הכל"],
    activeCategory: "הכל",
    searchQuery: "",
    sortBy: "discount-desc",
    viewMode: localStorage.getItem("mc_view_mode") || "grid",
    theme: localStorage.getItem("mc_theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  };

  // DOM Element Selectors
  const elements = {
    // Theme & Navigation
    themeToggleBtn: document.getElementById("theme-toggle-btn"),
    themeIconMoon: document.getElementById("theme-icon-moon"),
    themeIconSun: document.getElementById("theme-icon-sun"),
    viewGridBtn: document.getElementById("view-grid-btn"),
    viewTableBtn: document.getElementById("view-table-btn"),
    
    // Countdown
    countdownStatusText: document.getElementById("countdown-status-text"),
    cdDays: document.getElementById("cd-days"),
    cdHours: document.getElementById("cd-hours"),
    cdMinutes: document.getElementById("cd-minutes"),
    cdSeconds: document.getElementById("cd-seconds"),

    // Stats
    statTotalDeals: document.getElementById("stat-total-deals"),
    statMaxDiscount: document.getElementById("stat-max-discount"),
    statLastUpdated: document.getElementById("stat-last-updated"),

    // Search & Filter
    searchInput: document.getElementById("search-input"),
    searchClearBtn: document.getElementById("search-clear-btn"),
    sortSelect: document.getElementById("sort-select"),
    categoryPillsContainer: document.getElementById("category-pills-container"),
    filteredCount: document.getElementById("filtered-count"),
    resetFiltersBtn: document.getElementById("reset-filters-btn"),

    // Content Containers
    dealsGrid: document.getElementById("deals-grid"),
    dealsTableContainer: document.getElementById("deals-table-container"),
    dealsTableBody: document.getElementById("deals-table-body"),
    emptyState: document.getElementById("empty-state"),
    toastContainer: document.getElementById("toast-container")
  };

  // ==========================================
  // Initialization
  // ==========================================
  async function init() {
    initTheme();
    initViewMode();
    setupEventListeners();
    startCountdownTimer();
    await loadCatalogData();
    handleHashNavigation();
  }

  // ==========================================
  // Theme Management
  // ==========================================
  function initTheme() {
    if (state.theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
  }

  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("mc_theme", state.theme);
    initTheme();
    refreshIcons();
  }

  // ==========================================
  // View Mode (Grid vs Table)
  // ==========================================
  function initViewMode() {
    updateViewModeUI();
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    localStorage.setItem("mc_view_mode", mode);
    updateViewModeUI();
    renderDeals();
  }

  function updateViewModeUI() {
    const isGrid = state.viewMode === "grid";
    if (isGrid) {
      elements.viewGridBtn.className = "p-1.5 rounded-lg text-sm font-medium transition-all bg-white dark:bg-slate-700 shadow-xs text-red-600 dark:text-red-400";
      elements.viewTableBtn.className = "p-1.5 rounded-lg text-sm font-medium transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
      elements.dealsGrid.classList.remove("hidden");
      elements.dealsTableContainer.classList.add("hidden");
    } else {
      elements.viewGridBtn.className = "p-1.5 rounded-lg text-sm font-medium transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
      elements.viewTableBtn.className = "p-1.5 rounded-lg text-sm font-medium transition-all bg-white dark:bg-slate-700 shadow-xs text-red-600 dark:text-red-400";
      elements.dealsGrid.classList.add("hidden");
      elements.dealsTableContainer.classList.remove("hidden");
    }
    refreshIcons();
  }

  // ==========================================
  // Countdown Timer Logic
  // ==========================================
  function getNextMastercardDay() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    const currentDay = now.getDate();
    const currentHour = now.getHours();

    // Event window: 10th 10:00 to 11th 23:59
    const eventStart = new Date(currentYear, currentMonth, 10, 10, 0, 0);
    const eventEnd = new Date(currentYear, currentMonth, 11, 23, 59, 59);

    if (now >= eventStart && now <= eventEnd) {
      return { isLive: true, targetDate: eventEnd };
    }

    if (now < eventStart) {
      return { isLive: false, targetDate: eventStart };
    }

    // After 11th, target is 10th of next month
    const nextMonth = (currentMonth + 1) % 12;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    return { isLive: false, targetDate: new Date(nextYear, nextMonth, 10, 10, 0, 0) };
  }

  function startCountdownTimer() {
    function update() {
      const { isLive, targetDate } = getNextMastercardDay();
      const now = new Date();
      const diffMs = targetDate - now;

      if (isLive) {
        elements.countdownStatusText.textContent = "🔥 יום מאסטרקארד פעיל עכשיו! ההטבות בתוקף";
      } else {
        const targetMonthName = targetDate.toLocaleDateString("he-IL", { month: "long" });
        elements.countdownStatusText.textContent = `מתכוננים ל-10 ב${targetMonthName}`;
      }

      if (diffMs <= 0) {
        elements.cdDays.textContent = "00";
        elements.cdHours.textContent = "00";
        elements.cdMinutes.textContent = "00";
        elements.cdSeconds.textContent = "00";
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const days = Math.floor(totalSeconds / (3600 * 24));
      const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = Math.floor(totalSeconds % 60);

      elements.cdDays.textContent = String(days).padStart(2, "0");
      elements.cdHours.textContent = String(hours).padStart(2, "0");
      elements.cdMinutes.textContent = String(minutes).padStart(2, "0");
      elements.cdSeconds.textContent = String(seconds).padStart(2, "0");
    }

    update();
    setInterval(update, 1000);
  }

  // ==========================================
  // Data Fetching & Processing
  // ==========================================
  async function loadCatalogData() {
    try {
      const response = await fetch(`data/deals.json?v=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      state.allDeals = data.deals || [];
      state.categories = data.metadata?.categories || ["הכל"];

      updateStatsRibbon(data.metadata);
      renderCategoryPills();
      applyFilters();
    } catch (err) {
      console.error("Failed to load catalog data:", err);
      showToast("שגיאה בטעינת נתוני ההטבות. נסה לרענן את העמוד.", "error");
    }
  }

  function updateStatsRibbon(metadata) {
    if (!metadata) return;

    elements.statTotalDeals.textContent = `${metadata.total_deals || state.allDeals.length}`;

    // Find highest discount
    let maxPct = 0;
    let maxNis = 0;
    state.allDeals.forEach(d => {
      if (d.discount_type === "percent" && d.discount_numeric > maxPct) maxPct = d.discount_numeric;
      if (d.discount_type === "fixed" && d.discount_numeric > maxNis) maxNis = d.discount_numeric;
    });

    elements.statMaxDiscount.textContent = maxNis > 0 ? `₪${maxNis} / ${maxPct}%` : `${maxPct}%`;

    if (metadata.last_updated) {
      const date = new Date(metadata.last_updated);
      elements.statLastUpdated.textContent = date.toLocaleDateString("he-IL", {
        day: "2-digit",
        month: "2-digit"
      });
    }
  }

  // ==========================================
  // Category Pills
  // ==========================================
  function renderCategoryPills() {
    elements.categoryPillsContainer.innerHTML = "";

    state.categories.forEach(cat => {
      const count = cat === "הכל"
        ? state.allDeals.length
        : state.allDeals.filter(d => d.category === cat).length;

      const isActive = state.activeCategory === cat;

      const button = document.createElement("button");
      button.className = `shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
        isActive
          ? "bg-red-600 text-white shadow-sm"
          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
      }`;

      button.innerHTML = `
        <span>${escapeHtml(cat)}</span>
        <span class="px-1.5 py-0.2 text-[10px] rounded-full ${
          isActive
            ? "bg-red-700/80 text-white"
            : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
        }">${count}</span>
      `;

      button.addEventListener("click", () => {
        state.activeCategory = cat;
        renderCategoryPills();
        applyFilters();
      });

      elements.categoryPillsContainer.appendChild(button);
    });
  }

  // ==========================================
  // Filtering & Sorting
  // ==========================================
  function applyFilters() {
    const q = state.searchQuery.trim().toLowerCase();

    state.filteredDeals = state.allDeals.filter(deal => {
      // Category check
      if (state.activeCategory !== "הכל" && deal.category !== state.activeCategory) {
        return false;
      }

      // Search query check
      if (q) {
        const haystack = `${deal.brand} ${deal.title} ${deal.coupon} ${deal.category} ${deal.description}`.toLowerCase();
        if (!haystack.includes(q)) {
          return false;
        }
      }

      return true;
    });

    // Sort deals
    if (state.sortBy === "discount-desc") {
      state.filteredDeals.sort((a, b) => b.discount_numeric - a.discount_numeric);
    } else if (state.sortBy === "brand-asc") {
      state.filteredDeals.sort((a, b) => a.brand.localeCompare(b.brand, "he"));
    }

    // Update count
    elements.filteredCount.textContent = state.filteredDeals.length;

    // Toggle clear search button
    elements.searchClearBtn.classList.toggle("hidden", !state.searchQuery);

    renderDeals();
  }

  // ==========================================
  // Rendering Views
  // ==========================================
  function renderDeals() {
    if (state.filteredDeals.length === 0) {
      elements.dealsGrid.classList.add("hidden");
      elements.dealsTableContainer.classList.add("hidden");
      elements.emptyState.classList.remove("hidden");
      refreshIcons();
      return;
    }

    elements.emptyState.classList.add("hidden");

    if (state.viewMode === "grid") {
      elements.dealsGrid.classList.remove("hidden");
      elements.dealsTableContainer.classList.add("hidden");
      renderGridView();
    } else {
      elements.dealsGrid.classList.add("hidden");
      elements.dealsTableContainer.classList.remove("hidden");
      renderTableView();
    }

    refreshIcons();
  }

  function renderGridView() {
    elements.dealsGrid.innerHTML = state.filteredDeals.map(deal => {
      const hasImage = deal.image && !deal.image.includes("sep.png") && !deal.image.includes(".svg");
      const couponCode = deal.coupon || "MASTERCARDAY";
      const directUrl = deal.url || "https://www.mastercard.com/il/he/%D7%90%D7%99%D7%A9%D7%99/find-a-card/card-benefits/mastercard-day.html";

      return `
        <article id="${deal.id}" class="deal-card relative flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-md hover:border-red-300 dark:hover:border-red-900/60">
          
          <!-- Card Image & Header -->
          <div class="relative h-44 bg-slate-100 dark:bg-slate-900 overflow-hidden flex items-center justify-center">
            ${
              hasImage
                ? `<img src="${escapeHtml(deal.image)}" alt="${escapeHtml(deal.brand)}" class="w-full h-full object-cover" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'flex items-center justify-center w-full h-full bg-gradient-to-br from-red-600/10 to-amber-500/10 font-bold text-red-600 text-xl\\'>${escapeHtml(deal.brand)}</div>'" />`
                : `<div class="flex flex-col items-center justify-center gap-1 w-full h-full bg-gradient-to-br from-red-600/10 to-amber-500/10 text-red-600 dark:text-red-400">
                     <i data-lucide="sparkles" class="w-8 h-8 opacity-60"></i>
                     <span class="font-bold text-lg">${escapeHtml(deal.brand)}</span>
                   </div>`
            }

            <!-- Discount Badge -->
            <div class="absolute top-3 right-3 px-3 py-1 rounded-xl bg-red-600 text-white text-xs font-black shadow-md flex items-center gap-1">
              <i data-lucide="percent" class="w-3 h-3"></i>
              <span>${escapeHtml(deal.discount)}</span>
            </div>

            <!-- Category & Validity Badges -->
            <div class="absolute bottom-3 right-3 flex items-center gap-1.5 flex-wrap">
              <span class="px-2.5 py-0.5 rounded-lg bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-medium">
                ${escapeHtml(deal.category)}
              </span>
              <span class="px-2.5 py-0.5 rounded-lg bg-amber-500/90 backdrop-blur-md text-slate-950 text-[11px] font-semibold">
                ${escapeHtml(deal.validity)}
              </span>
            </div>
          </div>

          <!-- Card Content Body -->
          <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <h3 class="font-bold text-base text-slate-900 dark:text-white leading-tight">
                  ${escapeHtml(deal.brand)}
                </h3>
                <button onclick="window.copyDealLink('${deal.id}')" title="שתף הטבה" class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition hover:bg-slate-100 dark:hover:bg-slate-700">
                  <i data-lucide="share-2" class="w-4 h-4"></i>
                </button>
              </div>
              <p class="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                ${escapeHtml(deal.title)}
              </p>
            </div>

            <!-- Coupon Box & 1-Click Copy -->
            <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 overflow-hidden">
                <i data-lucide="ticket" class="w-4 h-4 text-amber-500 shrink-0"></i>
                <div class="text-right truncate">
                  <div class="text-[10px] text-slate-400 font-medium">קוד קופון:</div>
                  <div class="font-mono font-bold text-xs text-slate-900 dark:text-amber-400 tracking-wider select-all">${escapeHtml(couponCode)}</div>
                </div>
              </div>
              <button onclick="window.copyCoupon('${escapeHtml(couponCode)}')" class="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                <span>העתק</span>
              </button>
            </div>

            <!-- Action Buttons -->
            <div class="space-y-2 pt-1">
              <a href="${escapeHtml(directUrl)}" target="_blank" rel="noopener noreferrer" class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold transition shadow-xs">
                <span>מעבר לאתר ההטבה</span>
                <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
              </a>

              <!-- Accordion Terms -->
              <details class="group text-xs text-slate-500 dark:text-slate-400">
                <summary class="cursor-pointer list-none flex items-center justify-between py-1 text-[11px] font-medium hover:text-slate-700 dark:hover:text-slate-200">
                  <span>תנאי המבצע ותקנון</span>
                  <i data-lucide="chevron-down" class="w-3.5 h-3.5 transition group-open:rotate-180"></i>
                </summary>
                <div class="mt-2 p-2.5 rounded-lg bg-slate-100/70 dark:bg-slate-900/60 text-[11px] leading-relaxed border border-slate-200/60 dark:border-slate-800">
                  ${escapeHtml(deal.description)}
                </div>
              </details>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderTableView() {
    elements.dealsTableBody.innerHTML = state.filteredDeals.map(deal => {
      const couponCode = deal.coupon || "MASTERCARDAY";
      const directUrl = deal.url || "#";

      return `
        <tr id="${deal.id}" class="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
          <td class="px-4 py-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
            ${escapeHtml(deal.brand)}
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap">
            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300">
              ${escapeHtml(deal.discount)}
            </span>
          </td>
          <td class="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate">
            ${escapeHtml(deal.title)}
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap">
            <div class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs">
              <span class="font-bold text-slate-800 dark:text-amber-400">${escapeHtml(couponCode)}</span>
              <button onclick="window.copyCoupon('${escapeHtml(couponCode)}')" title="העתק קוד" class="text-slate-400 hover:text-red-600">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
          <td class="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            ${escapeHtml(deal.validity)}
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap text-center">
            <div class="flex items-center justify-center gap-2">
              <a href="${escapeHtml(directUrl)}" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600" title="מעבר לאתר">
                <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
              </a>
              <button onclick="window.copyDealLink('${deal.id}')" class="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700" title="שתף קישור">
                <i data-lucide="share-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  // ==========================================
  // User Actions (Copy, Share, Hash)
  // ==========================================
  window.copyCoupon = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast(`קוד הקופון <strong>${code}</strong> הועתק ללוח!`, "success");
    } catch (err) {
      showToast("שגיאה בהעתקת הקוד", "error");
    }
  };

  window.copyDealLink = async (dealId) => {
    const url = new URL(window.location.href);
    url.hash = dealId;
    try {
      await navigator.clipboard.writeText(url.toString());
      showToast("קישור ישיר להטבה הועתק ללוח!", "success");
    } catch (err) {
      showToast("שגיאה בהעתקת הקישור", "error");
    }
  };

  function handleHashNavigation() {
    if (window.location.hash) {
      const targetId = window.location.hash.substring(1);
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-red-500", "ring-offset-2");
          setTimeout(() => {
            el.classList.remove("ring-2", "ring-red-500", "ring-offset-2");
          }, 3000);
        }
      }, 500);
    }
  }

  // ==========================================
  // Toast Notifications
  // ==========================================
  function showToast(htmlMessage, type = "info") {
    const toast = document.createElement("div");
    const isError = type === "error";

    toast.className = `toast mb-2 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
      isError
        ? "bg-red-700 text-white"
        : "bg-slate-900 text-white border border-slate-700"
    }`;

    toast.innerHTML = `
      <i data-lucide="${isError ? 'alert-circle' : 'check-circle-2'}" class="w-4 h-4 ${isError ? 'text-white' : 'text-emerald-400'}"></i>
      <span>${htmlMessage}</span>
    `;

    elements.toastContainer.appendChild(toast);
    refreshIcons();

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(12px)";
      toast.style.transition = "all 0.25s ease";
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  // ==========================================
  // Event Listeners & Helpers
  // ==========================================
  function setupEventListeners() {
    // Theme toggle
    elements.themeToggleBtn.addEventListener("click", toggleTheme);

    // View toggles
    elements.viewGridBtn.addEventListener("click", () => setViewMode("grid"));
    elements.viewTableBtn.addEventListener("click", () => setViewMode("table"));

    // Search input
    let debounceTimer;
    elements.searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.searchQuery = e.target.value;
        applyFilters();
      }, 200);
    });

    // Clear search
    elements.searchClearBtn.addEventListener("click", () => {
      elements.searchInput.value = "";
      state.searchQuery = "";
      applyFilters();
      elements.searchInput.focus();
    });

    // Sort select
    elements.sortSelect.addEventListener("change", (e) => {
      state.sortBy = e.target.value;
      applyFilters();
    });

    // Reset filters
    elements.resetFiltersBtn.addEventListener("click", () => {
      elements.searchInput.value = "";
      state.searchQuery = "";
      state.activeCategory = "הכל";
      state.sortBy = "discount-desc";
      elements.sortSelect.value = "discount-desc";
      renderCategoryPills();
      applyFilters();
    });
  }

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Start Application
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
