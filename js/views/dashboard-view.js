/* ==========================================================================
   Splitwise Dashboard View
   ========================================================================== */

const DashboardView = {
  render(container, state) {
    const balances = state.getUserBalances();
    const currentUser = state.getCurrentUser();

    let totalClass = "neutral-amount";
    let totalPrefix = "";
    if (balances.totalBalance > 0.005) {
      totalClass = "positive-amount";
      totalPrefix = "+";
    } else if (balances.totalBalance < -0.005) {
      totalClass = "negative-amount";
    }

    container.innerHTML = `
      <!-- Dashboard Top Header Bar -->
      <div class="content-header">
        <div class="header-title-area">
          <h1 class="header-title">Dashboard</h1>
        </div>
        <div class="header-actions">
          <button class="btn btn-orange" id="btn-header-add-expense">
            Add an expense
          </button>
          <button class="btn btn-teal" id="btn-header-settle-up">
            Settle up
          </button>
        </div>
      </div>

      <!-- Balances Summary Bar (3 columns) -->
      <div class="dashboard-balances-bar">
        <div class="balance-box">
          <div class="balance-label">total balance</div>
          <div class="balance-value ${totalClass}">
            ${totalPrefix}${UI.formatCurrency(balances.totalBalance)}
          </div>
        </div>
        <div class="balance-box">
          <div class="balance-label">you owe</div>
          <div class="balance-value ${balances.youOwe > 0.005 ? 'negative-amount' : 'neutral-amount'}">
            ${UI.formatCurrency(balances.youOwe)}
          </div>
        </div>
        <div class="balance-box">
          <div class="balance-label">you are owed</div>
          <div class="balance-value ${balances.youAreOwed > 0.005 ? 'positive-amount' : 'neutral-amount'}">
            ${UI.formatCurrency(balances.youAreOwed)}
          </div>
        </div>
      </div>

      <!-- Dashboard 2-Column Content -->
      <div class="content-body">
        <div class="dashboard-columns">
          <!-- Column 1: YOU OWE -->
          <div class="dashboard-column">
            <div class="dashboard-column-title">
              <span>YOU OWE</span>
              <span class="badge badge-orange">${balances.friendsYouOwe.length}</span>
            </div>

            ${balances.friendsYouOwe.length === 0 ? `
              <div class="settled-empty-state">
                <div class="settled-empty-icon">🎉</div>
                <div class="settled-empty-title">You do not owe anything</div>
                <div class="settled-empty-text">You're all settled up on this side!</div>
              </div>
            ` : `
              <div class="debt-person-list">
                ${balances.friendsYouOwe.map(item => `
                  <div class="debt-person-item" data-user-id="${item.user.id}">
                    <div class="debt-person-left view-friend-trigger" data-user-id="${item.user.id}">
                      <div class="debt-person-avatar">
                        ${UI.renderAvatar(item.user)}
                      </div>
                      <div class="debt-person-details">
                        <span class="debt-person-name">${item.user.name}</span>
                        <span class="debt-person-sub">you owe</span>
                      </div>
                    </div>
                    <div class="debt-person-right">
                      <span class="debt-amount-text negative-amount">${UI.formatCurrency(item.amount)}</span>
                      <button class="btn btn-teal btn-mini-settle quick-settle-btn" data-friend-id="${item.user.id}" data-amount="${item.amount}">
                        Settle
                      </button>
                    </div>
                  </div>
                `).join("")}
              </div>
            `}
          </div>

          <!-- Column 2: YOU ARE OWED -->
          <div class="dashboard-column">
            <div class="dashboard-column-title">
              <span>YOU ARE OWED</span>
              <span class="badge badge-teal">${balances.friendsWhoOweYou.length}</span>
            </div>

            ${balances.friendsWhoOweYou.length === 0 ? `
              <div class="settled-empty-state">
                <div class="settled-empty-icon">☕</div>
                <div class="settled-empty-title">You are not owed anything</div>
                <div class="settled-empty-text">Add an expense to start tracking shares.</div>
              </div>
            ` : `
              <div class="debt-person-list">
                ${balances.friendsWhoOweYou.map(item => `
                  <div class="debt-person-item" data-user-id="${item.user.id}">
                    <div class="debt-person-left view-friend-trigger" data-user-id="${item.user.id}">
                      <div class="debt-person-avatar">
                        ${UI.renderAvatar(item.user)}
                      </div>
                      <div class="debt-person-details">
                        <span class="debt-person-name">${item.user.name}</span>
                        <span class="debt-person-sub">owes you</span>
                      </div>
                    </div>
                    <div class="debt-person-right">
                      <span class="debt-amount-text positive-amount">${UI.formatCurrency(item.amount)}</span>
                      <button class="btn btn-secondary btn-mini-settle remind-friend-btn" data-friend-name="${item.user.shortName}">
                        Remind
                      </button>
                    </div>
                  </div>
                `).join("")}
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    // Render Right Sidebar for Dashboard
    this.renderRightSidebar(state);
  },

  renderRightSidebar(state) {
    const sidebar = document.getElementById("app-sidebar-right");
    if (!sidebar) return;

    const balances = state.getUserBalances();
    const friends = state.getFriends();

    sidebar.innerHTML = `
      <div class="sidebar-balance-card">
        <div class="sidebar-balance-heading">YOUR TOTAL BALANCE</div>
        <div class="sidebar-total-sum ${balances.totalBalance >= 0 ? 'positive-amount' : 'negative-amount'}">
          ${balances.totalBalance >= 0 ? '+' : ''}${UI.formatCurrency(balances.totalBalance)}
        </div>
        <div class="sidebar-balance-subtext">
          ${balances.totalBalance > 0 ? 'Overall, people owe you.' : balances.totalBalance < 0 ? 'Overall, you owe money.' : 'You are all squared away!'}
        </div>
      </div>

      <div>
        <div class="right-section-title">
          <span>PRO TOOLS (UNLOCKED)</span>
        </div>
        <div class="sidebar-action-links">
          <a href="#" class="sidebar-action-link" id="link-charts-view">
            ${UI.icons.chart}
            <span>Spending Analytics & Donut Charts</span>
          </a>
          <a href="#" class="sidebar-action-link" id="link-rent-calc">
            ${UI.icons.calculator}
            <span>Rent Split Fairness Calculator</span>
          </a>
          <a href="#" class="sidebar-action-link" id="link-currency-calc">
            <span>💱</span>
            <span>Multi-Currency Converter</span>
          </a>
          <a href="#" class="sidebar-action-link" id="link-all-expenses-pro">
            ${UI.icons.allExpenses}
            <span>Deep Search & Data Export</span>
          </a>
        </div>
      </div>
    `;
  }
};
