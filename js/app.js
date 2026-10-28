/* ==========================================================================
   Splitwise Web Application - Main Application Controller
   Connected to SQLite Persistent Backend with Real Auth & Native Pro Tools
   ========================================================================== */

class SplitwiseAppController {
  constructor() {
    this.currentView = "dashboard";
    this.activeId = null;
  }

  async init() {
    // Initialize Modals
    AddExpenseModal.init();
    SettleUpModal.init();
    GroupModal.init();
    FriendModal.init();

    // Attach Top Navbar Events
    this.attachNavbarEvents();

    // Attach Auth Modal Events
    this.attachAuthEvents();

    // Attach Global App Events
    this.attachGlobalEvents();

    // Subscribe to state changes for automatic reactive re-renders
    store.subscribe(() => {
      this.updateUserDisplay();
      this.render();
    });

    // Check existing authentication or prompt login
    const authenticated = await store.init();
    if (authenticated) {
      this.updateUserDisplay();
      this.render();
    } else {
      this.showLoginModal();
    }
  }

  navigateTo(view, id = null) {
    this.currentView = view;
    this.activeId = id;
    this.render();

    // Close mobile sidebar if open
    const sidebar = document.getElementById("app-sidebar-left");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("active");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  render() {
    this.renderLeftSidebar();
    this.renderMainView();
  }

  updateUserDisplay() {
    const user = store.getCurrentUser();
    if (!user) return;

    const avatarEl = document.getElementById("navbar-user-avatar");
    const nameEl = document.getElementById("navbar-user-name");
    const dropNameEl = document.getElementById("dropdown-user-fullname");
    const dropEmailEl = document.getElementById("dropdown-user-email");

    const initials = user.initials || (user.name ? user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "U");

    if (avatarEl) {
      avatarEl.textContent = initials;
      avatarEl.style.backgroundColor = user.color || "#5bc5a7";
      avatarEl.style.color = "#ffffff";
    }
    if (nameEl) nameEl.textContent = user.name || "User";
    if (dropNameEl) dropNameEl.textContent = user.name || "User";
    if (dropEmailEl) dropEmailEl.textContent = user.email || "";
  }

  renderLeftSidebar() {
    const groups = store.getGroups();
    const friends = store.getFriends();
    const expenses = store.getExpenses();

    // Update active state on static nav links
    document.querySelectorAll(".nav-link-item").forEach(link => {
      const view = link.dataset.view;
      if (view === this.currentView && !this.activeId) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    // Update expenses count badge
    const badgeEl = document.getElementById("nav-badge-expenses-count");
    if (badgeEl) badgeEl.textContent = expenses.length;

    // Render Groups list
    const groupsListContainer = document.getElementById("sidebar-groups-list");
    if (groupsListContainer) {
      groupsListContainer.innerHTML = groups.map(g => {
        const isActive = this.currentView === "group" && this.activeId === g.id;
        return `
          <div class="sidebar-item ${isActive ? 'active' : ''}" data-action="view-group" data-group-id="${g.id}">
            <div class="sidebar-item-icon">${g.icon || '🏠'}</div>
            <span class="sidebar-item-name">${g.name}</span>
          </div>
        `;
      }).join("");
    }

    // Render Friends list with live balance status
    const friendsListContainer = document.getElementById("sidebar-friends-list");
    if (friendsListContainer) {
      friendsListContainer.innerHTML = friends.map(f => {
        const isActive = this.currentView === "friend" && this.activeId === f.id;
        const balance = store.getFriendBalance(f.id);

        let balText = "";
        let balClass = "";
        if (balance > 0.005) {
          balText = `+${UI.formatCurrency(balance)}`;
          balClass = "positive-amount";
        } else if (balance < -0.005) {
          balText = `-${UI.formatCurrency(Math.abs(balance))}`;
          balClass = "negative-amount";
        }

        return `
          <div class="sidebar-item ${isActive ? 'active' : ''}" data-action="view-friend" data-friend-id="${f.id}">
            <div class="sidebar-item-avatar">
              ${UI.renderAvatar(f)}
            </div>
            <span class="sidebar-item-name">${f.name}</span>
            ${balText ? `<span class="sidebar-item-balance ${balClass}">${balText}</span>` : ''}
          </div>
        `;
      }).join("");
    }
  }

  renderMainView() {
    const container = document.getElementById("app-main-content");
    if (!container) return;

    switch (this.currentView) {
      case "dashboard":
        DashboardView.render(container, store);
        break;

      case "activity":
        ActivityView.render(container, store);
        break;

      case "all-expenses":
        ExpensesView.render(container, store);
        DashboardView.renderRightSidebar(store);
        break;

      case "group":
        GroupView.render(container, store, this.activeId);
        break;

      case "friend":
        FriendView.render(container, store, this.activeId);
        break;

      case "charts":
        ChartsView.render(container, store);
        break;

      case "rent-calculator":
        RentCalcView.render(container, store);
        DashboardView.renderRightSidebar(store);
        break;

      default:
        DashboardView.render(container, store);
        break;
    }
  }

  attachNavbarEvents() {
    // Brand click -> go to dashboard
    const brand = document.querySelector(".navbar-brand");
    if (brand) {
      brand.addEventListener("click", (e) => {
        e.preventDefault();
        this.navigateTo("dashboard");
      });
    }

    // Notifications toggle
    const notifBtn = document.getElementById("btn-toggle-notifications");
    const notifDropdown = document.getElementById("notifications-dropdown");
    const userDropdown = document.getElementById("user-menu-dropdown");

    if (notifBtn && notifDropdown) {
      notifBtn.addEventListener("click", e => {
        e.stopPropagation();
        notifDropdown.classList.toggle("active");
        if (userDropdown) userDropdown.classList.remove("active");
        this.renderNotificationsList();
      });
    }

    // User menu toggle
    const userTrigger = document.getElementById("user-menu-trigger");
    if (userTrigger && userDropdown) {
      userTrigger.addEventListener("click", e => {
        e.stopPropagation();
        userDropdown.classList.toggle("active");
        if (notifDropdown) notifDropdown.classList.remove("active");
      });
    }

    // Close dropdowns on outside click
    document.addEventListener("click", e => {
      if (notifDropdown && !notifDropdown.contains(e.target) && !notifBtn?.contains(e.target)) {
        notifDropdown.classList.remove("active");
      }
      if (userDropdown && !userDropdown.contains(e.target) && !userTrigger?.contains(e.target)) {
        userDropdown.classList.remove("active");
      }
      const searchDrop = document.getElementById("search-results-dropdown");
      const searchWrap = document.querySelector(".navbar-search");
      if (searchDrop && searchWrap && !searchWrap.contains(e.target)) {
        searchDrop.classList.remove("active");
      }
    });

    // User menu item clicks
    const menuCreateGroup = document.getElementById("menu-create-group");
    if (menuCreateGroup) {
      menuCreateGroup.addEventListener("click", () => {
        if (userDropdown) userDropdown.classList.remove("active");
        GroupModal.open();
      });
    }

    const menuRentCalc = document.getElementById("menu-rent-calc");
    if (menuRentCalc) {
      menuRentCalc.addEventListener("click", () => {
        if (userDropdown) userDropdown.classList.remove("active");
        this.navigateTo("rent-calculator");
      });
    }

    const menuCharts = document.getElementById("menu-charts");
    if (menuCharts) {
      menuCharts.addEventListener("click", () => {
        if (userDropdown) userDropdown.classList.remove("active");
        this.navigateTo("charts");
      });
    }

    // Real Logout click
    const menuLogout = document.getElementById("menu-logout");
    if (menuLogout) {
      menuLogout.addEventListener("click", async () => {
        if (userDropdown) userDropdown.classList.remove("active");
        await store.logout();
        UI.showToast("Logged out successfully.");
        this.showLoginModal();
      });
    }

    // Mobile nav toggle
    const mobileToggle = document.getElementById("mobile-nav-toggle");
    const sidebar = document.getElementById("app-sidebar-left");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (mobileToggle && sidebar && backdrop) {
      mobileToggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
        backdrop.classList.toggle("active");
      });
      backdrop.addEventListener("click", () => {
        sidebar.classList.remove("open");
        backdrop.classList.remove("active");
      });
    }

    // Global Search Autocomplete
    this.attachSearchEvents();
  }

  attachAuthEvents() {
    const loginTabBtn = document.getElementById("auth-tab-login");
    const signupTabBtn = document.getElementById("auth-tab-signup");
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const switchToSignupLink = document.getElementById("link-switch-to-signup");
    const authPrompt = document.getElementById("auth-switch-prompt");
    const modalTitle = document.getElementById("auth-modal-title");

    const showLogin = () => {
      if (loginTabBtn) loginTabBtn.classList.add("active");
      if (signupTabBtn) signupTabBtn.classList.remove("active");
      if (loginForm) loginForm.classList.remove("hidden");
      if (signupForm) signupForm.classList.add("hidden");
      if (modalTitle) modalTitle.textContent = "Log in to Splitwise";
      if (authPrompt) {
        authPrompt.innerHTML = `Don't have an account? <a id="link-switch-to-signup">Sign up</a>`;
        const newLink = document.getElementById("link-switch-to-signup");
        if (newLink) newLink.addEventListener("click", showSignup);
      }
      this.clearAuthError();
    };

    const showSignup = () => {
      if (signupTabBtn) signupTabBtn.classList.add("active");
      if (loginTabBtn) loginTabBtn.classList.remove("active");
      if (signupForm) signupForm.classList.remove("hidden");
      if (loginForm) loginForm.classList.add("hidden");
      if (modalTitle) modalTitle.textContent = "Create an Account";
      if (authPrompt) {
        authPrompt.innerHTML = `Already have an account? <a id="link-switch-to-login">Log in</a>`;
        const backToLoginLink = document.getElementById("link-switch-to-login");
        if (backToLoginLink) backToLoginLink.addEventListener("click", showLogin);
      }
      this.clearAuthError();
    };

    if (loginTabBtn) loginTabBtn.addEventListener("click", showLogin);
    if (signupTabBtn) signupTabBtn.addEventListener("click", showSignup);
    if (switchToSignupLink) switchToSignupLink.addEventListener("click", showSignup);

    // Login submit
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        this.clearAuthError();
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;
        const btn = document.getElementById("btn-submit-login");

        try {
          btn.disabled = true;
          btn.textContent = "Logging in...";
          const user = await store.login({ email, password });
          UI.showToast(`Welcome back, ${user.name}!`);
          this.hideLoginModal();
          this.updateUserDisplay();
          this.navigateTo("dashboard");
        } catch (err) {
          this.showAuthError(err.message || "Failed to log in.");
        } finally {
          btn.disabled = false;
          btn.textContent = "Log in";
        }
      });
    }

    // Signup submit
    if (signupForm) {
      signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        this.clearAuthError();
        const name = document.getElementById("signup-name").value.trim();
        const email = document.getElementById("signup-email").value.trim();
        const password = document.getElementById("signup-password").value;
        const default_currency = document.getElementById("signup-currency").value || "USD";
        const upi_id = document.getElementById("signup-upi").value.trim() || undefined;
        const btn = document.getElementById("btn-submit-signup");

        try {
          btn.disabled = true;
          btn.textContent = "Creating account...";
          const user = await store.register({ name, email, password, default_currency, upi_id });
          UI.showToast(`Account created! Welcome, ${user.name}!`);
          this.hideLoginModal();
          this.updateUserDisplay();
          this.navigateTo("dashboard");
        } catch (err) {
          this.showAuthError(err.message || "Failed to sign up.");
        } finally {
          btn.disabled = false;
          btn.textContent = "Create Account";
        }
      });
    }
  }

  showAuthError(msg) {
    const errorBanner = document.getElementById("auth-error-msg");
    if (errorBanner) {
      errorBanner.textContent = msg;
      errorBanner.classList.add("visible");
    }
  }

  clearAuthError() {
    const errorBanner = document.getElementById("auth-error-msg");
    if (errorBanner) {
      errorBanner.textContent = "";
      errorBanner.classList.remove("visible");
    }
  }

  showLoginModal() {
    const modal = document.getElementById("login-page-wrapper");
    if (modal) modal.classList.add("active");
  }

  hideLoginModal() {
    const modal = document.getElementById("login-page-wrapper");
    if (modal) modal.classList.remove("active");
  }

  attachSearchEvents() {
    const input = document.getElementById("global-search-input");
    const dropdown = document.getElementById("search-results-dropdown");
    const clearBtn = document.getElementById("search-clear-btn");
    if (!input || !dropdown) return;

    input.addEventListener("input", e => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        dropdown.classList.remove("active");
        return;
      }

      const expenses = store.getExpenses().filter(e =>
        e.description.toLowerCase().includes(q) ||
        (e.notes && e.notes.toLowerCase().includes(q)) ||
        e.category.toLowerCase().includes(q)
      );

      const groups = store.getGroups().filter(g =>
        g.name.toLowerCase().includes(q)
      );

      const friends = store.getFriends().filter(f =>
        f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q)
      );

      if (expenses.length === 0 && groups.length === 0 && friends.length === 0) {
        dropdown.innerHTML = `<div style="padding:12px; font-size:12px; color:#888; text-align:center;">No results found for "${q}"</div>`;
        dropdown.classList.add("active");
        return;
      }

      let html = "";

      if (groups.length > 0) {
        html += `<div class="search-section-title">Groups</div>`;
        html += groups.map(g => `
          <div class="search-result-item" data-action="view-group" data-group-id="${g.id}">
            <div class="search-result-avatar" style="background:var(--color-teal);">${g.icon || '🏠'}</div>
            <div class="search-result-info">
              <div class="search-result-title">${g.name}</div>
              <div class="search-result-meta">${(g.members || []).length} members · ${g.type}</div>
            </div>
          </div>
        `).join("");
      }

      if (friends.length > 0) {
        html += `<div class="search-section-title">Friends</div>`;
        html += friends.map(f => `
          <div class="search-result-item" data-action="view-friend" data-friend-id="${f.id}">
            <div class="search-result-avatar" style="background:${f.color || '#5bc5a7'};">${f.initials || f.name.slice(0, 2).toUpperCase()}</div>
            <div class="search-result-info">
              <div class="search-result-title">${f.name}</div>
              <div class="search-result-meta">${f.email}</div>
            </div>
          </div>
        `).join("");
      }

      if (expenses.length > 0) {
        html += `<div class="search-section-title">Expenses</div>`;
        html += expenses.slice(0, 5).map(e => `
          <div class="search-result-item" data-action="view-expense" data-expense-id="${e.id}">
            <div class="search-result-avatar" style="background:#eee; font-size:14px;">${UI.getCategoryIcon(e.category)}</div>
            <div class="search-result-info">
              <div class="search-result-title">${e.description}</div>
              <div class="search-result-meta">${UI.formatCurrency(e.amount)} · ${e.date}</div>
            </div>
          </div>
        `).join("");
      }

      dropdown.innerHTML = html;
      dropdown.classList.add("active");
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        input.value = "";
        dropdown.classList.remove("active");
      });
    }

    // Click inside search dropdown
    dropdown.addEventListener("click", e => {
      const item = e.target.closest(".search-result-item");
      if (!item) return;

      dropdown.classList.remove("active");
      input.value = "";

      const action = item.dataset.action;
      if (action === "view-group") {
        this.navigateTo("group", item.dataset.groupId);
      } else if (action === "view-friend") {
        this.navigateTo("friend", item.dataset.friendId);
      } else if (action === "view-expense") {
        this.navigateTo("all-expenses");
        setTimeout(() => {
          const row = document.querySelector(`.expense-item-row[data-expense-id="${item.dataset.expenseId}"]`);
          if (row) {
            row.click();
            row.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      }
    });
  }

  renderNotificationsList() {
    const list = document.getElementById("notifications-list");
    if (!list) return;

    const notifs = store.state.notifications || [];
    if (notifs.length === 0) {
      list.innerHTML = `<div style="padding:16px; font-size:12px; color:#888; text-align:center;">No notifications</div>`;
      return;
    }

    list.innerHTML = notifs.map(n => `
      <div class="notification-item ${n.unread ? 'unread' : ''}">
        <div>
          <div>${n.message}</div>
          <div class="notification-time">${n.time || "Recently"}</div>
        </div>
      </div>
    `).join("");
  }

  attachGlobalEvents() {
    // Left Sidebar navigation links
    document.querySelectorAll(".nav-link-item").forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        const view = link.dataset.view;
        this.navigateTo(view);
      });
    });

    // Add group button in sidebar
    const btnAddGroup = document.getElementById("sidebar-add-group-btn");
    if (btnAddGroup) {
      btnAddGroup.addEventListener("click", () => GroupModal.open());
    }

    // Add friend button in sidebar
    const btnAddFriend = document.getElementById("sidebar-add-friend-btn");
    if (btnAddFriend) {
      btnAddFriend.addEventListener("click", () => FriendModal.open());
    }

    // Quick invite email in sidebar
    const inviteBtn = document.getElementById("sidebar-invite-submit");
    const inviteInput = document.getElementById("sidebar-invite-email");
    if (inviteBtn && inviteInput) {
      inviteBtn.addEventListener("click", async () => {
        const val = inviteInput.value.trim();
        if (val && val.includes("@")) {
          try {
            await store.addFriend({ email: val, name: val.split("@")[0] });
            UI.showToast(`Invitation sent and added ${val} to friends!`);
            inviteInput.value = "";
          } catch (err) {
            alert(err.message || "Failed to add friend.");
          }
        } else {
          alert("Please enter a valid email address.");
        }
      });
    }

    // Event delegation on document
    document.addEventListener("click", e => {
      // Add Expense button
      const addExpBtn = e.target.closest("#btn-header-add-expense");
      if (addExpBtn) {
        const defaultGroup = addExpBtn.dataset.defaultGroup || (this.currentView === "group" ? this.activeId : null);
        const defaultFriend = addExpBtn.dataset.defaultFriend || (this.currentView === "friend" ? this.activeId : null);
        AddExpenseModal.open({ defaultGroup, defaultFriend });
        return;
      }

      // Settle Up button
      const settleBtn = e.target.closest("#btn-header-settle-up");
      if (settleBtn) {
        const friendId = settleBtn.dataset.friendId || (this.currentView === "friend" ? this.activeId : null);
        const groupId = settleBtn.dataset.groupId || (this.currentView === "group" ? this.activeId : null);
        const amount = settleBtn.dataset.amount ? Number(settleBtn.dataset.amount) : undefined;
        SettleUpModal.open({ friendId, groupId, amount });
        return;
      }

      // Group click in sidebar
      const groupItem = e.target.closest('[data-action="view-group"]');
      if (groupItem) {
        const groupId = groupItem.dataset.groupId;
        this.navigateTo("group", groupId);
        return;
      }

      // Friend click in sidebar or dashboard
      const friendItem = e.target.closest('[data-action="view-friend"], .view-friend-trigger');
      if (friendItem) {
        const friendId = friendItem.dataset.userId || friendItem.dataset.friendId;
        this.navigateTo("friend", friendId);
        return;
      }

      // Quick settle button on dashboard / sidebar
      const quickSettle = e.target.closest(".quick-settle-btn");
      if (quickSettle) {
        const friendId = quickSettle.dataset.friendId;
        const amount = Number(quickSettle.dataset.amount);
        SettleUpModal.open({ friendId, amount });
        return;
      }

      // Remind friend button
      const remindBtn = e.target.closest(".remind-friend-btn");
      if (remindBtn) {
        const name = remindBtn.dataset.friendName || "your friend";
        UI.showToast(`Reminder email sent to ${name}!`);
        return;
      }

      // Rent calculator link in right sidebar
      const rentLink = e.target.closest("#link-rent-calc");
      if (rentLink) {
        e.preventDefault();
        this.navigateTo("rent-calculator");
        return;
      }

      // Charts link in right sidebar
      const chartLink = e.target.closest("#link-charts-view");
      if (chartLink) {
        e.preventDefault();
        this.navigateTo("charts");
        return;
      }

      // Currency converter quick-launcher
      const currCalc = e.target.closest("#link-currency-calc");
      if (currCalc) {
        e.preventDefault();
        AddExpenseModal.open();
        return;
      }

      // All expenses deep search launcher
      const allExpPro = e.target.closest("#link-all-expenses-pro");
      if (allExpPro) {
        e.preventDefault();
        this.navigateTo("all-expenses");
        return;
      }

      // Invite group members link in group view
      const inviteGrpMembers = e.target.closest("#btn-invite-group-members");
      if (inviteGrpMembers) {
        FriendModal.open();
        return;
      }
    });
  }
}

// Instantiate globally
window.SplitwiseApp = new SplitwiseAppController();

// Auto initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  window.SplitwiseApp.init();
});
