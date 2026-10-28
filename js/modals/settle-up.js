/* ==========================================================================
   Splitwise Settle Up Modal Controller
   Supports Record Cash, UPI (with screenshot upload), and Card Payment
   ========================================================================== */

const SettleUpModal = {
  payerId: "user-1",
  recipientId: "user-2",
  amount: 0,
  method: "cash", // 'cash' | 'upi' | 'card'
  groupId: null,

  // UPI specific state
  upiId: "",
  utr: "",
  screenshotData: null,
  screenshotFilename: "",

  // Card specific state
  cardNumber: "",
  cardExp: "",
  cardCvv: "",
  cardName: "",

  init() {
    this.modalEl = document.getElementById("settle-up-modal");
    if (!this.modalEl) return;
    this.attachDomEvents();
  },

  open(options = {}) {
    const currentUser = store.getCurrentUser();
    const friends = store.getFriends();

    this.groupId = options.groupId || null;
    this.method = "cash";
    this.screenshotData = null;
    this.screenshotFilename = "";
    this.upiId = "";
    this.utr = "";
    this.cardNumber = "";
    this.cardExp = "";
    this.cardCvv = "";
    this.cardName = "";

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

  syncCurrentInputs() {
    const container = this.modalEl.querySelector(".modal-body");
    if (!container) return;

    const amtInp = container.querySelector("#settle-amount-input");
    if (amtInp) this.amount = Number(amtInp.value) || 0;

    const upiInp = container.querySelector("#settle-upi-id");
    if (upiInp) this.upiId = upiInp.value.trim();

    const utrInp = container.querySelector("#settle-upi-utr");
    if (utrInp) this.utr = utrInp.value.trim();

    const cardNum = container.querySelector("#settle-card-number");
    if (cardNum) this.cardNumber = cardNum.value.trim();

    const cardExp = container.querySelector("#settle-card-exp");
    if (cardExp) this.cardExp = cardExp.value.trim();

    const cardCvv = container.querySelector("#settle-card-cvv");
    if (cardCvv) this.cardCvv = cardCvv.value.trim();

    const cardName = container.querySelector("#settle-card-name");
    if (cardName) this.cardName = cardName.value.trim();
  },

  render() {
    const container = this.modalEl.querySelector(".modal-body");
    const payer = store.getUser(this.payerId);
    const recipient = store.getUser(this.recipientId);
    const friends = store.getFriends();
    const currentUser = store.getCurrentUser();

    const recipientDefaultUpi = `${recipient.shortName.toLowerCase().replace(/[^a-z0-9]/g, '')}@upi`;

    container.innerHTML = `
      <!-- Method Tabs: Cash, UPI, Card Payment (Venmo and PayPal removed) -->
      <div class="settle-flow-tabs">
        <button type="button" class="settle-tab-btn ${this.method === 'cash' ? 'active' : ''}" data-method="cash">Record Cash</button>
        <button type="button" class="settle-tab-btn ${this.method === 'upi' ? 'active' : ''}" data-method="upi">UPI</button>
        <button type="button" class="settle-tab-btn ${this.method === 'card' ? 'active' : ''}" data-method="card">Card Payment</button>
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

      <!-- Method Specific Content Section -->
      ${this.renderMethodSpecificContent(payer, recipient, recipientDefaultUpi)}

      <div style="margin-top:14px;">
        <label class="field-label">Date</label>
        <input type="date" id="settle-date-input" class="expense-field-input" value="${new Date().toISOString().split('T')[0]}" />
      </div>
    `;

    this.attachMethodListeners(container, recipientDefaultUpi);
  },

  renderMethodSpecificContent(payer, recipient, recipientDefaultUpi) {
    if (this.method === "upi") {
      return `
        <div class="settle-method-panel">
          <div class="method-panel-title">
            <span>UPI Instant Payment</span>
            <span class="upi-badge-logo">BHIM / UPI</span>
          </div>

          <!-- Recipient's UPI ID -->
          <div>
            <label class="field-label">Recipient's UPI ID / VPA</label>
            <div class="upi-id-row">
              <div class="upi-id-input-wrap">
                <input type="text" id="settle-upi-id" class="expense-field-input" placeholder="e.g. ${recipientDefaultUpi}" value="${this.upiId || recipientDefaultUpi}" />
              </div>
              <button type="button" class="btn btn-secondary btn-mini-settle" id="btn-copy-upi" title="Copy UPI ID">Copy</button>
            </div>
            <div style="font-size:11px; color:var(--color-text-secondary); margin-top:4px;">
              ⚡ Transfer using Google Pay, PhonePe, Paytm, or BHIM.
            </div>
          </div>

          <!-- UTR / Ref Number -->
          <div>
            <label class="field-label">Transaction Reference / UTR (Optional)</label>
            <input type="text" id="settle-upi-utr" class="expense-field-input" placeholder="e.g. 429103859201" maxlength="20" value="${this.utr || ''}" />
          </div>

          <!-- Upload Screenshot Option -->
          <div>
            <label class="field-label">Payment Screenshot</label>
            <input type="file" id="settle-upi-screenshot" accept="image/*" class="sr-only" />

            <!-- Dropzone (shown when no image selected) -->
            <div class="screenshot-dropzone ${this.screenshotData ? 'hidden' : ''}" id="upi-screenshot-dropzone">
              <div class="dropzone-content">
                <span class="dropzone-icon">📸</span>
                <span class="dropzone-text">Click or drop to upload payment screenshot</span>
                <span class="dropzone-sub">PNG, JPG, JPEG, WebP</span>
              </div>
            </div>

            <!-- Preview Card (shown when image is selected) -->
            <div class="screenshot-preview-container ${this.screenshotData ? '' : 'hidden'}" id="screenshot-preview-wrap">
              <img id="screenshot-preview-img" src="${this.screenshotData || ''}" alt="Payment Screenshot" class="screenshot-preview-thumb" />
              <div class="screenshot-preview-info">
                <span class="screenshot-name" id="screenshot-filename">${this.screenshotFilename || 'screenshot.png'}</span>
                <button type="button" class="btn-remove-screenshot" id="btn-remove-screenshot" title="Remove screenshot">&times;</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (this.method === "card") {
      return `
        <div class="settle-method-panel">
          <div class="method-panel-title">
            <span>Credit / Debit Card</span>
            <span class="card-brands-icons">VISA • MC • RUPAY</span>
          </div>

          <div class="card-form-grid">
            <div>
              <label class="field-label">Card Number</label>
              <div class="card-num-row">
                <input type="text" id="settle-card-number" class="expense-field-input card-num-input" placeholder="4242 •••• •••• 4242" maxlength="19" value="${this.cardNumber || ''}" />
              </div>
            </div>

            <div class="card-split-inputs">
              <div>
                <label class="field-label">Expiry Date</label>
                <input type="text" id="settle-card-exp" class="expense-field-input" placeholder="MM/YY" maxlength="5" value="${this.cardExp || ''}" />
              </div>
              <div>
                <label class="field-label">CVV</label>
                <input type="password" id="settle-card-cvv" class="expense-field-input" placeholder="•••" maxlength="4" value="${this.cardCvv || ''}" />
              </div>
            </div>

            <div>
              <label class="field-label">Cardholder Name</label>
              <input type="text" id="settle-card-name" class="expense-field-input" placeholder="Name on card" value="${this.cardName || payer.name}" />
            </div>

            <div class="card-security-note">
              <span>🔒</span>
              <span>Simulated secure 256-bit card transaction</span>
            </div>
          </div>
        </div>
      `;
    }

    // Default: Cash
    return `
      <div class="settle-method-panel" style="background:#fafafa; border-style:dashed;">
        <div style="font-size:12px; color:var(--color-text-secondary); text-align:center;">
          💵 Record an offline cash exchange between <strong>${payer.shortName}</strong> and <strong>${recipient.shortName}</strong>.
        </div>
      </div>
    `;
  },

  attachMethodListeners(container, recipientDefaultUpi) {
    // Method tab listeners
    container.querySelectorAll(".settle-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.syncCurrentInputs();
        this.method = btn.dataset.method;
        this.render();
      });
    });

    // Payer / Recipient selectors
    container.querySelector("#settle-payer-select").addEventListener("change", e => {
      this.syncCurrentInputs();
      this.payerId = e.target.value;
      this.render();
    });

    container.querySelector("#settle-recipient-select").addEventListener("change", e => {
      this.syncCurrentInputs();
      this.recipientId = e.target.value;
      this.render();
    });

    // UPI Listeners
    if (this.method === "upi") {
      const copyBtn = container.querySelector("#btn-copy-upi");
      const upiInput = container.querySelector("#settle-upi-id");
      if (copyBtn && upiInput) {
        copyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(upiInput.value.trim() || recipientDefaultUpi).then(() => {
            UI.showToast("UPI ID copied to clipboard!");
          }).catch(() => {
            UI.showToast("UPI ID: " + upiInput.value.trim());
          });
        });
      }

      // Screenshot File Upload Handling
      const fileInput = container.querySelector("#settle-upi-screenshot");
      const dropzone = container.querySelector("#upi-screenshot-dropzone");
      const previewWrap = container.querySelector("#screenshot-preview-wrap");
      const previewImg = container.querySelector("#screenshot-preview-img");
      const filenameEl = container.querySelector("#screenshot-filename");
      const removeBtn = container.querySelector("#btn-remove-screenshot");

      const handleFile = (file) => {
        if (!file || !file.type.startsWith("image/")) {
          alert("Please upload an image file (PNG, JPG, WebP).");
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          this.screenshotData = e.target.result;
          this.screenshotFilename = file.name;

          previewImg.src = this.screenshotData;
          filenameEl.textContent = file.name;
          dropzone.classList.add("hidden");
          previewWrap.classList.remove("hidden");
          UI.showToast("Screenshot uploaded successfully!");
        };
        reader.readAsDataURL(file);
      };

      if (dropzone && fileInput) {
        dropzone.addEventListener("click", () => fileInput.click());

        fileInput.addEventListener("change", (e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        });

        // Drag & Drop
        dropzone.addEventListener("dragover", (e) => {
          e.preventDefault();
          dropzone.classList.add("dragover");
        });

        dropzone.addEventListener("dragleave", () => {
          dropzone.classList.remove("dragover");
        });

        dropzone.addEventListener("drop", (e) => {
          e.preventDefault();
          dropzone.classList.remove("dragover");
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
          }
        });
      }

      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          this.screenshotData = null;
          this.screenshotFilename = "";
          if (fileInput) fileInput.value = "";
          previewWrap.classList.add("hidden");
          dropzone.classList.remove("hidden");
        });
      }
    }

    // Card Listeners
    if (this.method === "card") {
      const cardNumInp = container.querySelector("#settle-card-number");
      const cardExpInp = container.querySelector("#settle-card-exp");

      if (cardNumInp) {
        cardNumInp.addEventListener("input", (e) => {
          // Format 16 digits into groups of 4
          let val = e.target.value.replace(/\D/g, "").slice(0, 16);
          let formatted = val.match(/.{1,4}/g)?.join(" ") || val;
          e.target.value = formatted;
        });
      }

      if (cardExpInp) {
        cardExpInp.addEventListener("input", (e) => {
          let val = e.target.value.replace(/\D/g, "").slice(0, 4);
          if (val.length >= 3) {
            e.target.value = val.slice(0, 2) + "/" + val.slice(2);
          } else {
            e.target.value = val;
          }
        });
      }
    }
  },

  attachDomEvents() {
    this.modalEl.querySelector(".modal-close-btn").addEventListener("click", () => this.close());
    this.modalEl.querySelector("#btn-cancel-settle").addEventListener("click", () => this.close());

    this.modalEl.querySelector("#btn-save-settle").addEventListener("click", () => {
      this.syncCurrentInputs();

      const amtInput = this.modalEl.querySelector("#settle-amount-input");
      const dateInput = this.modalEl.querySelector("#settle-date-input");
      const amt = Number(amtInput ? amtInput.value : this.amount);
      const dateVal = dateInput ? dateInput.value : new Date().toISOString().split("T")[0];

      if (!amt || amt <= 0) {
        alert("Please enter a valid settlement amount.");
        if (amtInput) amtInput.focus();
        return;
      }

      if (this.payerId === this.recipientId) {
        alert("Payer and recipient cannot be the same person.");
        return;
      }

      let extraData = {
        date: dateVal,
        receipt: this.screenshotData,
        upiId: this.upiId,
        utr: this.utr
      };

      if (this.method === "card") {
        const cleanedCard = this.cardNumber.replace(/\s+/g, "");
        const last4 = cleanedCard.slice(-4) || "4242";
        extraData.cardLast4 = last4;
      }

      store.settleDebt(this.payerId, this.recipientId, amt, this.method, this.groupId, extraData);

      const methodNames = {
        cash: "Cash",
        upi: "UPI",
        card: "Card"
      };

      UI.showToast(`Recorded payment of ${UI.formatCurrency(amt)} via ${methodNames[this.method] || 'Cash'}!`);
      this.close();
    });
  }
};

window.SettleUpModal = SettleUpModal;
