/* ==========================================================================
   Splitwise All Expenses View & Accordion Drawer
   Native Pro Features: Multi-criteria Search/Filter Toolbar, CSV/JSON Export & Print
   ========================================================================== */

const ExpensesView = {
  activeExpandedId: null,
  filterQuery: "",
  filterCategory: "all",
  filterType: "all", // 'all' | 'expenses' | 'settlements'

  render(container, state, filterGroupId = null, filterFriendId = null) {
    let allExpenses = state.getExpenses();
    const currentUserId = state.getCurrentUser().id;
    const groups = state.getGroups();
    const friends = state.getFriends();

    // 1. Context Filters (Group or Friend View)
    if (filterGroupId) {
      allExpenses = allExpenses.filter(e => e.group_id === filterGroupId);
    } else if (filterFriendId) {
      allExpenses = allExpenses.filter(e => {
        const involvesCurrent = e.payer_id === currentUserId || (e.splits && e.splits.some(s => s.user_id === currentUserId));
        const involvesFriend = e.payer_id === filterFriendId || (e.splits && e.splits.some(s => s.user_id === filterFriendId));
        return involvesCurrent && involvesFriend;
      });
    }

    // 2. Toolbar Multi-Criteria Filters (Native Pro)
    let filtered = allExpenses.filter(e => {
      // Query filter
      if (this.filterQuery) {
        const q = this.filterQuery.toLowerCase();
        const matchesDesc = e.description && e.description.toLowerCase().includes(q);
        const matchesNotes = e.notes && e.notes.toLowerCase().includes(q);
        if (!matchesDesc && !matchesNotes) return false;
      }

      // Category filter
      if (this.filterCategory !== "all") {
        if (e.category !== this.filterCategory) return false;
      }

      // Type filter
      if (this.filterType === "expenses" && e.is_settlement) return false;
      if (this.filterType === "settlements" && !e.is_settlement) return false;

      return true;
    });

    // Group expenses by Month (e.g. "OCTOBER 2026")
    const grouped = {};
    filtered.forEach(exp => {
      const monthKey = UI.formatMonthHeader(exp.date);
      if (!grouped[monthKey]) grouped[monthKey] = [];
      grouped[monthKey].push(exp);
    });

    const monthKeys = Object.keys(grouped);

    container.innerHTML = `
      <div class="content-header">
        <div class="header-title-area">
          <h1 class="header-title">All Expenses</h1>
          <span class="header-subtitle">${filtered.length} transaction${filtered.length === 1 ? '' : 's'}</span>
        </div>
        <div class="header-actions">
          <button class="btn btn-orange" id="btn-header-add-expense">Add an expense</button>
          <button class="btn btn-teal" id="btn-header-settle-up">Settle up</button>
        </div>
      </div>

      <div class="content-body">
        <!-- Native Pro: Deep Search & Multi-Criteria Filter Toolbar -->
        <div class="filter-toolbar">
          <div class="filter-row-top">
            <div class="filter-search-box">
              <span class="filter-search-icon">🔍</span>
              <input type="text" class="filter-search-input" id="expense-deep-search" placeholder="Search expenses by title or note..." value="${this.filterQuery}" />
            </div>

            <!-- Type Filter Select -->
            <select class="filter-select" id="expense-type-filter">
              <option value="all" ${this.filterType === 'all' ? 'selected' : ''}>All Types</option>
              <option value="expenses" ${this.filterType === 'expenses' ? 'selected' : ''}>Expenses Only</option>
              <option value="settlements" ${this.filterType === 'settlements' ? 'selected' : ''}>Settlements Only</option>
            </select>
          </div>

          <!-- Category Filter Pills -->
          <div class="filter-category-pills">
            <span class="filter-pill ${this.filterCategory === 'all' ? 'active' : ''}" data-cat="all">All Categories</span>
            ${DEFAULT_SEED_DATA.categories.map(c => `
              <span class="filter-pill ${this.filterCategory === c.id ? 'active' : ''}" data-cat="${c.id}">
                ${c.icon} ${c.name}
              </span>
            `).join("")}
          </div>
        </div>

        <!-- Native Pro: Export Actions Bar -->
        <div class="export-actions-bar">
          <span style="color:var(--color-text-secondary);">Showing <strong>${filtered.length}</strong> items</span>
          <div class="export-btn-group">
            <button class="btn btn-secondary btn-mini-settle" id="btn-export-csv" title="Download CSV spreadsheet">
              ${UI.icons.download} Export CSV
            </button>
            <button class="btn btn-secondary btn-mini-settle" id="btn-export-json" title="Download JSON ledger">
              JSON
            </button>
            <button class="btn btn-secondary btn-mini-settle" id="btn-print-report" title="Print statement">
              🖨️ Print
            </button>
          </div>
        </div>

        <!-- Expense Items List -->
        ${filtered.length === 0 ? `
          <div class="settled-empty-state">
            <div class="settled-empty-icon">🧾</div>
            <div class="settled-empty-title">No transactions found</div>
            <div class="settled-empty-text">Try adjusting your filters or click "Add an expense" above.</div>
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

    this.attachEventListeners(container, state, filtered, filterGroupId, filterFriendId);
  },

  renderExpenseRow(exp, state, currentUserId) {
    const dateInfo = UI.formatExpenseDate(exp.date);
    const categoryIcon = UI.getCategoryIcon(exp.category);
    const payer = state.getUser(exp.payer_id || exp.payerId);
    const isPayer = (exp.payer_id || exp.payerId) === currentUserId;

    // Calculate your share
    const mySplit = exp.splits && exp.splits.find(s => (s.user_id || s.userId) === currentUserId);
    const mySplitAmt = mySplit ? Number(mySplit.amount) : 0;
    const totalAmount = Number(exp.amount);

    let payerText = "";
    let shareText = "";
    let shareClass = "neutral-amount";

    if (exp.is_settlement || exp.isSettlement) {
      const recipientId = exp.splits && exp.splits[0] ? (exp.splits[0].user_id || exp.splits[0].userId) : null;
      const recipient = state.getUser(recipientId);
      payerText = `${payer.shortName || payer.name} paid ${recipient.shortName || recipient.name}`;
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
      payerText = `${payer.shortName || payer.name} paid ${UI.formatCurrency(totalAmount)}`;
      if (mySplitAmt > 0) {
        shareText = `you borrowed ${UI.formatCurrency(mySplitAmt)}`;
        shareClass = "negative-amount";
      } else {
        shareText = `not involved`;
        shareClass = "neutral-amount";
      }
    }

    let groupTag = "";
    const gId = exp.group_id || exp.groupId;
    if (gId) {
      const grp = state.getGroup(gId);
      if (grp) groupTag = ` · ${grp.name}`;
    }

    const isExpanded = this.activeExpandedId === exp.id;
    const receiptImage = exp.receipt_url || exp.receipt;

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
            <div class="expense-title">
              ${exp.description}
              ${receiptImage ? `<span title="Receipt attached" style="font-size:12px; margin-left:4px;">📎</span>` : ''}
            </div>
            <div class="expense-group-tag">
              ${UI.getCategoryName(exp.category)}${groupTag}
              ${exp.original_amount && exp.original_currency ? `<span style="color:var(--color-text-muted); font-size:10px;"> (${exp.original_currency} ${Number(exp.original_amount).toFixed(2)})</span>` : ''}
            </div>
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
              Added by <strong>${payer.name}</strong> on ${new Date(exp.created_at || exp.createdAt || exp.date).toLocaleDateString()}
              ${exp.notes ? `<div style="margin-top:4px; font-style:italic;">"${exp.notes}"</div>` : ''}
              ${exp.original_amount ? `<div style="margin-top:2px; font-size:11px; color:var(--color-text-muted);">💱 Foreign conversion: ${exp.original_currency} ${Number(exp.original_amount).toFixed(2)} at rate ${exp.exchange_rate || 1.0}</div>` : ''}
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
            ${exp.splits ? exp.splits.map(s => {
              const u = state.getUser(s.user_id || s.userId);
              return `
                <div class="breakdown-row">
                  <span>${u.name} owes</span>
                  <span>${UI.formatCurrency(s.amount)}</span>
                </div>
              `;
            }).join("") : ''}
          </div>

          <!-- Pro: Receipt Proof Image -->
          ${receiptImage ? `
            <div style="margin-bottom:16px; background:#fff; border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:10px;">
              <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:6px;">
                📎 Payment Proof / Receipt
              </div>
              <a href="${receiptImage}" target="_blank" title="Click to view full image">
                <img src="${receiptImage}" alt="Receipt" style="max-height:160px; max-width:100%; border-radius:4px; border:1px solid var(--color-border); object-fit:contain; box-shadow:0 1px 3px rgba(0,0,0,0.06);" />
              </a>
            </div>
          ` : ''}

          <!-- Comments Section -->
          <div class="expense-comments-section">
            <div class="comments-title">Comments & Activity</div>
            <div class="comments-list">
              ${(exp.comments && exp.comments.length > 0) ? exp.comments.map(c => {
                const author = state.getUser(c.user_id || c.userId);
                return `
                  <div class="comment-bubble">
                    <span class="comment-author">${author.shortName || author.name}</span>
                    <span class="comment-date">${UI.formatTimeAgo(c.created_at || c.createdAt)}</span>
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

  attachEventListeners(container, state, filteredExpenses, filterGroupId, filterFriendId) {
    // Search input
    const searchInp = container.querySelector("#expense-deep-search");
    if (searchInp) {
      searchInp.addEventListener("input", (e) => {
        this.filterQuery = e.target.value.trim();
        this.render(container, state, filterGroupId, filterFriendId);
      });
    }

    // Type filter
    const typeSelect = container.querySelector("#expense-type-filter");
    if (typeSelect) {
      typeSelect.addEventListener("change", (e) => {
        this.filterType = e.target.value;
        this.render(container, state, filterGroupId, filterFriendId);
      });
    }

    // Category pills
    container.querySelectorAll(".filter-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        this.filterCategory = pill.dataset.cat;
        this.render(container, state, filterGroupId, filterFriendId);
      });
    });

    // Native Pro: Export CSV
    const exportCsvBtn = container.querySelector("#btn-export-csv");
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener("click", () => this.exportCsv(filteredExpenses, state));
    }

    // Native Pro: Export JSON
    const exportJsonBtn = container.querySelector("#btn-export-json");
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener("click", () => this.exportJson(filteredExpenses));
    }

    // Native Pro: Print Report
    const printBtn = container.querySelector("#btn-print-report");
    if (printBtn) {
      printBtn.addEventListener("click", () => window.print());
    }

    // Row Click to Toggle Accordion Drawer
    container.addEventListener("click", async e => {
      const toggleTrigger = e.target.closest('[data-action="toggle-detail"]');
      const deleteQuick = e.target.closest('[data-action="quick-delete"]');
      const deleteBtn = e.target.closest('[data-action="delete-expense"]');
      const editBtn = e.target.closest('[data-action="edit-expense"]');
      const postCommentBtn = e.target.closest('[data-action="post-comment"]');

      if (deleteQuick || deleteBtn) {
        e.stopPropagation();
        const id = (deleteQuick || deleteBtn).dataset.expenseId;
        if (confirm("Are you sure you want to delete this expense? This cannot be undone.")) {
          try {
            await state.deleteExpense(id);
            UI.showToast("Expense deleted");
          } catch (err) {
            alert("Error deleting expense: " + err.message);
          }
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
          try {
            await state.addComment(id, input.value.trim());
            input.value = "";
            UI.showToast("Comment posted!");
            this.render(container, state, filterGroupId, filterFriendId);
          } catch (err) {
            alert("Error posting comment: " + err.message);
          }
        }
        return;
      }

      if (toggleTrigger) {
        const id = toggleTrigger.dataset.expenseId;
        const drawer = document.getElementById(`drawer-${id}`);
        if (drawer) {
          const isActive = drawer.classList.contains("active");
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
  },

  // Pro: Export CSV Spreadsheet
  exportCsv(expenses, state) {
    const headers = ["Date", "Description", "Category", "Amount", "Currency", "Payer", "Type", "Notes"];
    const rows = expenses.map(e => {
      const payer = state.getUser(e.payer_id || e.payerId);
      return [
        e.date,
        `"${(e.description || '').replace(/"/g, '""')}"`,
        e.category || 'general',
        (Number(e.amount) || 0).toFixed(2),
        e.currency || 'USD',
        `"${(payer.name || '').replace(/"/g, '""')}"`,
        e.is_settlement ? 'Settlement' : 'Expense',
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `splitwise_expenses_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    UI.showToast(`Exported ${expenses.length} expenses to CSV`);
  },

  // Pro: Export JSON Ledger
  exportJson(expenses) {
    const jsonContent = JSON.stringify(expenses, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `splitwise_ledger_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    UI.showToast("Exported JSON ledger");
  }
};
