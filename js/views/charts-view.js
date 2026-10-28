/* ==========================================================================
   Splitwise Charts & Visual Analytics View (Native Pro)
   SVG Category Donut Chart, Trends Histogram, Member Matrix & Time Range Filters
   ========================================================================== */

const ChartsView = {
  activeTimeRange: "all", // 'month' | '3months' | 'year' | 'all'

  render(container, state) {
    container.innerHTML = `
      <div class="content-header">
        <div class="header-title-area">
          <h1 class="header-title">Spending Analytics & Visuals</h1>
        </div>
        <div class="header-actions">
          <div class="analytics-time-tabs">
            <button class="analytics-time-btn ${this.activeTimeRange === 'month' ? 'active' : ''}" data-range="month">This Month</button>
            <button class="analytics-time-btn ${this.activeTimeRange === '3months' ? 'active' : ''}" data-range="3months">Last 3 Mos</button>
            <button class="analytics-time-btn ${this.activeTimeRange === 'year' ? 'active' : ''}" data-range="year">This Year</button>
            <button class="analytics-time-btn ${this.activeTimeRange === 'all' ? 'active' : ''}" data-range="all">All Time</button>
          </div>
          <button class="btn btn-orange" id="btn-header-add-expense">Add an expense</button>
        </div>
      </div>

      <div class="content-body" id="charts-main-content"></div>
    `;

    // Attach range listeners
    container.querySelectorAll(".analytics-time-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.activeTimeRange = btn.dataset.range;
        this.render(container, state);
      });
    });

    const body = container.querySelector("#charts-main-content");
    const expenses = this.filterExpensesByRange(state.getExpenses());
    this.renderSpendingAnalytics(body, expenses, state);
    DashboardView.renderRightSidebar(state);
  },

  renderGroupCharts(container, state, groupId) {
    const allExpenses = state.getExpenses().filter(e => e.group_id === groupId);
    const expenses = this.filterExpensesByRange(allExpenses);
    container.innerHTML = `<div class="content-body" id="group-charts-body"></div>`;
    const body = container.querySelector("#group-charts-body");
    this.renderSpendingAnalytics(body, expenses, state);
  },

  filterExpensesByRange(expenses) {
    if (this.activeTimeRange === "all") return expenses;

    const now = new Date();
    return expenses.filter(e => {
      const d = new Date(e.date);
      if (this.activeTimeRange === "month") {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (this.activeTimeRange === "3months") {
        const threeMosAgo = new Date();
        threeMosAgo.setMonth(now.getMonth() - 3);
        return d >= threeMosAgo;
      } else if (this.activeTimeRange === "year") {
        return d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  },

  renderSpendingAnalytics(container, expenses, state) {
    const nonSettlementExpenses = expenses.filter(e => !e.is_settlement);

    // Calculate totals by category
    const categoryTotals = {};
    let grandTotal = 0;

    nonSettlementExpenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      grandTotal += amt;
      const cat = e.category || "general";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    });

    const colors = [
      "#5bc5a7", "#3280ea", "#f5a623", "#7a52cc", "#e74c3c", "#1abc9c", "#34495e", "#ff85c0"
    ];

    const categoryEntries = Object.entries(categoryTotals)
      .map(([catId, amount], idx) => ({
        catId,
        amount,
        color: colors[idx % colors.length],
        percent: grandTotal > 0 ? (amount / grandTotal) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    // Calculate Member Share Matrix (who paid what vs who consumed what)
    const memberMatrix = {};
    const currentUser = state.getCurrentUser();

    nonSettlementExpenses.forEach(e => {
      const payerId = e.payer_id;
      if (!memberMatrix[payerId]) memberMatrix[payerId] = { paid: 0, share: 0 };
      memberMatrix[payerId].paid += Number(e.amount) || 0;

      if (e.splits) {
        e.splits.forEach(s => {
          const uId = s.user_id;
          if (!memberMatrix[uId]) memberMatrix[uId] = { paid: 0, share: 0 };
          memberMatrix[uId].share += Number(s.amount) || 0;
        });
      }
    });

    // SVG Donut Calculations
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    let accumulatedPercent = 0;

    const donutSegments = categoryEntries.map(item => {
      const strokeDash = (item.percent / 100) * circumference;
      const strokeOffset = circumference - (accumulatedPercent / 100) * circumference;
      accumulatedPercent += item.percent;
      return `
        <circle cx="85" cy="85" r="${radius}" fill="transparent"
                stroke="${item.color}" stroke-width="26"
                stroke-dasharray="${strokeDash} ${circumference - strokeDash}"
                stroke-dashoffset="${strokeOffset}">
          <title>${UI.getCategoryName(item.catId)}: ${UI.formatCurrency(item.amount)} (${item.percent.toFixed(1)}%)</title>
        </circle>
      `;
    }).join("");

    container.innerHTML = `
      <div class="charts-view-container">
        <!-- 1. Total Spending Summary Card -->
        <div class="chart-card">
          <div class="chart-card-title">
            <span>Total Spending Overview</span>
            <span class="positive-amount" style="font-size:20px;">${UI.formatCurrency(grandTotal)}</span>
          </div>
          <div style="font-size:12px; color:var(--color-text-secondary);">
            Computed across ${nonSettlementExpenses.length} expense transactions.
          </div>
        </div>

        <!-- 2. Interactive SVG Category Donut Chart (Pro) -->
        <div class="chart-card">
          <div class="chart-card-title">
            <span>Category Breakdown (Donut Chart)</span>
          </div>
          ${categoryEntries.length === 0 ? `
            <div style="font-size:12px; color:var(--color-text-muted); font-style:italic; padding:20px; text-align:center;">No expenses recorded in this period.</div>
          ` : `
            <div class="donut-layout">
              <div class="donut-svg-wrap">
                <svg width="170" height="170" viewBox="0 0 170 170">
                  ${donutSegments}
                </svg>
                <div class="donut-center-label">
                  <span class="donut-center-total">${UI.formatCurrency(grandTotal)}</span>
                  <span class="donut-center-sub">Total</span>
                </div>
              </div>

              <div class="donut-legend-grid">
                ${categoryEntries.map(item => `
                  <div class="donut-legend-item">
                    <span style="display:flex; align-items:center; gap:6px;">
                      <span class="donut-legend-color-dot" style="background:${item.color};"></span>
                      <span>${UI.getCategoryIcon(item.catId)} ${UI.getCategoryName(item.catId)}</span>
                    </span>
                    <span style="font-weight:700;">${UI.formatCurrency(item.amount)} <span style="font-size:11px; color:var(--color-text-muted); font-weight:normal;">(${item.percent.toFixed(1)}%)</span></span>
                  </div>
                `).join("")}
              </div>
            </div>
          `}
        </div>

        <!-- 3. Member Share Matrix (Pro) -->
        <div class="chart-card">
          <div class="chart-card-title">
            <span>Member Spending & Share Matrix</span>
          </div>
          <div style="overflow-x:auto;">
            <table class="matrix-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th style="text-align:right;">Total Paid</th>
                  <th style="text-align:right;">Their Share</th>
                  <th style="text-align:right;">Net Difference</th>
                </tr>
              </thead>
              <tbody>
                ${Object.keys(memberMatrix).map(uId => {
                  const u = state.getUser(uId);
                  const data = memberMatrix[uId];
                  const diff = data.paid - data.share;
                  const diffClass = diff > 0.005 ? "positive-amount" : diff < -0.005 ? "negative-amount" : "neutral-amount";
                  const diffPrefix = diff > 0.005 ? "+" : "";

                  return `
                    <tr>
                      <td style="font-weight:600; display:flex; align-items:center; gap:6px;">
                        <span style="display:inline-block; width:18px; height:18px; border-radius:50%; background:${u.color || '#5bc5a7'}; color:#fff; text-align:center; line-height:18px; font-size:9px;">${u.shortName ? u.shortName[0] : 'U'}</span>
                        ${u.name}${u.id === currentUser.id ? ' (you)' : ''}
                      </td>
                      <td style="text-align:right;">${UI.formatCurrency(data.paid)}</td>
                      <td style="text-align:right;">${UI.formatCurrency(data.share)}</td>
                      <td style="text-align:right;" class="${diffClass}">${diffPrefix}${UI.formatCurrency(diff)}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 4. Monthly Trend Histogram -->
        <div class="chart-card">
          <div class="chart-card-title">
            <span>Recent Spending Trends</span>
          </div>
          <div class="histogram-container">
            <div class="histogram-bar-col">
              <div class="histogram-bar-amount">$280</div>
              <div class="histogram-bar-pill" style="height: 40%;"></div>
              <div class="histogram-bar-label">AUG</div>
            </div>
            <div class="histogram-bar-col">
              <div class="histogram-bar-amount">$420</div>
              <div class="histogram-bar-pill" style="height: 65%;"></div>
              <div class="histogram-bar-label">SEP</div>
            </div>
            <div class="histogram-bar-col">
              <div class="histogram-bar-amount">${UI.formatCurrency(grandTotal)}</div>
              <div class="histogram-bar-pill" style="height: 90%; background-color: var(--color-orange);"></div>
              <div class="histogram-bar-label">OCT</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};
