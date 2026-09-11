/**
 * Mastercard Day Israel - Web Application Controller
 * Handles data fetching, dynamic calendar date validity evaluation,
 * validity & category filtering, live countdown, search, and 1-click coupon copying.
 */

(() => {
  // Application State
  const state = {
    allDeals: [],
    filteredDeals: [],
    categories: ["הכל"],
    activeCategory: "הכל",
    activeValidityFilter: "all", // 'all', 'active_today', 'only_10th', '10_11th', 'all_month', 'expired'
    searchQuery: "",
    sortBy: "discount-desc",
    viewMode: localStorage.getItem("mc_view_mode") || "grid",
    theme: localStorage.getItem("mc_theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  };

  // DOM Elements
  const elements = {
    themeToggleBtn: document.getElementById("theme-toggle-btn"),
    viewGridBtn: document.getElementById("view-grid-btn"),
    viewTableBtn: document.getElementById("view-table-btn"),
    
    // Calendar context
    calendarTodayDot: document.getElementById("calendar-today-dot"),
    calendarTodayText: document.getElementById("calendar-today-text"),
    calendarStatusExplanation: document.getElementById("calendar-status-explanation"),

    // Countdown
    countdownTitle: document.getElementById("countdown-title"),
    cdDays: document.getElementById("cd-days"),
    cdHours: document.getElementById("cd-hours"),
    cdMinutes: document.getElementById("cd-minutes"),
    cdSeconds: document.getElementById("cd-seconds"),

    // Stats
    statTotalDeals: document.getElementById("stat-total-deals"),
    statActiveToday: document.getElementById("stat-active-today"),
    statLastUpdated: document.getElementById("stat-last-updated"),

    // Search & Filter
    searchInput: document.getElementById("search-input"),
    searchClearBtn: document.getElementById("search-clear-btn"),
    sortSelect: document.getElementById("sort-select"),
    validityPillsContainer: document.getElementById("validity-pills-container"),
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
    renderCalendarContext();
    startCountdownTimer();
    await loadCatalogData();
    handleHashNavigation();
  }

  function getDealValidityStatus(deal, date = new Date()) {
    const todayDay = date.getDate();
    const vCode = deal.validity_code || "only_10th";

    // 1. Tiered Deals (e.g. Airalo: 20% on 10-11th, 15% throughout the entire month)
    if (vCode === "10_11th_and_all_month") {
      const ongoingText = deal.ongoing_discount || "15% הנחה";
      if (todayDay === 10 || todayDay === 11) {
        return {
          status: "active_today",
          label: "בתוקף היום! (20% שיא)",
          subLabel: `${ongoingText} בשאר החודש`,
          activeDiscount: deal.discount,
          badgeClass: "bg-emerald-500/90 text-white border-emerald-400/50",
          dotClass: "bg-emerald-300",
          isExpired: false,
          isTiered: true
        };
      } else {
        // Active today with ongoing discount! Never expired!
        return {
          status: "active_today",
          label: `בתוקף היום! (${ongoingText})`,
          subLabel: "20% הנחה ב-10-11 בחודש",
          activeDiscount: ongoingText,
          badgeClass: "bg-emerald-600/90 text-white border-emerald-500/50",
          dotClass: "bg-emerald-300",
          isExpired: false,
          isTiered: true
        };
      }
    }

    // 2. All Month deals are always active today
    if (vCode === "all_month") {
      return {
        status: "active_today",
        label: "בתוקף היום! (כל החודש)",
        activeDiscount: deal.discount,
        badgeClass: "bg-emerald-500/90 text-white border-emerald-400/50",
        dotClass: "bg-emerald-300",
        isExpired: false
      };
    }

    // 3. 10th-11th deals
    if (vCode === "10_11th") {
      if (todayDay === 10 || todayDay === 11) {
        return {
          status: "active_today",
          label: "בתוקף היום! (10-11 בחודש)",
          activeDiscount: deal.discount,
          badgeClass: "bg-emerald-500/90 text-white border-emerald-400/50",
          dotClass: "bg-emerald-300",
          isExpired: false
        };
      } else if (todayDay > 11) {
        return {
          status: "expired",
          label: "פג תוקף לחודש זה",
          activeDiscount: deal.discount,
          badgeClass: "bg-slate-700/90 text-slate-300 border-slate-600",
          dotClass: "bg-slate-400",
          isExpired: true
        };
      } else {
        return {
          status: "upcoming",
          label: "החל מ-10-11 בחודש",
          activeDiscount: deal.discount,
          badgeClass: "bg-amber-500/90 text-slate-950 border-amber-400",
          dotClass: "bg-amber-300",
          isExpired: false
        };
      }
    }

    // 4. 10th Only deals
    if (todayDay === 10) {
      return {
        status: "active_today",
        label: "בתוקף היום בלבד!",
        activeDiscount: deal.discount,
        badgeClass: "bg-emerald-500/90 text-white border-emerald-400/50",
        dotClass: "bg-emerald-300",
        isExpired: false
      };
    } else if (todayDay > 10) {
      return {
        status: "expired",
        label: "פג תוקף לחודש זה",
        activeDiscount: deal.discount,
        badgeClass: "bg-slate-700/90 text-slate-300 border-slate-600",
        dotClass: "bg-slate-400",
        isExpired: true
      };
    } else {
      return {
        status: "upcoming",
        label: "החל מה-10 בחודש",
        activeDiscount: deal.discount,
        badgeClass: "bg-amber-500/90 text-slate-950 border-amber-400",
        dotClass: "bg-amber-300",
        isExpired: false
      };
    }
  }

  function renderCalendarContext() {
    const now = new Date();
    const todayDay = now.getDate();
    const dateFormatted = now.toLocaleDateString("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });

    elements.calendarTodayText.textContent = `היום: ${dateFormatted} (יום ${todayDay} בחודש)`;

    if (todayDay === 10) {
      elements.calendarTodayDot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-ping";
      elements.calendarStatusExplanation.innerHTML = `
        <strong class="text-emerald-400">🔥 יום מאסטרקארד בשיאו!</strong> כל 44 ההטבות והקופונים פעילים וממתינים למימוש היום.
      `;
    } else if (todayDay === 11) {
      elements.calendarTodayDot.className = "w-2 h-2 rounded-full bg-blue-400 animate-pulse";
      elements.calendarStatusExplanation.innerHTML = `
        <strong class="text-blue-300">ℹ️ היום ה-11 בחודש:</strong> הטבות מסוימות (כגון <strong>Airalo</strong> ו-<strong>Booking</strong>) עדיין בתוקף היום! הטבות ה-10 בחודש בלבד הסתיימו לחודש זה.
      `;
    } else if (todayDay > 11) {
      elements.calendarTodayDot.className = "w-2 h-2 rounded-full bg-slate-400";
      elements.calendarStatusExplanation.innerHTML = `
        הטבות שנתיות/חודשיות (כמו <strong>Booking</strong>) פעילות. מבצעי ה-10 בחודש יתחדשו במלואם ב-10 לחודש הבא.
      `;
    } else {
      elements.calendarTodayDot.className = "w-2 h-2 rounded-full bg-amber-400 animate-pulse";
      elements.calendarStatusExplanation.innerHTML = `
        מתכוננים ל-10 בחודש הקרוב! מבצעי ה-10 בחודש ייפתחו ב-10:00 בבוקר.
      `;
    }
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
  // Countdown Timer
  // ==========================================
  const HEBREW_MONTH_NAMES = [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"
  ];

  function getNextMastercardDay() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const eventStart = new Date(currentYear, currentMonth, 10, 10, 0, 0);
    const eventEnd = new Date(currentYear, currentMonth, 10, 23, 59, 59);

    if (now >= eventStart && now <= eventEnd) {
      return {
        isLive: true,
        targetDate: eventEnd,
        title: "🔥 יום מאסטרקארד בשיאו! ההטבות מסתיימות בעוד:"
      };
    }
    if (now < eventStart) {
      const monthName = HEBREW_MONTH_NAMES[currentMonth];
      return {
        isLive: false,
        targetDate: eventStart,
        title: `ספירה לאחור לפתיחה (10 ב${monthName} ב-10:00)`
      };
    }
    const nextMonth = (currentMonth + 1) % 12;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextMonthName = HEBREW_MONTH_NAMES[nextMonth];
    return {
      isLive: false,
      targetDate: new Date(nextYear, nextMonth, 10, 10, 0, 0),
      title: `ספירה לאחור ל-10 ב${nextMonthName} ב-10:00`
    };
  }

  function startCountdownTimer() {
    function update() {
      const { isLive, targetDate, title } = getNextMastercardDay();
      if (elements.countdownTitle && elements.countdownTitle.textContent !== title) {
        elements.countdownTitle.textContent = title;
      }

      const now = new Date();
      const diffMs = targetDate - now;

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
  // Data Loading
  // ==========================================
  async function loadCatalogData() {
    try {
      const response = await fetch(`data/deals.json?v=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      state.allDeals = data.deals || [];
      state.categories = data.metadata?.categories || ["הכל"];

      updateStatsRibbon(data.metadata);
      renderValidityPills();
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

    // Count active today
    const now = new Date();
    const activeTodayCount = state.allDeals.filter(d => getDealValidityStatus(d, now).status === "active_today").length;
    elements.statActiveToday.textContent = `${activeTodayCount}`;

    if (metadata.last_updated) {
      const date = new Date(metadata.last_updated);
      elements.statLastUpdated.textContent = date.toLocaleDateString("he-IL", {
        day: "2-digit",
        month: "2-digit"
      });
    }
  }

  // ==========================================
  // Validity Filter Pills
  // ==========================================
  function renderValidityPills() {
    elements.validityPillsContainer.innerHTML = "";
    const now = new Date();

    const validityFilterDefs = [
      { id: "all", label: "כל ההטבות" },
      { id: "active_today", label: "בתוקף היום 🔥" },
      { id: "only_10th", label: "10 בחודש בלבד" },
      { id: "10_11th", label: "גם ב-11 בחודש" },
      { id: "all_month", label: "כל החודש" },
      { id: "expired", label: "פג תוקף לחודש זה" }
    ];

    validityFilterDefs.forEach(vf => {
      let count = 0;
      if (vf.id === "all") {
        count = state.allDeals.length;
      } else if (vf.id === "active_today") {
        count = state.allDeals.filter(d => getDealValidityStatus(d, now).status === "active_today").length;
      } else if (vf.id === "expired") {
        count = state.allDeals.filter(d => getDealValidityStatus(d, now).status === "expired").length;
      } else if (vf.id === "10_11th") {
        count = state.allDeals.filter(d => d.validity_code === "10_11th" || d.validity_code === "10_11th_and_all_month").length;
      } else if (vf.id === "all_month") {
        count = state.allDeals.filter(d => d.validity_code === "all_month" || d.validity_code === "10_11th_and_all_month").length;
      } else {
        count = state.allDeals.filter(d => d.validity_code === vf.id).length;
      }

      const isActive = state.activeValidityFilter === vf.id;

      const button = document.createElement("button");
      button.className = `shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
        isActive
          ? "bg-slate-900 dark:bg-red-600 text-white shadow-xs"
          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
      }`;

      button.innerHTML = `
        <span>${escapeHtml(vf.label)}</span>
        <span class="px-1.5 py-0.2 text-[10px] rounded-full ${
          isActive
            ? "bg-slate-800 dark:bg-red-700 text-white"
            : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
        }">${count}</span>
      `;

      button.addEventListener("click", () => {
        state.activeValidityFilter = vf.id;
        renderValidityPills();
        applyFilters();
      });

      elements.validityPillsContainer.appendChild(button);
    });
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
      button.className = `shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
        isActive
          ? "bg-red-600 text-white shadow-xs"
          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
      }`;

      button.innerHTML = `
        <span>${escapeHtml(cat)}</span>
        <span class="px-1.5 py-0.2 text-[10px] rounded-full ${
          isActive
            ? "bg-red-700/90 text-white"
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
    const now = new Date();

    state.filteredDeals = state.allDeals.filter(deal => {
      // 1. Validity filter
      const vStatus = getDealValidityStatus(deal, now);
      if (state.activeValidityFilter === "active_today" && vStatus.status !== "active_today") {
        return false;
      }
      if (state.activeValidityFilter === "expired" && vStatus.status !== "expired") {
        return false;
      }
      if (state.activeValidityFilter === "only_10th" && deal.validity_code !== "only_10th") {
        return false;
      }
      if (state.activeValidityFilter === "10_11th" && deal.validity_code !== "10_11th" && deal.validity_code !== "10_11th_and_all_month") {
        return false;
      }
      if (state.activeValidityFilter === "all_month" && deal.validity_code !== "all_month" && deal.validity_code !== "10_11th_and_all_month") {
        return false;
      }

      // 2. Category filter
      if (state.activeCategory !== "הכל" && deal.category !== state.activeCategory) {
        return false;
      }

      // 3. Search query check
      if (q) {
        const bulletsText = (deal.terms_bullets || []).join(" ");
        const haystack = `${deal.brand} ${deal.title} ${deal.coupon} ${deal.discount} ${deal.category} ${deal.min_spend || ""} ${deal.description} ${bulletsText}`.toLowerCase();
        if (!haystack.includes(q)) {
          return false;
        }
      }

      return true;
    });

    // 4. Sorting
    if (state.sortBy === "discount-desc") {
      state.filteredDeals.sort((a, b) => b.discount_numeric - a.discount_numeric);
    } else if (state.sortBy === "brand-asc") {
      state.filteredDeals.sort((a, b) => a.brand.localeCompare(b.brand, "he"));
    } else if (state.sortBy === "min-spend-asc") {
      state.filteredDeals.sort((a, b) => (a.min_spend_numeric || 0) - (b.min_spend_numeric || 0));
    }

    elements.filteredCount.textContent = state.filteredDeals.length;
    elements.searchClearBtn.classList.toggle("hidden", !state.searchQuery);

    renderDeals();
  }

  // ==========================================
  // Rendering Views (Grid & Table)
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
    const now = new Date();

    elements.dealsGrid.innerHTML = state.filteredDeals.map(deal => {
      const vInfo = getDealValidityStatus(deal, now);
      const isExpired = vInfo.isExpired;
      const couponCode = deal.coupon || "MASTERCARDAY";
      const directUrl = deal.url || "https://www.mastercard.com/il/he/%D7%90%D7%99%D7%A9%D7%99/find-a-card/card-benefits/mastercard-day.html";
      const hasImage = deal.image && !deal.image.includes("sep.png") && !deal.image.includes(".svg");

      return `
        <article id="${deal.id}" class="deal-card ${isExpired ? 'deal-expired' : ''} relative flex flex-col bg-white dark:bg-mc-cardDark rounded-2xl border ${isExpired ? 'border-slate-300 dark:border-slate-800' : 'border-slate-200 dark:border-mc-borderDark'} shadow-sm overflow-hidden hover:shadow-md hover:border-red-300 dark:hover:border-red-900/60">
          
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

            <!-- Live Validity Status Badge (Top Right) -->
            <div class="absolute top-3 right-3 px-2.5 py-1 rounded-xl text-xs font-bold shadow-md border flex items-center gap-1.5 backdrop-blur-md ${vInfo.badgeClass}">
              <span class="w-2 h-2 rounded-full ${vInfo.dotClass} ${vInfo.status === 'active_today' ? 'animate-pulse' : ''}"></span>
              <span>${escapeHtml(vInfo.label)}</span>
            </div>

            <!-- Category & Validity Badges (Bottom Right) -->
            <div class="absolute bottom-3 right-3 flex items-center gap-1.5 flex-wrap">
              <span class="px-2.5 py-0.5 rounded-lg bg-slate-900/85 backdrop-blur-md text-white text-[11px] font-medium">
                ${escapeHtml(deal.category)}
              </span>
              <span class="px-2.5 py-0.5 rounded-lg bg-slate-900/85 backdrop-blur-md text-amber-300 text-[11px] font-medium">
                ${escapeHtml(deal.validity)}
              </span>
            </div>
          </div>

          <!-- Card Content Body -->
          <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div class="space-y-3">
              
              <!-- Brand, Share & Pricing -->
              <div class="flex items-start justify-between gap-2">
                <div>
                  <h3 class="font-bold text-lg text-slate-900 dark:text-white leading-tight">
                    ${escapeHtml(deal.brand)}
                  </h3>
                  <!-- Discount Badge & Min Purchase Sub-Badge -->
                  <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-red-600 text-white text-xs font-bold shadow-xs">
                      <i data-lucide="percent" class="w-3 h-3"></i>
                      <span>${escapeHtml(deal.discount)}</span>
                    </span>
                    ${
                      deal.ongoing_discount
                        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold">
                             <span>📅 ${escapeHtml(deal.ongoing_discount)} שאר החודש</span>
                           </span>`
                        : ''
                    }
                    ${
                      deal.min_spend
                        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[11px] font-semibold">
                             <span>מעל ${escapeHtml(deal.min_spend)}</span>
                           </span>`
                        : ''
                    }
                  </div>
                </div>

                <button onclick="window.copyDealLink('${deal.id}')" title="שתף קישור ישיר להטבה" class="p-2 rounded-xl text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0">
                  <i data-lucide="share-2" class="w-4 h-4"></i>
                </button>
              </div>

              <!-- Deal Summary Title -->
              <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                ${escapeHtml(deal.title)}
              </p>

              <!-- Structured Conditions Bullets -->
              <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div class="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <i data-lucide="check-square" class="w-3.5 h-3.5 text-red-500"></i>
                  <span>עיקרי התנאים:</span>
                </div>
                <ul class="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                  ${(deal.terms_bullets || []).map(b => `<li class="flex items-start gap-1 leading-snug"><span>${escapeHtml(b)}</span></li>`).join("")}
                </ul>
              </div>
            </div>

            <!-- Coupon Box & 1-Click Copy -->
            <div class="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
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

            <!-- Action Buttons & Expandable Legal Terms -->
            <div class="space-y-2 pt-1">
              <a href="${escapeHtml(directUrl)}" target="_blank" rel="noopener noreferrer" class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold transition shadow-xs">
                <span>מעבר לאתר ההטבה</span>
                <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
              </a>

              <details class="group text-xs text-slate-500 dark:text-slate-400">
                <summary class="cursor-pointer list-none flex items-center justify-between py-1 text-[11px] font-medium hover:text-slate-700 dark:hover:text-slate-200">
                  <span>תקנון מלא ואותיות קטנות</span>
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
    const now = new Date();

    elements.dealsTableBody.innerHTML = state.filteredDeals.map(deal => {
      const vInfo = getDealValidityStatus(deal, now);
      const couponCode = deal.coupon || "MASTERCARDAY";
      const directUrl = deal.url || "#";

      return `
        <tr id="${deal.id}" class="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors ${vInfo.isExpired ? 'opacity-70' : ''}">
          <td class="px-4 py-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
            ${escapeHtml(deal.brand)}
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${vInfo.badgeClass}">
              <span class="w-1.5 h-1.5 rounded-full ${vInfo.dotClass}"></span>
              <span>${escapeHtml(vInfo.label)}</span>
            </span>
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap">
            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300">
              ${escapeHtml(deal.discount)}
            </span>
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
            ${deal.min_spend ? `<span class="font-semibold text-amber-600 dark:text-amber-400">מעל ${escapeHtml(deal.min_spend)}</span>` : '<span class="text-slate-400">ללא מינימום</span>'}
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap">
            <div class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs">
              <span class="font-bold text-slate-800 dark:text-amber-400">${escapeHtml(couponCode)}</span>
              <button onclick="window.copyCoupon('${escapeHtml(couponCode)}')" title="העתק קוד" class="text-slate-400 hover:text-red-600">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
          <td class="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
            ${escapeHtml((deal.terms_bullets || []).slice(0, 2).join(" • "))}
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
  // Clipboard & Link Actions
  // ==========================================
  window.copyCoupon = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast(`קוד הקופון <strong>${code}</strong> הועתק בהצלחה!`, "success");
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
      toast.style.transform = "translateY(14px)";
      toast.style.transition = "all 0.25s ease";
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  // ==========================================
  // Event Listeners & Helpers
  // ==========================================
  function setupEventListeners() {
    elements.themeToggleBtn.addEventListener("click", toggleTheme);
    elements.viewGridBtn.addEventListener("click", () => setViewMode("grid"));
    elements.viewTableBtn.addEventListener("click", () => setViewMode("table"));

    let debounceTimer;
    elements.searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.searchQuery = e.target.value;
        applyFilters();
      }, 150);
    });

    elements.searchClearBtn.addEventListener("click", () => {
      elements.searchInput.value = "";
      state.searchQuery = "";
      applyFilters();
      elements.searchInput.focus();
    });

    elements.sortSelect.addEventListener("change", (e) => {
      state.sortBy = e.target.value;
      applyFilters();
    });

    elements.resetFiltersBtn.addEventListener("click", () => {
      elements.searchInput.value = "";
      state.searchQuery = "";
      state.activeCategory = "הכל";
      state.activeValidityFilter = "all";
      state.sortBy = "discount-desc";
      elements.sortSelect.value = "discount-desc";
      renderValidityPills();
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
