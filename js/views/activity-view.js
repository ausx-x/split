/* ==========================================================================
   Splitwise Recent Activity View
   ========================================================================== */

const ActivityView = {
  render(container, state) {
    const notifications = state.state.notifications || [];
    const expenses = state.getExpenses();

    container.innerHTML = `
      <div class="content-header">
        <div class="header-title-area">
          <h1 class="header-title">Recent Activity</h1>
        </div>
        <div class="header-actions">
          <button class="btn btn-orange" id="btn-header-add-expense">
            Add an expense
          </button>
        </div>
      </div>

      <div class="content-body">
        ${notifications.length === 0 ? `
          <div class="settled-empty-state">
            <div class="settled-empty-icon">🔔</div>
            <div class="settled-empty-title">No recent activity</div>
            <div class="settled-empty-text">When friends add expenses or comments, they'll show up here.</div>
          </div>
        ` : `
          <div class="activity-feed">
            ${notifications.map(item => {
              const user = state.getUser(item.userId);
              return `
                <div class="activity-item">
                  <div class="activity-avatar">
                    ${UI.renderAvatar(user)}
                  </div>
                  <div class="activity-body">
                    <div class="activity-text">
                      ${item.message}
                    </div>
                    <div class="activity-time">${item.time || "Recently"}</div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `}
      </div>
    `;

    // Right sidebar for Activity
    DashboardView.renderRightSidebar(state);
  }
};
