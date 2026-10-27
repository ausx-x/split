/* ==========================================================================
   Splitwise UI Helpers & Icon Utilities
   ========================================================================== */

const UI = {
  // SVG Icons
  icons: {
    splitwiseLogo: `
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2L3 9.5V22.5L16 30L29 22.5V9.5L16 2Z" fill="#5bc5a7"/>
        <path d="M16 2L3 9.5L16 17L29 9.5L16 2Z" fill="#48be9d"/>
        <path d="M16 17V30L29 22.5V9.5L16 17Z" fill="#38a688"/>
        <path d="M16 17L3 9.5V22.5L16 30V17Z" fill="#69cfb3"/>
      </svg>
    `,
    search: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    `,
    bell: `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
    `,
    chevronDown: `
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `,
    dashboardFlag: `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
        <line x1="4" y1="22" x2="4" y2="15"></line>
      </svg>
    `,
    activityFeed: `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
      </svg>
    `,
    allExpenses: `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>
    `,
    chart: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
    `,
    calculator: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2"></rect>
        <line x1="8" y1="6" x2="16" y2="6"></line>
        <line x1="16" y1="14" x2="16" y2="18"></line>
        <path d="M16 10h.01"></path>
        <path d="M12 10h.01"></path>
        <path d="M8 10h.01"></path>
        <path d="M12 14h.01"></path>
        <path d="M8 14h.01"></path>
        <path d="M12 18h.01"></path>
        <path d="M8 18h.01"></path>
      </svg>
    `,
    trash: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `,
    edit: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `,
    download: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `,
    menu: `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    `
  },

  // Format Currency
  formatCurrency(num, symbol = "$") {
    const val = Number(num) || 0;
    return `${symbol}${val.toFixed(2)}`;
  },

  // Format Date for badge
  formatExpenseDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return {
      month: months[d.getMonth()] || "OCT",
      day: d.getDate() || 1
    };
  },

  // Format Month header
  formatMonthHeader(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${months[d.getMonth()]} ${d.getFullYear()}`.toUpperCase();
  },

  // Format relative or pretty timestamp
  formatTimeAgo(isoStr) {
    if (!isoStr) return "Recently";
    const date = new Date(isoStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
    if (diffSec < 172800) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  },

  // Render User Avatar
  renderAvatar(user, sizeClass = "") {
    if (!user) return `<div class="user-avatar ${sizeClass}">?</div>`;
    if (user.avatar) {
      return `
        <div class="user-avatar ${sizeClass}" style="background-color: ${user.color || '#5bc5a7'}">
          <img src="${user.avatar}" alt="${user.name}" class="object-cover" />
        </div>
      `;
    }
    return `
      <div class="user-avatar ${sizeClass}" style="background-color: ${user.color || '#5bc5a7'}; color: #fff;">
        ${user.initials || user.name.slice(0, 1).toUpperCase()}
      </div>
    `;
  },

  // Toast Notification
  showToast(message, type = "teal") {
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">✓</span>
      <span class="toast-message">${message}</span>
      <span class="toast-close">&times;</span>
    `;

    toast.querySelector(".toast-close").addEventListener("click", () => {
      toast.remove();
    });

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 250);
      }
    }, 3500);
  },

  // Smart Category Detection
  detectCategory(desc) {
    if (!desc) return "general";
    const lower = desc.toLowerCase();
    for (const cat of DEFAULT_SEED_DATA.categories) {
      for (const kw of cat.keywords) {
        if (lower.includes(kw)) {
          return cat.id;
        }
      }
    }
    return "general";
  },

  getCategoryIcon(catId) {
    const cat = DEFAULT_SEED_DATA.categories.find(c => c.id === catId);
    return cat ? cat.icon : "🧾";
  },

  getCategoryName(catId) {
    const cat = DEFAULT_SEED_DATA.categories.find(c => c.id === catId);
    return cat ? cat.name : "General";
  }
};
