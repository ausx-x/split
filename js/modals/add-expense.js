/* ==========================================================================
   Splitwise Add / Edit Expense Modal Controller
   ========================================================================== */

const AddExpenseModal = {
  activeExpense: null, // null for new, or expense object if editing
  selectedCategory: "general",
  selectedPayerId: "user-1",
  selectedSplitType: "equal", // 'equal' | 'exact' | 'percent' | 'shares'
  selectedParticipants: [], // array of userIds
  splitsConfig: {}, // { userId: value }
  selectedGroupId: null,

  init() {
    this.modalEl = document.getElementById("add-expense-modal");
    if (!this.modalEl) return;
    this.attachDomEvents();
  },

  open(options = {}) {
    this.activeExpense = null;
    const currentUser = store.getCurrentUser();
    this.selectedPayerId = currentUser.id;
    this.selectedSplitType = "equal";
    this.selectedCategory = "general";
    this.selectedGroupId = options.defaultGroup || null;

    // Determine initial participants
    if (this.selectedGroupId) {
      const grp = store.getGroup(this.selectedGroupId);
      this.selectedParticipants = grp ? [...grp.members] : [currentUser.id];
    } else if (options.defaultFriend) {
      this.selectedParticipants = [currentUser.id, options.defaultFriend];
    } else {
      // Default to currentUser + first 2 friends
      const friends = store.getFriends();
      this.selectedParticipants = [currentUser.id, ...friends.slice(0, 2).map(f => f.id)];
    }

    this.renderForm();
    this.modalEl.classList.add("active");
  },

  openForEdit(expense) {
    this.activeExpense = expense;
    this.selectedPayerId = expense.payerId;
    this.selectedSplitType = expense.splitType || "equal";
    this.selectedCategory = expense.category || "general";
    this.selectedGroupId = expense.groupId || null;
    this.selectedParticipants = expense.splits.map(s => s.userId);

    this.renderForm(expense);
    this.modalEl.classList.add("active");
  },

  close() {
    this.modalEl.classList.remove("active");
    this.closeSubModals();
  },

  closeSubModals() {
    const payerPopover = document.getElementById("payer-popover");
    const splitPopover = document.getElementById("split-popover");
    const catPicker = document.getElementById("category-picker-modal");
    if (payerPopover) payerPopover.classList.add("hidden");
    if (splitPopover) splitPopover.classList.add("hidden");
    if (catPicker) catPicker.classList.add("hidden");
  },

  renderForm(existingData = null) {
    const container = this.modalEl.querySelector(".modal-body");
    const groups = store.getGroups();
    const currentUser = store.getCurrentUser();
    const isEdit = !!existingData;

    this.modalEl.querySelector(".modal-title").textContent = isEdit ? "Edit expense" : "Add an expense";

    container.innerHTML = `
      <!-- With you and input / group selector -->
      <div class="expense-with-row">
        <div class="expense-with-label">
          With <strong>you</strong> and:
        </div>
        <div class="expense-with-input-wrapper">
          <div class="expense-chips-container" id="expense-chips-container">
            ${this.selectedParticipants.filter(id => id !== currentUser.id).map(id => {
              const u = store.getUser(id);
              return `
                <span class="expense-chip" data-user-id="${u.id}">
                  ${u.shortName}
                  <span class="expense-chip-remove" data-action="remove-chip" data-user-id="${u.id}">&times;</span>
                </span>
              `;
            }).join("")}
            <input type="text" class="expense-chip-input" id="expense-chip-input" placeholder="Type friend or group name..." />
          </div>

          <!-- Suggestions Dropdown -->
          <div class="autocomplete-dropdown" id="expense-autocomplete"></div>
        </div>
      </div>

      <!-- Main Form Row: Icon + Description + Amount -->
      <div class="expense-main-form">
        <button type="button" class="category-icon-picker-btn" id="btn-open-category-picker" title="Change category">
          <span id="selected-category-icon">${UI.getCategoryIcon(this.selectedCategory)}</span>
        </button>

        <div class="expense-inputs-block">
          <input type="text" id="expense-description-input" class="expense-desc-input" placeholder="Enter a description" value="${existingData ? existingData.description : ''}" autofocus />

          <div class="expense-amount-row">
            <select class="currency-select" id="expense-currency-select">
              <option value="USD" selected>$</option>
              <option value="EUR">€</option>
              <option value="GBP">£</option>
              <option value="INR">₹</option>
              <option value="JPY">¥</option>
            </select>
            <input type="number" step="0.01" min="0" id="expense-amount-input" class="expense-amount-input" placeholder="0.00" value="${existingData ? existingData.amount.toFixed(2) : ''}" />
          </div>
        </div>
      </div>

      <!-- Interactive "Paid by [you] and split [equally]" sentence -->
      <div class="split-phrase-container">
        Paid by <a class="split-clickable-link" id="link-choose-payer">${this.getPayerNameDisplay()}</a>
        and split <a class="split-clickable-link" id="link-choose-split">${this.getSplitTypeDisplay()}</a>.
      </div>

      <!-- Payer Selection Popover Sub-dialog -->
      <div id="payer-popover" class="hidden" style="margin-bottom:14px; background:#fff; border:1px solid var(--color-border); padding:12px; border-radius:var(--radius-sm);">
        <div style="font-weight:700; font-size:12px; margin-bottom:8px; color:var(--color-text-muted);">CHOOSE PAYER</div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${this.selectedParticipants.map(id => {
            const u = store.getUser(id);
            return `
              <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                <input type="radio" name="payer-radio" value="${u.id}" ${this.selectedPayerId === u.id ? 'checked' : ''} />
                <span>${u.name}${u.id === currentUser.id ? ' (you)' : ''}</span>
              </label>
            `;
          }).join("")}
        </div>
      </div>

      <!-- Split Options Popover Sub-dialog -->
      <div id="split-popover" class="hidden" style="margin-bottom:14px; background:#fff; border:1px solid var(--color-border); padding:12px; border-radius:var(--radius-sm);">
        <div class="split-tabs-header">
          <button type="button" class="split-tab-btn ${this.selectedSplitType === 'equal' ? 'active' : ''}" data-split-tab="equal">Split Equally (=)</button>
          <button type="button" class="split-tab-btn ${this.selectedSplitType === 'exact' ? 'active' : ''}" data-split-tab="exact">Exact Amounts ($)</button>
          <button type="button" class="split-tab-btn ${this.selectedSplitType === 'percent' ? 'active' : ''}" data-split-tab="percent">Percentages (%)</button>
          <button type="button" class="split-tab-btn ${this.selectedSplitType === 'shares' ? 'active' : ''}" data-split-tab="shares">Shares (lll)</button>
        </div>
        <div id="split-tab-content"></div>
      </div>

      <!-- Secondary Fields: Date & Group -->
      <div class="expense-extra-fields">
        <div>
          <label class="field-label">Date</label>
          <input type="date" id="expense-date-input" class="expense-field-input" value="${existingData ? existingData.date : new Date().toISOString().split('T')[0]}" />
        </div>
        <div>
          <label class="field-label">Group</label>
          <select id="expense-group-select" class="expense-field-input">
            <option value="">No Group</option>
            ${groups.map(g => `
              <option value="${g.id}" ${this.selectedGroupId === g.id ? 'selected' : ''}>${g.name}</option>
            `).join("")}
          </select>
        </div>
      </div>

      <!-- Notes input -->
      <div style="margin-bottom: 12px;">
        <label class="field-label">Add Notes / Memo</label>
        <textarea id="expense-notes-input" class="expense-field-input" rows="2" placeholder="e.g. Flight booking reference or receipt notes">${existingData ? (existingData.notes || '') : ''}</textarea>
      </div>

      <!-- Category Picker Modal Overlay inside -->
      <div id="category-picker-modal" class="hidden" style="background:#fff; border:1px solid var(--color-border); padding:12px; border-radius:var(--radius-sm); margin-bottom:14px;">
        <div style="font-weight:700; font-size:12px; margin-bottom:8px; color:var(--color-text-muted);">SELECT A CATEGORY</div>
        <div class="category-grid">
          ${DEFAULT_SEED_DATA.categories.map(c => `
            <div class="category-tile ${this.selectedCategory === c.id ? 'active' : ''}" data-cat-id="${c.id}">
              <span class="category-tile-icon">${c.icon}</span>
              <span class="category-tile-name">${c.name}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    this.attachFormListeners();
  },

  getPayerNameDisplay() {
    const currentUser = store.getCurrentUser();
    if (this.selectedPayerId === currentUser.id) return "you";
    const u = store.getUser(this.selectedPayerId);
    return u.shortName;
  },

  getSplitTypeDisplay() {
    switch (this.selectedSplitType) {
      case "equal": return "equally";
      case "exact": return "by exact amounts";
      case "percent": return "by percentages";
      case "shares": return "by shares";
      default: return "equally";
    }
  },

  attachFormListeners() {
    const container = this.modalEl.querySelector(".modal-body");
    const descInput = container.querySelector("#expense-description-input");
    const amountInput = container.querySelector("#expense-amount-input");
    const chipInput = container.querySelector("#expense-chip-input");
    const autocomplete = container.querySelector("#expense-autocomplete");
    const groupSelect = container.querySelector("#expense-group-select");

    // Smart Category Auto-Detection when typing description
    descInput.addEventListener("input", e => {
      if (this.selectedCategory === "general" || !this.selectedCategory) {
        const detected = UI.detectCategory(e.target.value);
        if (detected !== "general") {
          this.selectedCategory = detected;
          container.querySelector("#selected-category-icon").textContent = UI.getCategoryIcon(detected);
        }
      }
    });

    // Payer popover toggle
    container.querySelector("#link-choose-payer").addEventListener("click", () => {
      const popover = container.querySelector("#payer-popover");
      popover.classList.toggle("hidden");
    });

    container.querySelectorAll('input[name="payer-radio"]').forEach(radio => {
      radio.addEventListener("change", e => {
        this.selectedPayerId = e.target.value;
        container.querySelector("#link-choose-payer").textContent = this.getPayerNameDisplay();
        container.querySelector("#payer-popover").classList.add("hidden");
      });
    });

    // Split popover toggle
    container.querySelector("#link-choose-split").addEventListener("click", () => {
      const popover = container.querySelector("#split-popover");
      popover.classList.toggle("hidden");
      this.renderSplitTabContent();
    });

    // Split tabs click
    container.querySelectorAll(".split-tab-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        container.querySelectorAll(".split-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.selectedSplitType = btn.dataset.splitTab;
        container.querySelector("#link-choose-split").textContent = this.getSplitTypeDisplay();
        this.renderSplitTabContent();
      });
    });

    // Category Picker toggle
    container.querySelector("#btn-open-category-picker").addEventListener("click", () => {
      const catModal = container.querySelector("#category-picker-modal");
      catModal.classList.toggle("hidden");
    });

    container.querySelectorAll(".category-tile").forEach(tile => {
      tile.addEventListener("click", () => {
        this.selectedCategory = tile.dataset.catId;
        container.querySelector("#selected-category-icon").textContent = UI.getCategoryIcon(this.selectedCategory);
        container.querySelector("#category-picker-modal").classList.add("hidden");
      });
    });

    // Group select change
    groupSelect.addEventListener("change", e => {
      this.selectedGroupId = e.target.value || null;
      if (this.selectedGroupId) {
        const grp = store.getGroup(this.selectedGroupId);
        if (grp) {
          this.selectedParticipants = [...grp.members];
          this.renderForm();
        }
      }
    });

    // Autocomplete chip input
    chipInput.addEventListener("input", e => {
      const val = e.target.value.toLowerCase().trim();
      if (!val) {
        autocomplete.classList.remove("active");
        return;
      }

      const allFriends = store.getFriends();
      const allGroups = store.getGroups();

      const matchedFriends = allFriends.filter(f => f.name.toLowerCase().includes(val) && !this.selectedParticipants.includes(f.id));
      const matchedGroups = allGroups.filter(g => g.name.toLowerCase().includes(val));

      if (matchedFriends.length === 0 && matchedGroups.length === 0) {
        autocomplete.classList.remove("active");
        return;
      }

      autocomplete.innerHTML = `
        ${matchedGroups.map(g => `
          <div class="autocomplete-item" data-type="group" data-id="${g.id}">
            <span>${g.icon || '🏠'}</span>
            <span><strong>${g.name}</strong> (Group)</span>
          </div>
        `).join("")}
        ${matchedFriends.map(f => `
          <div class="autocomplete-item" data-type="friend" data-id="${f.id}">
            <span>${f.shortName.slice(0, 1)}</span>
            <span>${f.name}</span>
          </div>
        `).join("")}
      `;
      autocomplete.classList.add("active");
    });

    autocomplete.addEventListener("click", e => {
      const item = e.target.closest(".autocomplete-item");
      if (!item) return;

      const type = item.dataset.type;
      const id = item.dataset.id;

      if (type === "group") {
        this.selectedGroupId = id;
        const grp = store.getGroup(id);
        if (grp) this.selectedParticipants = [...grp.members];
      } else {
        if (!this.selectedParticipants.includes(id)) {
          this.selectedParticipants.push(id);
        }
      }
      this.renderForm();
    });

    // Remove chip
    container.addEventListener("click", e => {
      const removeBtn = e.target.closest('[data-action="remove-chip"]');
      if (removeBtn) {
        const id = removeBtn.dataset.userId;
        this.selectedParticipants = this.selectedParticipants.filter(pId => pId !== id);
        this.renderForm();
      }
    });
  },

  renderSplitTabContent() {
    const container = this.modalEl.querySelector("#split-tab-content");
    const amount = Number(this.modalEl.querySelector("#expense-amount-input").value) || 0;

    if (this.selectedSplitType === "equal") {
      const splitAmount = this.selectedParticipants.length > 0 ? (amount / this.selectedParticipants.length).toFixed(2) : "0.00";
      container.innerHTML = `
        <div style="font-size:12px; color:var(--color-text-secondary); margin-bottom:8px;">
          ${UI.formatCurrency(splitAmount)} / person (${this.selectedParticipants.length} people)
        </div>
        <div class="split-options-list">
          ${this.selectedParticipants.map(id => {
            const u = store.getUser(id);
            return `
              <div class="split-member-row">
                <div class="split-member-info">
                  <input type="checkbox" checked disabled />
                  <span>${u.name}</span>
                </div>
                <strong>${UI.formatCurrency(splitAmount)}</strong>
              </div>
            `;
          }).join("")}
        </div>
      `;
    } else if (this.selectedSplitType === "exact") {
      container.innerHTML = `
        <div style="font-size:12px; color:var(--color-text-secondary); margin-bottom:8px;">
          Enter exact amounts for each person. Total: <strong>${UI.formatCurrency(amount)}</strong>
        </div>
        <div class="split-options-list">
          ${this.selectedParticipants.map(id => {
            const u = store.getUser(id);
            return `
              <div class="split-member-row">
                <span class="split-member-info">${u.name}</span>
                <div class="split-input-wrapper">
                  <span>$</span>
                  <input type="number" step="0.01" class="split-exact-input" data-user-id="${u.id}" value="${(amount / this.selectedParticipants.length).toFixed(2)}" />
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    } else if (this.selectedSplitType === "percent") {
      const defPct = (100 / this.selectedParticipants.length).toFixed(1);
      container.innerHTML = `
        <div style="font-size:12px; color:var(--color-text-secondary); margin-bottom:8px;">
          Enter percentages. Must total 100%.
        </div>
        <div class="split-options-list">
          ${this.selectedParticipants.map(id => {
            const u = store.getUser(id);
            return `
              <div class="split-member-row">
                <span class="split-member-info">${u.name}</span>
                <div class="split-input-wrapper">
                  <input type="number" step="0.1" class="split-pct-input" data-user-id="${u.id}" value="${defPct}" />
                  <span>%</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    } else if (this.selectedSplitType === "shares") {
      container.innerHTML = `
        <div style="font-size:12px; color:var(--color-text-secondary); margin-bottom:8px;">
          Assign shares (e.g. 1 share, 2 shares for a couple).
        </div>
        <div class="split-options-list">
          ${this.selectedParticipants.map(id => {
            const u = store.getUser(id);
            return `
              <div class="split-member-row">
                <span class="split-member-info">${u.name}</span>
                <div class="split-input-wrapper">
                  <input type="number" min="1" step="1" class="split-share-input" data-user-id="${u.id}" value="1" />
                  <span>share(s)</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }
  },

  attachDomEvents() {
    this.modalEl.querySelector(".modal-close-btn").addEventListener("click", () => this.close());
    this.modalEl.querySelector("#btn-cancel-expense").addEventListener("click", () => this.close());

    // Save Expense
    this.modalEl.querySelector("#btn-save-expense").addEventListener("click", () => {
      this.handleSave();
    });
  },

  handleSave() {
    const descInput = this.modalEl.querySelector("#expense-description-input");
    const amountInput = this.modalEl.querySelector("#expense-amount-input");
    const dateInput = this.modalEl.querySelector("#expense-date-input");
    const notesInput = this.modalEl.querySelector("#expense-notes-input");

    const description = descInput.value.trim();
    const amount = Number(amountInput.value);

    if (!description) {
      alert("Please enter an expense description.");
      descInput.focus();
      return;
    }

    if (!amount || amount <= 0) {
      alert("Please enter a valid amount greater than 0.");
      amountInput.focus();
      return;
    }

    if (this.selectedParticipants.length === 0) {
      alert("Please select at least one person to split with.");
      return;
    }

    // Compute splits array
    let splits = [];
    if (this.selectedSplitType === "equal") {
      const perPerson = Number((amount / this.selectedParticipants.length).toFixed(2));
      let remainder = Number((amount - (perPerson * this.selectedParticipants.length)).toFixed(2));

      splits = this.selectedParticipants.map((pId, idx) => {
        let finalAmt = perPerson;
        if (idx === 0) finalAmt += remainder;
        return { userId: pId, amount: Number(finalAmt.toFixed(2)) };
      });
    } else if (this.selectedSplitType === "exact") {
      const inputs = this.modalEl.querySelectorAll(".split-exact-input");
      let sum = 0;
      inputs.forEach(inp => {
        const amt = Number(inp.value) || 0;
        sum += amt;
        splits.push({ userId: inp.dataset.userId, amount: amt });
      });
      if (Math.abs(sum - amount) > 0.05) {
        alert(`The exact amounts ($${sum.toFixed(2)}) do not match the total expense amount ($${amount.toFixed(2)}).`);
        return;
      }
    } else if (this.selectedSplitType === "percent") {
      const inputs = this.modalEl.querySelectorAll(".split-pct-input");
      let totalPct = 0;
      inputs.forEach(inp => {
        const pct = Number(inp.value) || 0;
        totalPct += pct;
        const amt = Number(((pct / 100) * amount).toFixed(2));
        splits.push({ userId: inp.dataset.userId, amount: amt });
      });
      if (Math.abs(totalPct - 100) > 1) {
        alert(`Percentages must add up to 100% (currently ${totalPct}%).`);
        return;
      }
    } else if (this.selectedSplitType === "shares") {
      const inputs = this.modalEl.querySelectorAll(".split-share-input");
      let totalShares = 0;
      const shareMap = [];
      inputs.forEach(inp => {
        const shares = Number(inp.value) || 1;
        totalShares += shares;
        shareMap.push({ userId: inp.dataset.userId, shares });
      });
      splits = shareMap.map(item => ({
        userId: item.userId,
        amount: Number(((item.shares / totalShares) * amount).toFixed(2))
      }));
    }

    const payload = {
      description,
      amount,
      category: this.selectedCategory,
      date: dateInput.value,
      groupId: this.selectedGroupId,
      payerId: this.selectedPayerId,
      splitType: this.selectedSplitType,
      splits,
      notes: notesInput.value.trim()
    };

    if (this.activeExpense) {
      store.updateExpense(this.activeExpense.id, payload);
      UI.showToast("Expense updated successfully!");
    } else {
      store.addExpense(payload);
      UI.showToast("Expense added successfully!");
    }

    this.close();
  }
};

window.AddExpenseModal = AddExpenseModal;
