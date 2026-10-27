/* ==========================================================================
   Splitwise Friend 1-on-1 View
   ========================================================================== */

const FriendView = {
  render(container, state, friendId) {
    const friend = state.getUser(friendId);
    if (!friend) {
      container.innerHTML = `<div class="content-body">Friend not found.</div>`;
      return;
    }

    const netBalance = state.getFriendBalance(friendId);
    let balanceSub = "You are all settled up.";
    let balanceColor = "neutral-amount";

    if (netBalance > 0.005) {
      balanceSub = `${friend.shortName} owes you ${UI.formatCurrency(netBalance)}`;
      balanceColor = "positive-amount";
    } else if (netBalance < -0.005) {
      balanceSub = `You owe ${friend.shortName} ${UI.formatCurrency(Math.abs(netBalance))}`;
      balanceColor = "negative-amount";
    }

    container.innerHTML = `
      <div class="content-header">
        <div class="header-title-area">
          <div class="header-avatar">
            ${UI.renderAvatar(friend)}
          </div>
          <div>
            <h1 class="header-title">${friend.name}</h1>
            <div class="header-subtitle ${balanceColor}">${balanceSub}</div>
          </div>
        </div>

        <div class="header-actions">
          <button class="btn btn-orange" id="btn-header-add-expense" data-default-friend="${friend.id}">
            Add an expense
          </button>
          <button class="btn btn-teal" id="btn-header-settle-up" data-friend-id="${friend.id}" data-amount="${Math.abs(netBalance)}">
            Settle up
          </button>
        </div>
      </div>

      <div id="friend-expenses-container"></div>
    `;

    // Render filtered expenses
    const expContainer = container.querySelector("#friend-expenses-container");
    ExpensesView.render(expContainer, state, null, friendId);

    // Right Sidebar
    this.renderRightSidebar(state, friend, netBalance);
  },

  renderRightSidebar(state, friend, netBalance) {
    const sidebar = document.getElementById("app-sidebar-right");
    if (!sidebar) return;

    sidebar.innerHTML = `
      <div class="sidebar-balance-card">
        <div class="sidebar-balance-heading">YOUR BALANCE WITH ${friend.shortName.toUpperCase()}</div>
        <div class="sidebar-total-sum ${netBalance > 0 ? 'positive-amount' : netBalance < 0 ? 'negative-amount' : 'neutral-amount'}">
          ${netBalance > 0 ? '+' : ''}${UI.formatCurrency(netBalance)}
        </div>
        <div class="sidebar-balance-subtext">
          ${netBalance > 0 ? `${friend.shortName} owes you this amount.` : netBalance < 0 ? `You owe ${friend.shortName} this amount.` : `No money owed.`}
        </div>
      </div>

      <div class="sidebar-action-links">
        ${netBalance > 0 ? `
          <button class="btn btn-secondary remind-friend-btn" data-friend-name="${friend.shortName}" style="width:100%;">
            Send Reminder Email
          </button>
        ` : netBalance < 0 ? `
          <button class="btn btn-teal quick-settle-btn" data-friend-id="${friend.id}" data-amount="${Math.abs(netBalance)}" style="width:100%;">
            Settle Up with ${friend.shortName}
          </button>
        ` : ''}
      </div>
    `;

    const remindBtn = sidebar.querySelector(".remind-friend-btn");
    if (remindBtn) {
      remindBtn.addEventListener("click", () => {
        UI.showToast(`Reminder sent to ${friend.name}!`);
      });
    }

    const settleBtn = sidebar.querySelector(".quick-settle-btn");
    if (settleBtn) {
      settleBtn.addEventListener("click", () => {
        if (window.SettleUpModal) {
          window.SettleUpModal.open({
            friendId: friend.id,
            amount: Math.abs(netBalance)
          });
        }
      });
    }
  }
};
