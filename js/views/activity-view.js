/* ==========================================================================
   Splitwise Recent Activity View
   ========================================================================== */

const ActivityView = {
  render(container, state) {
    const notifications = state.state.notifications || [];

    container.innerHTML = `
      <div class="content-header">
        <div class="header-title-area">
          <h1 class="header-title">Recent Activity</h1>
          <span class="header-subtitle">${notifications.length} update${notifications.length === 1 ? '' : 's'}</span>
        </div>
        <div class="header-actions">
          ${notifications.length > 0 ? `
            <button class="btn btn-secondary btn-mini-settle" id="btn-mark-all-read">
              Mark all as read
            </button>
          ` : ''}
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
            <div class="settled-empty-text">When you or friends add expenses, comments, or settlements, they'll show up here.</div>
          </div>
        ` : `
          <div class="activity-feed">
            ${notifications.map(item => {
              const actor = {
                name: item.actor_name || "Friend",
                shortName: item.actor_short_name || item.actor_name || "Friend",
                avatar: item.actor_avatar,
                color: item.actor_color || "#5bc5a7"
              };
              return `
                <div class="activity-item ${item.is_read ? '' : 'unread'}" style="${item.is_read ? '' : 'background-color: var(--color-teal-light);'}">
                  <div class="activity-avatar">
                    ${UI.renderAvatar(actor)}
                  </div>
                  <div class="activity-body">
                    <div class="activity-text">
                      ${item.message}
                    </div>
                    <div class="activity-time">${UI.formatTimeAgo(item.created_at || item.createdAt)}</div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `}
      </div>
    `;

    const markReadBtn = container.querySelector("#btn-mark-all-read");
    if (markReadBtn) {
      markReadBtn.addEventListener("click", async () => {
        await state.markNotificationsRead();
        this.render(container, state);
      });
    }

    DashboardView.renderRightSidebar(state);
  }
};
