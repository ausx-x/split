/* ==========================================================================
   Splitwise Settle Up Modal Controller
   ========================================================================== */

const SettleUpModal = {
  payerId: "user-1",
  recipientId: "user-2",
  amount: 0,
  method: "cash",
  groupId: null,

  init() {
    this.modalEl = document.getElementById("settle-up-modal");
    if (!this.modalEl) return;
    this.attachDomEvents();
  },

  open(options = {}) {
    const currentUser = store.getCurrentUser();
    const friends = store.getFriends();

    this.groupId = options.groupId || null;

    if (options.friendId) {
      const net = store.getFriendBalance(options.friendId);
      if (net < 0) {
        // Current user owes friend
        this.payerId = currentUser.id;
        this.recipientId = options.friendId;
        this.amount = Math.abs(net);
      } else {
        // Friend owes current user
        this.payerId = options.friendId;
        this.recipientId = currentUser.id;
        this.amount = net > 0 ? net : (options.amount || 10);
      }
    } else {
      // Find someone with non-zero balance or default to first friend
      const balances = store.getUserBalances();
      if (balances.friendsYouOwe.length > 0) {
        this.payerId = currentUser.id;
        this.recipientId = balances.friendsYouOwe[0].user.id;
        this.amount = balances.friendsYouOwe[0].amount;
      } else if (balances.friendsWhoOweYou.length > 0) {
        this.payerId = balances.friendsWhoOweYou[0].user.id;
        this.recipientId = currentUser.id;
        this.amount = balances.friendsWhoOweYou[0].amount;
      } else {
        this.payerId = currentUser.id;
        this.recipientId = friends[0]?.id || "user-2";
        this.amount = 0;
      }
    }

    if (options.amount !== undefined) {
      this.amount = options.amount;
    }

    this.render();
    this.modalEl.classList.add("active");
  },

  close() {
    this.modalEl.classList.remove("active");
  },

  render() {
    const container = this.modalEl.querySelector(".modal-body");
    const payer = store.getUser(this.payerId);
    const recipient = store.getUser(this.recipientId);
    const friends = store.getFriends();
    const currentUser = store.getCurrentUser();

    container.innerHTML = `
      <!-- Method Tabs -->
      <div class="settle-flow-tabs">
        <button type="button" class="settle-tab-btn ${this.method === 'cash' ? 'active' : ''}" data-method="cash">Record Cash</button>
        <button type="button" class="settle-tab-btn ${this.method === 'venmo' ? 'active' : ''}" data-method="venmo">Venmo</button>
        <button type="button" class="settle-tab-btn ${this.method === 'paypal' ? 'active' : ''}" data-method="paypal">PayPal</button>
      </div>

      <!-- Visual Flow Card -->
      <div class="settle-visual-flow">
        <!-- Payer -->
        <div class="settle-user-card">
          <div class="settle-avatar">
            ${UI.renderAvatar(payer)}
          </div>
          <select id="settle-payer-select" class="expense-field-input" style="font-size:12px; max-width:110px;">
            <option value="${currentUser.id}" ${this.payerId === currentUser.id ? 'selected' : ''}>You</option>
            ${friends.map(f => `
              <option value="${f.id}" ${this.payerId === f.id ? 'selected' : ''}>${f.shortName}</option>
            `).join("")}
          </select>
        </div>

        <div class="settle-arrow">➔</div>

        <!-- Recipient -->
        <div class="settle-user-card">
          <div class="settle-avatar">
            ${UI.renderAvatar(recipient)}
          </div>
          <select id="settle-recipient-select" class="expense-field-input" style="font-size:12px; max-width:110px;">
            <option value="${currentUser.id}" ${this.recipientId === currentUser.id ? 'selected' : ''}>You</option>
            ${friends.map(f => `
              <option value="${f.id}" ${this.recipientId === f.id ? 'selected' : ''}>${f.shortName}</option>
            `).join("")}
          </select>
        </div>
      </div>

      <!-- Amount Input -->
      <div class="settle-amount-wrapper">
        <div style="font-size:12px; color:var(--color-text-muted); margin-bottom:4px;">AMOUNT</div>
        <div style="display:inline-flex; align-items:center; justify-content:center;">
          <span style="font-size:24px; font-weight:700; color:var(--color-teal); margin-right:4px;">$</span>
          <input type="number" step="0.01" min="0" id="settle-amount-input" class="settle-amount-input" value="${Number(this.amount).toFixed(2)}" />
        </div>
      </div>

      <div style="margin-top:14px;">
        <label class="field-label">Date</label>
        <input type="date" id="settle-date-input" class="expense-field-input" value="${new Date().toISOString().split('T')[0]}" />
      </div>
    `;

    // Method tab listeners
    container.querySelectorAll(".settle-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".settle-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.method = btn.dataset.method;
      });
    });

    // Payer / Recipient selectors
    container.querySelector("#settle-payer-select").addEventListener("change", e => {
      this.payerId = e.target.value;
      this.render();
    });

    container.querySelector("#settle-recipient-select").addEventListener("change", e => {
      this.recipientId = e.target.value;
      this.render();
    });
  },

  attachDomEvents() {
    this.modalEl.querySelector(".modal-close-btn").addEventListener("click", () => this.close());
    this.modalEl.querySelector("#btn-cancel-settle").addEventListener("click", () => this.close());

    this.modalEl.querySelector("#btn-save-settle").addEventListener("click", () => {
      const amtInput = this.modalEl.querySelector("#settle-amount-input");
      const amt = Number(amtInput.value);

      if (!amt || amt <= 0) {
        alert("Please enter a valid settlement amount.");
        amtInput.focus();
        return;
      }

      if (this.payerId === this.recipientId) {
        alert("Payer and recipient cannot be the same person.");
        return;
      }

      store.settleDebt(this.payerId, this.recipientId, amt, this.method, this.groupId);
      UI.showToast(`Recorded payment of ${UI.formatCurrency(amt)}!`);
      this.close();
    });
  }
};

window.SettleUpModal = SettleUpModal;
