/* ==========================================================================
   Splitwise Group View
   ========================================================================== */

const GroupView = {
  activeTab: "list", // 'list' | 'chart'

  render(container, state, groupId) {
    const group = state.getGroup(groupId);
    if (!group) {
      container.innerHTML = `<div class="content-body">Group not found.</div>`;
      return;
    }

    const currentUserId = state.getCurrentUser().id;
    const debts = state.getSimplifiedGroupDebts(groupId);
    const members = group.members.map(mId => state.getUser(mId));

    container.innerHTML = `
      <div class="content-header">
        <div class="header-title-area">
          <div class="header-avatar" style="background-color: var(--color-teal); font-size:20px;">
            ${group.icon || '🏠'}
          </div>
          <div>
            <h1 class="header-title">${group.name}</h1>
            <div class="header-subtitle">${group.type} · ${group.members.length} members</div>
          </div>
        </div>

        <div class="header-actions">
          <div class="view-mode-toggles">
            <button class="view-toggle-btn ${this.activeTab === 'list' ? 'active' : ''}" id="btn-group-view-list">
              ${UI.icons.allExpenses} List
            </button>
            <button class="view-toggle-btn ${this.activeTab === 'chart' ? 'active' : ''}" id="btn-group-view-chart">
              ${UI.icons.chart} Chart
            </button>
          </div>

          <button class="btn btn-orange" id="btn-header-add-expense" data-default-group="${group.id}">
            Add an expense
          </button>
          <button class="btn btn-teal" id="btn-header-settle-up" data-group-id="${group.id}">
            Settle up
          </button>
        </div>
      </div>

      <div id="group-tab-container"></div>
    `;

    // Render Tab Content
    const tabContainer = container.querySelector("#group-tab-container");
    if (this.activeTab === "list") {
      ExpensesView.render(tabContainer, state, groupId);
    } else {
      ChartsView.renderGroupCharts(tabContainer, state, groupId);
    }

    // Render Right Sidebar
    this.renderRightSidebar(state, group, debts, members);

    // Tab toggle listeners
    container.querySelector("#btn-group-view-list").addEventListener("click", () => {
      this.activeTab = "list";
      this.render(container, state, groupId);
    });

    container.querySelector("#btn-group-view-chart").addEventListener("click", () => {
      this.activeTab = "chart";
      this.render(container, state, groupId);
    });
  },

  renderRightSidebar(state, group, debts, members) {
    const sidebar = document.getElementById("app-sidebar-right");
    if (!sidebar) return;

    const currentUserId = state.getCurrentUser().id;

    sidebar.innerHTML = `
      <!-- Group Balances -->
      <div>
        <div class="right-section-title">
          <span>GROUP BALANCES</span>
        </div>
        ${debts.transactions.length === 0 ? `
          <div style="font-size:12px; color:var(--color-text-muted); font-style:italic;">No outstanding debts in this group!</div>
        ` : `
          <div class="group-debts-list">
            ${debts.transactions.map(t => `
              <div class="group-debt-item">
                <span><strong>${t.from.shortName}</strong> owes <strong>${t.to.shortName}</strong></span>
                <span class="positive-amount" style="margin-left:auto;">${UI.formatCurrency(t.amount)}</span>
              </div>
            `).join("")}
          </div>
        `}
      </div>

      <!-- Group Members -->
      <div>
        <div class="right-section-title">
          <span>GROUP MEMBERS</span>
          <span class="sidebar-add-action" id="btn-invite-group-members" style="font-size:10px;">+ add</span>
        </div>
        <div class="group-members-list">
          ${members.map(m => {
            const net = debts.memberBalances[m.id] || 0;
            let statusText = "gets back " + UI.formatCurrency(net);
            let statusColor = "positive-amount";
            if (net < -0.005) {
              statusText = "owes " + UI.formatCurrency(Math.abs(net));
              statusColor = "negative-amount";
            } else if (Math.abs(net) <= 0.005) {
              statusText = "settled up";
              statusColor = "neutral-amount";
            }

            return `
              <div class="group-member-item">
                <div class="group-member-avatar">
                  ${UI.renderAvatar(m)}
                </div>
                <span class="group-member-name">${m.name}${m.id === currentUserId ? ' (you)' : ''}</span>
                <span class="group-member-balance ${statusColor}">${statusText}</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <!-- Group Whiteboard Sticky Note -->
      <div class="group-whiteboard">
        <div class="whiteboard-header">
          <span>Whiteboard</span>
          <button class="btn-text" id="btn-edit-whiteboard" style="padding:0; font-size:11px; color:#bfa12b;">Edit</button>
        </div>
        <div class="whiteboard-content" id="whiteboard-display">${group.whiteboard || "Click edit to leave notes for the group!"}</div>
        <textarea class="whiteboard-textarea hidden" id="whiteboard-input">${group.whiteboard || ""}</textarea>
        <button class="btn btn-teal btn-mini-settle hidden" id="btn-save-whiteboard" style="margin-top:6px; width:100%;">Save Note</button>
      </div>

      <!-- Export to CSV -->
      <div class="sidebar-action-links">
        <a href="#" class="sidebar-action-link" id="btn-export-group-csv">
          ${UI.icons.download}
          <span>Export as CSV</span>
        </a>
      </div>
    `;

    // Whiteboard editing handlers
    const editBtn = sidebar.querySelector("#btn-edit-whiteboard");
    const saveBtn = sidebar.querySelector("#btn-save-whiteboard");
    const display = sidebar.querySelector("#whiteboard-display");
    const input = sidebar.querySelector("#whiteboard-input");

    if (editBtn && saveBtn && display && input) {
      editBtn.addEventListener("click", () => {
        display.classList.add("hidden");
        editBtn.classList.add("hidden");
        input.classList.remove("hidden");
        saveBtn.classList.remove("hidden");
        input.focus();
      });

      saveBtn.addEventListener("click", () => {
        state.updateWhiteboard(group.id, input.value.trim());
        display.textContent = input.value.trim() || "No notes.";
        display.classList.remove("hidden");
        editBtn.classList.remove("hidden");
        input.classList.add("hidden");
        saveBtn.classList.add("hidden");
        UI.showToast("Whiteboard updated!");
      });
    }

    // Export CSV handler
    const exportBtn = sidebar.querySelector("#btn-export-group-csv");
    if (exportBtn) {
      exportBtn.addEventListener("click", e => {
        e.preventDefault();
        this.exportCSV(state, group);
      });
    }
  },

  exportCSV(state, group) {
    const expenses = state.getExpenses().filter(e => e.groupId === group.id);
    const headers = ["Date", "Description", "Category", "Cost", "Currency", "Paid By"];

    const rows = expenses.map(e => {
      const payer = state.getUser(e.payerId);
      return [
        e.date,
        `"${e.description.replace(/"/g, '""')}"`,
        e.category,
        e.amount.toFixed(2),
        e.currency,
        `"${payer.name}"`
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${group.name.replace(/\s+/g, "_")}_expenses.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    UI.showToast(`Exported ${expenses.length} expenses to CSV`);
  }
};
