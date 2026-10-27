/* ==========================================================================
   Splitwise Charts & Visual Analytics View
   ========================================================================== */

const ChartsView = {
  render(container, state) {
    container.innerHTML = `
      <div class="content-header">
        <div class="header-title-area">
          <h1 class="header-title">Spending Analytics & Charts</h1>
        </div>
        <div class="header-actions">
          <button class="btn btn-orange" id="btn-header-add-expense">Add an expense</button>
        </div>
      </div>

      <div class="content-body" id="charts-main-content"></div>
    `;

    const body = container.querySelector("#charts-main-content");
    this.renderSpendingAnalytics(body, state.getExpenses(), state);
    DashboardView.renderRightSidebar(state);
  },

  renderGroupCharts(container, state, groupId) {
    const expenses = state.getExpenses().filter(e => e.groupId === groupId);
    container.innerHTML = `<div class="content-body" id="group-charts-body"></div>`;
    const body = container.querySelector("#group-charts-body");
    this.renderSpendingAnalytics(body, expenses, state);
  },

  renderSpendingAnalytics(container, expenses, state) {
    // Calculate total and category breakdown
    const categoryTotals = {};
    let grandTotal = 0;

    expenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      grandTotal += amt;
      const cat = e.category || "general";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    });

    const categoryEntries = Object.entries(categoryTotals)
      .map(([catId, amount]) => ({
        catId,
        amount,
        percent: grandTotal > 0 ? (amount / grandTotal) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    const colors = [
      "#5bc5a7", "#3280ea", "#f5a623", "#7a52cc", "#e74c3c", "#1abc9c", "#34495e"
    ];

    container.innerHTML = `
      <div class="charts-view-container">
        <!-- Overview summary banner -->
        <div class="chart-card">
          <div class="chart-card-title">
            <span>Total Group Spending</span>
            <span class="positive-amount" style="font-size:18px;">${UI.formatCurrency(grandTotal)}</span>
          </div>
          <div style="font-size:12px; color:var(--color-text-secondary);">
            Computed across ${expenses.length} recorded expense transactions.
          </div>
        </div>

        <!-- Category Breakdown Progress Bars -->
        <div class="chart-card">
          <div class="chart-card-title">
            <span>Spending by Category</span>
          </div>
          ${categoryEntries.length === 0 ? `
            <div style="font-size:12px; color:var(--color-text-muted); font-style:italic;">No expenses to analyze.</div>
          ` : `
            <div class="category-bars-list">
              ${categoryEntries.map((item, idx) => {
                const color = colors[idx % colors.length];
                return `
                  <div class="category-bar-item">
                    <div class="category-bar-header">
                      <span class="category-bar-label">
                        <span>${UI.getCategoryIcon(item.catId)}</span>
                        <span>${UI.getCategoryName(item.catId)}</span>
                        <span style="color:var(--color-text-muted); font-size:11px;">(${item.percent.toFixed(1)}%)</span>
                      </span>
                      <span class="category-bar-amount">${UI.formatCurrency(item.amount)}</span>
                    </div>
                    <div class="category-bar-track">
                      <div class="category-bar-fill" style="width: ${item.percent}%; background-color: ${color};"></div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          `}
        </div>

        <!-- Monthly Trends Histogram -->
        <div class="chart-card">
          <div class="chart-card-title">
            <span>Monthly Spending Trends</span>
          </div>
          <div class="histogram-container">
            <div class="histogram-bar-col">
              <div class="histogram-bar-amount">$340</div>
              <div class="histogram-bar-pill" style="height: 45%;"></div>
              <div class="histogram-bar-label">AUG</div>
            </div>
            <div class="histogram-bar-col">
              <div class="histogram-bar-amount">$510</div>
              <div class="histogram-bar-pill" style="height: 70%;"></div>
              <div class="histogram-bar-label">SEP</div>
            </div>
            <div class="histogram-bar-col">
              <div class="histogram-bar-amount">${UI.formatCurrency(grandTotal)}</div>
              <div class="histogram-bar-pill" style="height: 95%; background-color: var(--color-orange);"></div>
              <div class="histogram-bar-label">OCT</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};
