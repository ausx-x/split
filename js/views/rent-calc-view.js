/* ==========================================================================
   Splitwise Fairness Rent Calculator View
   ========================================================================== */

const RentCalcView = {
  render(container, state) {
    container.innerHTML = `
      <div class="content-header">
        <div class="header-title-area">
          <h1 class="header-title">Splitwise Rent Calculator</h1>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" id="btn-calc-back-dashboard">Back to Dashboard</button>
        </div>
      </div>

      <div class="content-body">
        <div class="calculator-container">
          <div class="calculator-hero">
            <h2>Split Rent Fairly Without Fighting</h2>
            <p>Weight each room by square footage, private bathroom, closet space, and sunlight to calculate fair monthly splits.</p>
          </div>

          <div style="margin-bottom: 20px; max-width: 320px;">
            <label class="field-label">TOTAL MONTHLY APARTMENT RENT ($)</label>
            <input type="number" id="calc-total-rent" class="expense-field-input" value="2800" style="font-size:18px; font-weight:700;" />
          </div>

          <div class="calc-grid">
            <!-- Room 1 -->
            <div class="calc-room-card">
              <div class="calc-room-title">
                <span>Room 1 (Master Bedroom)</span>
                <span id="room-1-share" class="positive-amount">$0</span>
              </div>
              <div>
                <label class="field-label">Room Size (Sq Ft)</label>
                <input type="number" id="room-1-sqft" class="expense-field-input" value="220" />
              </div>
              <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                <input type="checkbox" id="room-1-bath" checked />
                <span>Private Bathroom (+15% value)</span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                <input type="checkbox" id="room-1-window" checked />
                <span>Large Window / High Sunlight (+5% value)</span>
              </label>
            </div>

            <!-- Room 2 -->
            <div class="calc-room-card">
              <div class="calc-room-title">
                <span>Room 2 (Guest Bedroom)</span>
                <span id="room-2-share" class="positive-amount">$0</span>
              </div>
              <div>
                <label class="field-label">Room Size (Sq Ft)</label>
                <input type="number" id="room-2-sqft" class="expense-field-input" value="160" />
              </div>
              <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                <input type="checkbox" id="room-2-bath" />
                <span>Private Bathroom (+15% value)</span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                <input type="checkbox" id="room-2-window" checked />
                <span>Large Window / High Sunlight (+5% value)</span>
              </label>
            </div>

            <!-- Room 3 -->
            <div class="calc-room-card">
              <div class="calc-room-title">
                <span>Room 3 (Standard Bedroom)</span>
                <span id="room-3-share" class="positive-amount">$0</span>
              </div>
              <div>
                <label class="field-label">Room Size (Sq Ft)</label>
                <input type="number" id="room-3-sqft" class="expense-field-input" value="140" />
              </div>
              <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                <input type="checkbox" id="room-3-bath" />
                <span>Private Bathroom (+15% value)</span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                <input type="checkbox" id="room-3-window" />
                <span>Large Window / High Sunlight (+5% value)</span>
              </label>
            </div>
          </div>

          <div class="calc-results-box">
            <div class="calc-results-title">Calculated Proportional Split</div>
            <div class="calc-split-row">
              <span>Room 1 Share:</span>
              <strong id="summary-room-1">$0.00 (0%)</strong>
            </div>
            <div class="calc-split-row">
              <span>Room 2 Share:</span>
              <strong id="summary-room-2">$0.00 (0%)</strong>
            </div>
            <div class="calc-split-row">
              <span>Room 3 Share:</span>
              <strong id="summary-room-3">$0.00 (0%)</strong>
            </div>
            <div style="margin-top: 14px;">
              <button class="btn btn-teal" id="btn-apply-rent-expense">
                Save as Rent Expense in Apartment 4B
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachCalculatorLogic(container, state);
  },

  attachCalculatorLogic(container, state) {
    const totalInput = container.querySelector("#calc-total-rent");
    const r1Sqft = container.querySelector("#room-1-sqft");
    const r1Bath = container.querySelector("#room-1-bath");
    const r1Win = container.querySelector("#room-1-window");

    const r2Sqft = container.querySelector("#room-2-sqft");
    const r2Bath = container.querySelector("#room-2-bath");
    const r2Win = container.querySelector("#room-2-window");

    const r3Sqft = container.querySelector("#room-3-sqft");
    const r3Bath = container.querySelector("#room-3-bath");
    const r3Win = container.querySelector("#room-3-window");

    let lastCalculated = null;

    const calculate = () => {
      const totalRent = Number(totalInput.value) || 0;

      const score1 = (Number(r1Sqft.value) || 100) * (1 + (r1Bath.checked ? 0.20 : 0) + (r1Win.checked ? 0.08 : 0));
      const score2 = (Number(r2Sqft.value) || 100) * (1 + (r2Bath.checked ? 0.20 : 0) + (r2Win.checked ? 0.08 : 0));
      const score3 = (Number(r3Sqft.value) || 100) * (1 + (r3Bath.checked ? 0.20 : 0) + (r3Win.checked ? 0.08 : 0));

      const totalScore = score1 + score2 + score3;
      if (totalScore <= 0) return;

      const share1 = (score1 / totalScore) * totalRent;
      const share2 = (score2 / totalScore) * totalRent;
      const share3 = (score3 / totalScore) * totalRent;

      lastCalculated = { totalRent, share1, share2, share3 };

      container.querySelector("#room-1-share").textContent = UI.formatCurrency(share1);
      container.querySelector("#room-2-share").textContent = UI.formatCurrency(share2);
      container.querySelector("#room-3-share").textContent = UI.formatCurrency(share3);

      container.querySelector("#summary-room-1").textContent = `${UI.formatCurrency(share1)} (${((share1 / totalRent) * 100).toFixed(1)}%)`;
      container.querySelector("#summary-room-2").textContent = `${UI.formatCurrency(share2)} (${((share2 / totalRent) * 100).toFixed(1)}%)`;
      container.querySelector("#summary-room-3").textContent = `${UI.formatCurrency(share3)} (${((share3 / totalRent) * 100).toFixed(1)}%)`;
    };

    [totalInput, r1Sqft, r1Bath, r1Win, r2Sqft, r2Bath, r2Win, r3Sqft, r3Bath, r3Win].forEach(el => {
      el.addEventListener("input", calculate);
      el.addEventListener("change", calculate);
    });

    calculate();

    // Back to dashboard
    container.querySelector("#btn-calc-back-dashboard").addEventListener("click", () => {
      window.SplitwiseApp.navigateTo("dashboard");
    });

    // Save as rent expense
    container.querySelector("#btn-apply-rent-expense").addEventListener("click", () => {
      if (!lastCalculated) return;
      const aptGroup = state.getGroup("group-1");
      const currentUserId = state.getCurrentUser().id;

      state.addExpense({
        description: "Monthly Apartment Rent (Fairness Split)",
        category: "rent",
        amount: lastCalculated.totalRent,
        groupId: "group-1",
        payerId: currentUserId,
        splitType: "exact",
        splits: [
          { userId: "user-1", amount: Number(lastCalculated.share1.toFixed(2)) },
          { userId: "user-2", amount: Number(lastCalculated.share2.toFixed(2)) },
          { userId: "user-3", amount: Number(lastCalculated.share3.toFixed(2)) }
        ],
        notes: "Generated via Splitwise Fairness Rent Calculator"
      });

      UI.showToast("Monthly rent split logged to Apartment 4B!");
      window.SplitwiseApp.navigateTo("group", "group-1");
    });
  }
};
