/* ==========================================================================
   Splitwise All Expenses View & Accordion Drawer
   ========================================================================== */

const ExpensesView = {
  activeExpandedId: null,

  render(container, state, filterGroupId = null, filterFriendId = null) {
    let expenses = state.getExpenses();
    const currentUserId = state.getCurrentUser().id;

    if (filterGroupId) {
      expenses = expenses.filter(e => e.groupId === filterGroupId);
    } else if (filterFriendId) {
      expenses = expenses.filter(e => {
        if (e.friendId === filterFriendId) return true;
        const involvesCurrent = e.payerId === currentUserId || e.splits.some(s => s.userId === currentUserId);
        const involvesFriend = e.payerId === filterFriendId || e.splits.some(s => s.userId === filterFriendId);
        return involvesCurrent && involvesFriend;
      });
    }

    // Group expenses by Month (e.g. "OCTOBER 2026")
    const grouped = {};
    expenses.forEach(exp => {
      const monthKey = UI.formatMonthHeader(exp.date);
      if (!grouped[monthKey]) grouped[monthKey] = [];
      grouped[monthKey].push(exp);
    });

    const monthKeys = Object.keys(grouped);

    container.innerHTML = `
      <div class="content-header">
        <div class="header-title-area">
          <h1 class="header-title">All Expenses</h1>
          <span class="header-subtitle">${expenses.length} transaction${expenses.length === 1 ? '' : 's'}</span>
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

      <div class="content-body">
        ${expenses.length === 0 ? `
          <div class="settled-empty-state">
            <div class="settled-empty-icon">🧾</div>
            <div class="settled-empty-title">No expenses yet</div>
            <div class="settled-empty-text">Click "Add an expense" above to start splitting costs!</div>
          </div>
        ` : `
          ${monthKeys.map(month => `
            <div class="expenses-month-group">
              <div class="month-divider">
                <span>${month}</span>
                <span>${grouped[month].length} items</span>
              </div>
              <div class="expense-items-list">
                ${grouped[month].map(exp => this.renderExpenseRow(exp, state, currentUserId)).join("")}
              </div>
            </div>
          `).join("")}
        `}
      </div>
    `;

    this.attachEventListeners(container, state);
  },

  renderExpenseRow(exp, state, currentUserId) {
    const dateInfo = UI.formatExpenseDate(exp.date);
    const categoryIcon = UI.getCategoryIcon(exp.category);
    const payer = state.getUser(exp.payerId);
    const isPayer = exp.payerId === currentUserId;

    // Calculate your share
    const mySplit = exp.splits.find(s => s.userId === currentUserId);
    const mySplitAmt = mySplit ? Number(mySplit.amount) : 0;
    const totalAmount = Number(exp.amount);

    let payerText = "";
    let shareText = "";
    let shareClass = "neutral-amount";

    if (exp.isSettlement) {
      const recipient = state.getUser(exp.splits[0]?.userId);
      payerText = `${payer.shortName} paid ${recipient.shortName}`;
      shareText = UI.formatCurrency(totalAmount);
      shareClass = "positive-amount";
    } else if (isPayer) {
      payerText = `you paid ${UI.formatCurrency(totalAmount)}`;
      const lentAmount = totalAmount - mySplitAmt;
      if (lentAmount > 0) {
        shareText = `you lent ${UI.formatCurrency(lentAmount)}`;
        shareClass = "positive-amount";
      } else {
        shareText = `you paid for yourself`;
        shareClass = "neutral-amount";
      }
    } else {
      payerText = `${payer.shortName} paid ${UI.formatCurrency(totalAmount)}`;
      if (mySplitAmt > 0) {
        shareText = `you borrowed ${UI.formatCurrency(mySplitAmt)}`;
        shareClass = "negative-amount";
      } else {
        shareText = `not involved`;
        shareClass = "neutral-amount";
      }
    }

    let groupTag = "";
    if (exp.groupId) {
      const grp = state.getGroup(exp.groupId);
      if (grp) groupTag = ` · ${grp.name}`;
    }

    const isExpanded = this.activeExpandedId === exp.id;

    return `
      <div class="expense-row-wrapper" data-expense-id="${exp.id}">
        <div class="expense-item-row" data-action="toggle-detail" data-expense-id="${exp.id}">
          <div class="expense-date-badge">
            <span class="expense-date-month">${dateInfo.month}</span>
            <span class="expense-date-day">${dateInfo.day}</span>
          </div>
          <div class="expense-category-icon">
            ${categoryIcon}
          </div>
          <div class="expense-info">
            <div class="expense-title">${exp.description}</div>
            <div class="expense-group-tag">${UI.getCategoryName(exp.category)}${groupTag}</div>
          </div>
          <div class="expense-shares-summary">
            <div class="expense-payer-line">${payerText}</div>
            <div class="expense-share-line ${shareClass}">${shareText}</div>
          </div>
          <button class="expense-delete-quick" data-action="quick-delete" data-expense-id="${exp.id}" title="Delete expense">
            ${UI.icons.trash}
          </button>
        </div>

        <!-- Accordion Drawer -->
        <div class="expense-expanded-drawer ${isExpanded ? 'active' : ''}" id="drawer-${exp.id}">
          <div class="expense-detail-header">
            <div class="expense-meta-info">
              Added by <strong>${payer.name}</strong> on ${new Date(exp.createdAt || exp.date).toLocaleDateString()}
              ${exp.notes ? `<div style="margin-top:4px; font-style:italic;">"${exp.notes}"</div>` : ''}
            </div>
            <div class="expense-detail-actions">
              <button class="btn btn-secondary btn-mini-settle" data-action="edit-expense" data-expense-id="${exp.id}">
                ${UI.icons.edit} Edit
              </button>
              <button class="btn btn-secondary btn-mini-settle" style="color:var(--color-red);" data-action="delete-expense" data-expense-id="${exp.id}">
                ${UI.icons.trash} Delete
              </button>
            </div>
          </div>

          <!-- Split Breakdown Ledger -->
          <div class="expense-split-breakdown">
            <div class="breakdown-row" style="font-weight:700; color:var(--color-text-main);">
              <span>${payer.name} paid</span>
              <span>${UI.formatCurrency(exp.amount)}</span>
            </div>
            ${exp.splits.map(s => {
              const u = state.getUser(s.userId);
              return `
                <div class="breakdown-row">
                  <span>${u.name} owes</span>
                  <span>${UI.formatCurrency(s.amount)}</span>
                </div>
              `;
            }).join("")}
          </div>

          <!-- Comments Section -->
          <div class="expense-comments-section">
            <div class="comments-title">Comments & Activity</div>
            <div class="comments-list">
              ${(exp.comments && exp.comments.length > 0) ? exp.comments.map(c => {
                const author = state.getUser(c.userId);
                return `
                  <div class="comment-bubble">
                    <span class="comment-author">${author.shortName}</span>
                    <span class="comment-date">${UI.formatTimeAgo(c.createdAt)}</span>
                    <div class="comment-text">${c.text}</div>
                  </div>
                `;
              }).join("") : `
                <div style="font-size:12px; color:var(--color-text-muted); font-style:italic;">No comments yet.</div>
              `}
            </div>
            <div class="comment-input-row">
              <input type="text" class="comment-input" placeholder="Write a comment..." data-expense-id="${exp.id}" />
              <button class="btn btn-teal btn-mini-settle" data-action="post-comment" data-expense-id="${exp.id}">Post</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  attachEventListeners(container, state) {
    // Row click to toggle drawer
    container.addEventListener("click", e => {
      const toggleTrigger = e.target.closest('[data-action="toggle-detail"]');
      const deleteQuick = e.target.closest('[data-action="quick-delete"]');
      const deleteBtn = e.target.closest('[data-action="delete-expense"]');
      const editBtn = e.target.closest('[data-action="edit-expense"]');
      const postCommentBtn = e.target.closest('[data-action="post-comment"]');

      if (deleteQuick || deleteBtn) {
        e.stopPropagation();
        const id = (deleteQuick || deleteBtn).dataset.expenseId;
        if (confirm("Are you sure you want to delete this expense? This cannot be undone.")) {
          state.deleteExpense(id);
          UI.showToast("Expense deleted");
        }
        return;
      }

      if (editBtn) {
        e.stopPropagation();
        const id = editBtn.dataset.expenseId;
        const exp = state.getExpense(id);
        if (exp && window.AddExpenseModal) {
          window.AddExpenseModal.openForEdit(exp);
        }
        return;
      }

      if (postCommentBtn) {
        e.stopPropagation();
        const id = postCommentBtn.dataset.expenseId;
        const input = container.querySelector(`input.comment-input[data-expense-id="${id}"]`);
        if (input && input.value.trim()) {
          state.addComment(id, input.value.trim());
          input.value = "";
          UI.showToast("Comment posted!");
        }
        return;
      }

      if (toggleTrigger) {
        const id = toggleTrigger.dataset.expenseId;
        const drawer = document.getElementById(`drawer-${id}`);
        if (drawer) {
          const isActive = drawer.classList.contains("active");
          // Close others
          container.querySelectorAll(".expense-expanded-drawer.active").forEach(d => d.classList.remove("active"));
          if (!isActive) {
            drawer.classList.add("active");
            this.activeExpandedId = id;
          } else {
            this.activeExpandedId = null;
          }
        }
      }
    });

    // Enter key inside comment input
    container.addEventListener("keypress", e => {
      if (e.key === "Enter" && e.target.classList.contains("comment-input")) {
        const id = e.target.dataset.expenseId;
        const val = e.target.value.trim();
        if (val) {
          state.addComment(id, val);
          e.target.value = "";
          UI.showToast("Comment posted!");
        }
      }
    });
  }
};
