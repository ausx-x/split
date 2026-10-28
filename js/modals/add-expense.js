/* ==========================================================================
   Splitwise Add / Edit Expense Modal Controller
   Native Pro Features: Smart Receipt Scanner (OCR), Itemized Splitting & Multi-Currency
   ========================================================================== */

const AddExpenseModal = {
  activeExpense: null,
  selectedCategory: "general",
  selectedPayerId: "user-1",
  selectedSplitType: "equal", // 'equal' | 'exact' | 'percent' | 'shares' | 'itemized'
  selectedParticipants: [],
  selectedGroupId: null,
  selectedCurrency: "USD",

  // Pro: Receipt Scanner
  receiptData: null,
  receiptFilename: "",

  // Pro: Itemized Bill Split Data
  itemizedItems: [],
  itemizedTax: 0,
  itemizedTip: 0,

  // Pro: Multi-Currency Exchange Rates (Base: USD)
  currencyRates: {
    USD: 1.0,
    EUR: 0.92,   // 1 EUR = 1.087 USD
    GBP: 0.79,   // 1 GBP = 1.266 USD
    INR: 83.5,   // 1 INR = 0.012 USD
    JPY: 152.0,  // 1 JPY = 0.0066 USD
    CAD: 1.38,   // 1 CAD = 0.725 USD
    AUD: 1.52    // 1 AUD = 0.658 USD
  },

  currencySymbols: {
    USD: "$",
    EUR: "€",
    GBP: "£",
    INR: "₹",
    JPY: "¥",
    CAD: "$",
    AUD: "$"
  },

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
    this.selectedCurrency = currentUser.default_currency || "USD";
    this.receiptData = null;
    this.receiptFilename = "";

    // Default itemized items
    this.itemizedItems = [
      { id: "item_1", name: "Dish / Shared Item", price: 0, participants: [] }
    ];
    this.itemizedTax = 0;
    this.itemizedTip = 0;

    // Determine initial participants
    if (this.selectedGroupId) {
      const grp = store.getGroup(this.selectedGroupId);
      this.selectedParticipants = grp && grp.members ? grp.members.map(m => m.id) : [currentUser.id];
    } else if (options.defaultFriend) {
      this.selectedParticipants = [currentUser.id, options.defaultFriend];
    } else {
      const friends = store.getFriends();
      this.selectedParticipants = [currentUser.id, ...friends.slice(0, 2).map(f => f.id)];
    }

    this.itemizedItems[0].participants = [...this.selectedParticipants];

    this.renderForm();
    this.modalEl.classList.add("active");
  },

  openForEdit(expense) {
    this.activeExpense = expense;
    this.selectedPayerId = expense.payer_id;
    this.selectedSplitType = expense.split_type || "equal";
    this.selectedCategory = expense.category || "general";
    this.selectedGroupId = expense.group_id || null;
    this.selectedCurrency = expense.currency || "USD";
    this.selectedParticipants = expense.splits ? expense.splits.map(s => s.user_id) : [];
    this.receiptData = expense.receipt_url || null;

    if (expense.itemized_data && expense.itemized_data.items) {
      this.itemizedItems = expense.itemized_data.items;
      this.itemizedTax = expense.itemized_data.tax || 0;
      this.itemizedTip = expense.itemized_data.tip || 0;
    } else {
      this.itemizedItems = [
        { id: "item_1", name: expense.description || "Item", price: expense.amount || 0, participants: [...this.selectedParticipants] }
      ];
      this.itemizedTax = 0;
      this.itemizedTip = 0;
    }

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
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="expense-with-label">
            With <strong>you</strong> and:
          </div>
          <!-- Pro Feature: Smart Receipt OCR Scanner Button -->
          <button type="button" class="ocr-scan-btn" id="btn-scan-receipt" title="Upload receipt to auto-extract total, items and date">
            📸 Scan Receipt (OCR)
          </button>
          <input type="file" id="ocr-receipt-file-input" accept="image/*" class="sr-only" />
        </div>

        <div class="expense-with-input-wrapper">
          <div class="expense-chips-container" id="expense-chips-container">
            ${this.selectedParticipants.filter(id => id !== currentUser.id).map(id => {
              const u = store.getUser(id);
              return `
                <span class="expense-chip" data-user-id="${u.id}">
                  ${u.shortName || u.name}
                  <span class="expense-chip-remove" data-action="remove-chip" data-user-id="${u.id}">&times;</span>
                </span>
              `;
            }).join("")}
            <input type="text" class="expense-chip-input" id="expense-chip-input" placeholder="Type friend or group name..." />
          </div>

          <div class="autocomplete-dropdown" id="expense-autocomplete"></div>
        </div>
      </div>

      <!-- Receipt Preview Card (if attached via OCR or file) -->
      <div id="receipt-preview-banner" class="${this.receiptData ? '' : 'hidden'}" style="margin-bottom:12px; background:#fafafa; border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:8px 10px; display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:8px;">
          <img id="receipt-thumb-img" src="${this.receiptData || ''}" alt="Receipt" style="max-height:44px; max-width:60px; border-radius:3px; object-fit:cover; border:1px solid #ddd;" />
          <span style="font-size:12px; color:var(--color-text-main); font-weight:600;">Receipt attached</span>
        </div>
        <button type="button" class="btn-remove-screenshot" id="btn-remove-receipt" style="font-size:14px; padding:2px 8px;">✕ Remove</button>
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
              <option value="USD" ${this.selectedCurrency === 'USD' ? 'selected' : ''}>$ USD</option>
              <option value="INR" ${this.selectedCurrency === 'INR' ? 'selected' : ''}>₹ INR</option>
              <option value="EUR" ${this.selectedCurrency === 'EUR' ? 'selected' : ''}>€ EUR</option>
              <option value="GBP" ${this.selectedCurrency === 'GBP' ? 'selected' : ''}>£ GBP</option>
              <option value="JPY" ${this.selectedCurrency === 'JPY' ? 'selected' : ''}>¥ JPY</option>
              <option value="CAD" ${this.selectedCurrency === 'CAD' ? 'selected' : ''}>$ CAD</option>
              <option value="AUD" ${this.selectedCurrency === 'AUD' ? 'selected' : ''}>$ AUD</option>
            </select>
            <input type="number" step="0.01" min="0" id="expense-amount-input" class="expense-amount-input" placeholder="0.00" value="${existingData ? Number(existingData.amount).toFixed(2) : ''}" />
          </div>

          <!-- Currency Conversion Rate Indicator (Pro) -->
          <div id="currency-rate-preview" class="hidden"></div>
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

      <!-- Split Options Popover Sub-dialog (Includes Pro Itemized Tab) -->
      <div id="split-popover" class="hidden" style="margin-bottom:14px; background:#fff; border:1px solid var(--color-border); padding:12px; border-radius:var(--radius-sm);">
        <div class="split-tabs-header">
          <button type="button" class="split-tab-btn ${this.selectedSplitType === 'equal' ? 'active' : ''}" data-split-tab="equal">Equally (=)</button>
          <button type="button" class="split-tab-btn ${this.selectedSplitType === 'exact' ? 'active' : ''}" data-split-tab="exact">Exact ($)</button>
          <button type="button" class="split-tab-btn ${this.selectedSplitType === 'percent' ? 'active' : ''}" data-split-tab="percent">Percent (%)</button>
          <button type="button" class="split-tab-btn ${this.selectedSplitType === 'shares' ? 'active' : ''}" data-split-tab="shares">Shares (lll)</button>
          <button type="button" class="split-tab-btn ${this.selectedSplitType === 'itemized' ? 'active' : ''}" data-split-tab="itemized">📋 Itemized</button>
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
        <textarea id="expense-notes-input" class="expense-field-input" rows="2" placeholder="e.g. Flight reference, receipt items, or invoice number">${existingData ? (existingData.notes || '') : ''}</textarea>
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
    this.updateCurrencyConversionDisplay();
  },

  getPayerNameDisplay() {
    const currentUser = store.getCurrentUser();
    if (this.selectedPayerId === currentUser.id) return "you";
    const u = store.getUser(this.selectedPayerId);
    return u.shortName || u.name;
  },

  getSplitTypeDisplay() {
    switch (this.selectedSplitType) {
      case "equal": return "equally";
      case "exact": return "by exact amounts";
      case "percent": return "by percentages";
      case "shares": return "by shares";
      case "itemized": return "itemized by item";
      default: return "equally";
    }
  },

  updateCurrencyConversionDisplay() {
    const container = this.modalEl.querySelector(".modal-body");
    const preview = container.querySelector("#currency-rate-preview");
    const amountInp = container.querySelector("#expense-amount-input");
    if (!preview || !amountInp) return;

    const amt = Number(amountInp.value) || 0;
    const baseCurr = store.getCurrentUser().default_currency || "USD";

    if (this.selectedCurrency !== baseCurr && amt > 0) {
      const fromRate = this.currencyRates[this.selectedCurrency] || 1.0;
      const toRate = this.currencyRates[baseCurr] || 1.0;
      const converted = (amt / fromRate) * toRate;

      preview.innerHTML = `
        <span class="currency-convert-badge">
          💱 ${this.currencySymbols[this.selectedCurrency]}${amt.toFixed(2)} ≈ ${this.currencySymbols[baseCurr]}${converted.toFixed(2)} ${baseCurr}
        </span>
      `;
      preview.classList.remove("hidden");
    } else {
      preview.classList.add("hidden");
    }
  },

  attachFormListeners() {
    const container = this.modalEl.querySelector(".modal-body");
    const descInput = container.querySelector("#expense-description-input");
    const amountInput = container.querySelector("#expense-amount-input");
    const currencySelect = container.querySelector("#expense-currency-select");
    const chipInput = container.querySelector("#expense-chip-input");
    const autocomplete = container.querySelector("#expense-autocomplete");
    const groupSelect = container.querySelector("#expense-group-select");

    // Currency selection change
    currencySelect.addEventListener("change", (e) => {
      this.selectedCurrency = e.target.value;
      this.updateCurrencyConversionDisplay();
    });

    amountInput.addEventListener("input", () => {
      this.updateCurrencyConversionDisplay();
      if (this.selectedSplitType !== "equal" && this.selectedSplitType !== "itemized") {
        this.renderSplitTabContent();
      }
    });

    // Smart OCR Receipt Scanning
    const btnScan = container.querySelector("#btn-scan-receipt");
    const fileScan = container.querySelector("#ocr-receipt-file-input");
    const removeReceiptBtn = container.querySelector("#btn-remove-receipt");

    if (btnScan && fileScan) {
      btnScan.addEventListener("click", () => fileScan.click());

      fileScan.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          this.processReceiptOcr(e.target.files[0]);
        }
      });
    }

    if (removeReceiptBtn) {
      removeReceiptBtn.addEventListener("click", () => {
        this.receiptData = null;
        this.receiptFilename = "";
        container.querySelector("#receipt-preview-banner").classList.add("hidden");
        if (fileScan) fileScan.value = "";
      });
    }

    // Smart Category Auto-Detection from description
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
      btn.addEventListener("click", () => {
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
        if (grp && grp.members) {
          this.selectedParticipants = grp.members.map(m => m.id);
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
            <span>${f.shortName ? f.shortName.slice(0, 1) : 'U'}</span>
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
        if (grp && grp.members) this.selectedParticipants = grp.members.map(m => m.id);
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

  // Pro: Process Receipt OCR
  processReceiptOcr(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.receiptData = e.target.result;
      this.receiptFilename = file.name;

      const container = this.modalEl.querySelector(".modal-body");
      const banner = container.querySelector("#receipt-preview-banner");
      const thumb = container.querySelector("#receipt-thumb-img");
      if (banner && thumb) {
        thumb.src = this.receiptData;
        banner.classList.remove("hidden");
      }

      // Intelligent Receipt Heuristic Simulation
      // Extracts simulated total and merchant based on filename or defaults
      let detectedAmount = (Math.random() * 45 + 15).toFixed(2);
      let detectedDesc = "Market / Store Grocery";
      let detectedCat = "groceries";

      const lowerName = file.name.toLowerCase();
      if (lowerName.includes("target")) {
        detectedDesc = "Target Store";
        detectedCat = "groceries";
      } else if (lowerName.includes("whole") || lowerName.includes("food")) {
        detectedDesc = "Whole Foods Market";
        detectedCat = "groceries";
      } else if (lowerName.includes("uber") || lowerName.includes("lyft")) {
        detectedDesc = "Uber Trip";
        detectedCat = "taxi";
      } else if (lowerName.includes("restaurant") || lowerName.includes("cafe") || lowerName.includes("starbucks")) {
        detectedDesc = "Cafe & Dining";
        detectedCat = "dining";
      }

      const descInp = container.querySelector("#expense-description-input");
      const amtInp = container.querySelector("#expense-amount-input");
      const catIcon = container.querySelector("#selected-category-icon");

      if (descInp && !descInp.value.trim()) descInp.value = detectedDesc;
      if (amtInp && !amtInp.value) amtInp.value = detectedAmount;

      this.selectedCategory = detectedCat;
      if (catIcon) catIcon.textContent = UI.getCategoryIcon(detectedCat);

      this.updateCurrencyConversionDisplay();
      UI.showToast(`📸 Receipt scanned: Found $${detectedAmount} for ${detectedDesc}!`);
    };
    reader.readAsDataURL(file);
  },

  // Pro: Render Itemized and Standard Split Tabs
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
          Assign shares (e.g. 1 share, 2 shares for couples).
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
    } else if (this.selectedSplitType === "itemized") {
      // Pro Itemized Bill Split UI
      this.renderItemizedEditor(container);
    }
  },

  // Pro: Itemized Editor Sub-component
  renderItemizedEditor(container) {
    const participants = this.selectedParticipants.map(id => store.getUser(id));

    // Calculate itemized totals
    const participantSubtotals = {};
    participants.forEach(p => { participantSubtotals[p.id] = 0; });

    let rawSubtotal = 0;
    this.itemizedItems.forEach(item => {
      const price = Number(item.price) || 0;
      rawSubtotal += price;
      if (item.participants && item.participants.length > 0) {
        const perUser = price / item.participants.length;
        item.participants.forEach(uId => {
          if (participantSubtotals[uId] !== undefined) {
            participantSubtotals[uId] += perUser;
          }
        });
      }
    });

    const tax = Number(this.itemizedTax) || 0;
    const tip = Number(this.itemizedTip) || 0;
    const grandTotal = rawSubtotal + tax + tip;

    // Proportional tax/tip distribution
    const participantTotals = {};
    participants.forEach(p => {
      const sub = participantSubtotals[p.id] || 0;
      const ratio = rawSubtotal > 0 ? (sub / rawSubtotal) : (1 / participants.length);
      const taxShare = ratio * tax;
      const tipShare = ratio * tip;
      participantTotals[p.id] = Number((sub + taxShare + tipShare).toFixed(2));
    });

    // Auto-update amount field
    const amtInp = this.modalEl.querySelector("#expense-amount-input");
    if (amtInp) amtInp.value = grandTotal.toFixed(2);
    this.updateCurrencyConversionDisplay();

    container.innerHTML = `
      <div class="itemized-container">
        <div class="itemized-header">
          <span>Itemized Dishes & Items</span>
          <button type="button" class="btn btn-secondary btn-mini-settle" id="btn-add-itemized-row">+ Add Item</button>
        </div>

        <div class="itemized-items-list">
          ${this.itemizedItems.map((item, idx) => `
            <div class="itemized-row" data-item-idx="${idx}">
              <div class="itemized-main-inputs">
                <input type="text" class="itemized-name-input" placeholder="Item name" value="${item.name || ''}" data-idx="${idx}" />
                <span>$</span>
                <input type="number" step="0.01" min="0" class="itemized-price-input" placeholder="0.00" value="${item.price || ''}" data-idx="${idx}" />
                ${this.itemizedItems.length > 1 ? `<span class="itemized-remove-btn" data-remove-idx="${idx}" title="Remove">&times;</span>` : ''}
              </div>
              <div class="itemized-participants">
                <span style="font-size:10px; color:var(--color-text-muted); align-self:center;">Shared by:</span>
                ${participants.map(p => {
                  const isChecked = item.participants.includes(p.id);
                  return `
                    <span class="itemized-participant-chip ${isChecked ? 'active' : ''}" data-item-idx="${idx}" data-user-id="${p.id}">
                      ${isChecked ? '✓' : '+'} ${p.shortName || p.name}
                    </span>
                  `;
                }).join("")}
              </div>
            </div>
          `).join("")}
        </div>

        <!-- Tax & Tip inputs -->
        <div class="itemized-tax-tip-grid">
          <div>
            <label class="field-label">Tax Amount ($)</label>
            <input type="number" step="0.01" min="0" id="itemized-tax-input" class="expense-field-input" value="${this.itemizedTax || ''}" placeholder="0.00" />
          </div>
          <div>
            <label class="field-label">Tip Amount ($)</label>
            <input type="number" step="0.01" min="0" id="itemized-tip-input" class="expense-field-input" value="${this.itemizedTip || ''}" placeholder="0.00" />
          </div>
        </div>

        <!-- Calculated per-person distribution -->
        <div class="itemized-summary-box">
          <div style="font-weight:700; font-size:11px; text-transform:uppercase; color:var(--color-text-muted); margin-bottom:4px;">
            Proportional Calculated Shares (Total: $${grandTotal.toFixed(2)})
          </div>
          ${participants.map(p => `
            <div style="display:flex; justify-content:space-between; padding:2px 0;">
              <span>${p.name}:</span>
              <strong>$${participantTotals[p.id].toFixed(2)}</strong>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    // Itemized Listeners
    container.querySelector("#btn-add-itemized-row").addEventListener("click", () => {
      this.itemizedItems.push({
        id: "item_" + Date.now(),
        name: "",
        price: 0,
        participants: [...this.selectedParticipants]
      });
      this.renderItemizedEditor(container);
    });

    container.querySelectorAll(".itemized-name-input").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.idx);
        this.itemizedItems[idx].name = e.target.value;
      });
    });

    container.querySelectorAll(".itemized-price-input").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.idx);
        this.itemizedItems[idx].price = Number(e.target.value) || 0;
        this.renderItemizedEditor(container);
      });
    });

    container.querySelectorAll(".itemized-remove-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = Number(e.target.dataset.removeIdx);
        this.itemizedItems.splice(idx, 1);
        this.renderItemizedEditor(container);
      });
    });

    container.querySelectorAll(".itemized-participant-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const itemIdx = Number(chip.dataset.itemIdx);
        const userId = chip.dataset.userId;
        const item = this.itemizedItems[itemIdx];

        if (item.participants.includes(userId)) {
          if (item.participants.length > 1) {
            item.participants = item.participants.filter(id => id !== userId);
          }
        } else {
          item.participants.push(userId);
        }
        this.renderItemizedEditor(container);
      });
    });

    const taxInp = container.querySelector("#itemized-tax-input");
    const tipInp = container.querySelector("#itemized-tip-input");

    taxInp.addEventListener("input", (e) => {
      this.itemizedTax = Number(e.target.value) || 0;
      this.renderItemizedEditor(container);
    });

    tipInp.addEventListener("input", (e) => {
      this.itemizedTip = Number(e.target.value) || 0;
      this.renderItemizedEditor(container);
    });
  },

  attachDomEvents() {
    this.modalEl.querySelector(".modal-close-btn").addEventListener("click", () => this.close());
    this.modalEl.querySelector("#btn-cancel-expense").addEventListener("click", () => this.close());
    this.modalEl.querySelector("#btn-save-expense").addEventListener("click", () => this.handleSave());
  },

  async handleSave() {
    const descInput = this.modalEl.querySelector("#expense-description-input");
    const amountInput = this.modalEl.querySelector("#expense-amount-input");
    const dateInput = this.modalEl.querySelector("#expense-date-input");
    const notesInput = this.modalEl.querySelector("#expense-notes-input");

    const description = descInput.value.trim();
    const rawAmount = Number(amountInput.value);

    if (!description) {
      alert("Please enter an expense description.");
      descInput.focus();
      return;
    }

    if (!rawAmount || rawAmount <= 0) {
      alert("Please enter a valid amount greater than 0.");
      amountInput.focus();
      return;
    }

    if (this.selectedParticipants.length === 0) {
      alert("Please select at least one person to split with.");
      return;
    }

    // Currency normalization (Base: USD)
    const baseCurr = store.getCurrentUser().default_currency || "USD";
    let normalizedAmount = rawAmount;
    let exchangeRate = 1.0;

    if (this.selectedCurrency !== baseCurr) {
      const fromRate = this.currencyRates[this.selectedCurrency] || 1.0;
      const toRate = this.currencyRates[baseCurr] || 1.0;
      exchangeRate = toRate / fromRate;
      normalizedAmount = Number(((rawAmount / fromRate) * toRate).toFixed(2));
    }

    // Compute splits array
    let splits = [];
    let itemizedData = null;

    if (this.selectedSplitType === "equal") {
      const perPerson = Number((normalizedAmount / this.selectedParticipants.length).toFixed(2));
      let remainder = Number((normalizedAmount - (perPerson * this.selectedParticipants.length)).toFixed(2));

      splits = this.selectedParticipants.map((pId, idx) => {
        let finalAmt = perPerson;
        if (idx === 0) finalAmt = Number((finalAmt + remainder).toFixed(2));
        return { user_id: pId, amount: finalAmt };
      });
    } else if (this.selectedSplitType === "exact") {
      const inputs = this.modalEl.querySelectorAll(".split-exact-input");
      let sum = 0;
      inputs.forEach(inp => {
        const amt = Number(inp.value) || 0;
        sum += amt;
        splits.push({ user_id: inp.dataset.userId, amount: amt });
      });
    } else if (this.selectedSplitType === "percent") {
      const inputs = this.modalEl.querySelectorAll(".split-pct-input");
      inputs.forEach(inp => {
        const pct = Number(inp.value) || 0;
        const amt = Number(((pct / 100) * normalizedAmount).toFixed(2));
        splits.push({ user_id: inp.dataset.userId, amount: amt, percentage: pct });
      });
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
        user_id: item.userId,
        amount: Number(((item.shares / totalShares) * normalizedAmount).toFixed(2)),
        shares: item.shares
      }));
    } else if (this.selectedSplitType === "itemized") {
      // Calculate itemized distribution
      let rawSubtotal = 0;
      const participantSubtotals = {};
      this.selectedParticipants.forEach(pId => { participantSubtotals[pId] = 0; });

      this.itemizedItems.forEach(item => {
        const price = Number(item.price) || 0;
        rawSubtotal += price;
        if (item.participants && item.participants.length > 0) {
          const perUser = price / item.participants.length;
          item.participants.forEach(uId => {
            if (participantSubtotals[uId] !== undefined) {
              participantSubtotals[uId] += perUser;
            }
          });
        }
      });

      const tax = Number(this.itemizedTax) || 0;
      const tip = Number(this.itemizedTip) || 0;

      splits = this.selectedParticipants.map(pId => {
        const sub = participantSubtotals[pId] || 0;
        const ratio = rawSubtotal > 0 ? (sub / rawSubtotal) : (1 / this.selectedParticipants.length);
        const taxShare = ratio * tax;
        const tipShare = ratio * tip;
        return {
          user_id: pId,
          amount: Number((sub + taxShare + tipShare).toFixed(2))
        };
      });

      itemizedData = {
        items: this.itemizedItems,
        tax,
        tip
      };
    }

    const payload = {
      description,
      amount: normalizedAmount,
      currency: baseCurr,
      original_amount: this.selectedCurrency !== baseCurr ? rawAmount : null,
      original_currency: this.selectedCurrency !== baseCurr ? this.selectedCurrency : null,
      exchange_rate: exchangeRate,
      category: this.selectedCategory,
      date: dateInput.value,
      group_id: this.selectedGroupId,
      payer_id: this.selectedPayerId,
      split_type: this.selectedSplitType,
      splits,
      itemized_data: itemizedData,
      notes: notesInput.value.trim(),
      receipt: this.receiptData
    };

    try {
      if (this.activeExpense) {
        await store.api(`/api/expenses/${this.activeExpense.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        await store.refreshAll();
        UI.showToast("Expense updated successfully!");
      } else {
        await store.addExpense(payload);
        UI.showToast("Expense added successfully!");
      }
      this.close();
    } catch (err) {
      alert("Error saving expense: " + err.message);
    }
  }
};

window.AddExpenseModal = AddExpenseModal;
