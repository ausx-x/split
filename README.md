# Splitwise Web Application Clone (secure.splitwise.com)

A high-fidelity clone of the layout, design system, and interactive features of **Splitwise** ([https://secure.splitwise.com/](https://secure.splitwise.com/)). Built with vanilla HTML5, CSS3, and JavaScript with zero external runtime dependencies.

---

## 🌟 Key Features & Interactive Sections

### 1. Multi-Column Splitwise Desktop & Responsive Architecture
- **Top Navigation Bar:**
  - Signature Splitwise mint teal (`#5bc5a7`) header.
  - Splitwise 3D faceted cube logo with brand typography.
  - **Live Global Search:** Instant search across expenses, groups, and friends with keyboard navigation and interactive quick-jump results.
  - **Notifications Bell:** Real-time activity counter badge with dropdown feed of recent updates and comments.
  - **User Profile Menu:** Account details, quick group creation, rent fairness calculator, spending analytics, demo data reset, and toggle to the authentic Splitwise Login screen.
  - **Mobile Responsive Drawer:** Collapsible sidebar navigation for tablet and mobile viewports.

- **Left Navigation Sidebar:**
  - Quick views: **Dashboard**, **Recent Activity**, and **All Expenses** (with real-time item count badge).
  - **GROUPS Section:** Collapsible list with category icons (e.g. 🏠 Apartment 4B, ✈️ Lake Tahoe Trip, 🍽️ Dinner Club) and a `+ add` button.
  - **FRIENDS Section:** List of friends with circular avatars, live color-coded debt status (e.g., green for owed, orange for owing), and a `+ add` button.
  - **Invite Friends Widget:** Email input with instant invite dispatch.

- **Center Main Content Area:**
  - **Dashboard View:**
    - Action buttons: Signature orange **"Add an expense"** (`#ff652f`) and teal **"Settle up"** (`#5bc5a7`).
    - **Top 3-Column Balances Bar:** Live summary of `total balance`, `you owe`, and `you are owed`.
    - **2-Column Split:** Left column **"YOU OWE"** (in orange with quick settle button) and right column **"YOU ARE OWED"** (in green with send reminder action).
  - **Recent Activity Feed:** Chronological timeline stream of expenses added, edited, deleted, and settled with timestamps and user avatars.
  - **All Expenses View:**
    - Grouped by month (e.g. `OCTOBER 2026`).
    - Expense cards with date badge (month + day), category icon, description, group tag, payer summary, and personal share amount.
    - Quick hover trash icon to delete with confirmation.
    - **Expandable Accordion Drawer:** Click any expense to reveal the full itemized split ledger, edit/delete actions, and an **interactive comments section** where users can post notes.
  - **Group View:**
    - Group header with icon, member count, and category.
    - View toggles: **List view** and **Chart view**.
    - Search and filter within the group.
  - **Friend 1-on-1 View:**
    - Filtered history between you and the selected friend.
    - Net running balance with one-click settle up prefilled with the exact owed amount.
  - **Spending Analytics & Charts View:**
    - Total group spend overview.
    - Category breakdown visual progress bars with percentage and color badges.
    - Monthly spending histogram.
  - **Fairness Rent Calculator View:**
    - Room-by-room calculator factoring in square footage, private bathrooms, and natural sunlight/window sizes.
    - One-click button to save the calculated split as a recurring rent expense in the group.

- **Context-Sensitive Right Sidebar:**
  - On Dashboard: Overall balance summary card, Splitwise Pro promo tile, and fairness calculators shortcuts.
  - In Group View: **Simplified Group Debts** (Splitwise min-cash-flow algorithm output), group members list with individual balances, editable **Group Whiteboard** sticky note, and **Export as CSV** button.
  - In Friend View: 1-on-1 balance card with send reminder and settle actions.

---

### 2. Interactive Modals & Dialogs

- **"Add an Expense" Modal:**
  - "With **you** and:" chip tag input with autocomplete suggestions for friends and groups.
  - Category icon picker button + **smart category auto-detection** based on keywords typed in the description (e.g. typing "groceries", "dinner", "uber", "flight", "beer").
  - Multi-currency selector (`$`, `€`, `£`, `₹`, `¥`) and large amount input.
  - The iconic Splitwise sentence:
    `Paid by [you] and split [equally].`
  - **Payer Selector Popover:** Choose single payer or customize.
  - **Split Options Popover with 4 Tabs:**
    1. **Split Equally (`=`)**
    2. **Exact Amounts (`$`)** with remaining balance validation
    3. **Percentages (`%`)** with 100% total verification
    4. **Shares (`lll`)** for couples/families (1 share, 2 shares, etc.)
  - Date picker, group selector, and notes memo.

- **"Settle Up" Modal:**
  - Method selector: **Record a cash payment**, **Venmo**, and **PayPal**.
  - Visual transaction flow (Payer avatar ➔ Recipient avatar).
  - Amount input prefilled with current net balance.

- **"Start a New Group" Modal:**
  - Group name, group category (Trip, Home, Couple, Other), and member selection checkboxes.

- **"Add a Friend" Modal:**
  - Full name and email address inputs.

- **Splitwise Login / Authentication Page:**
  - Pixel-perfect recreation of `https://secure.splitwise.com/login` with Splitwise logo, email, password, Google OAuth button, and a toggle back to the app.

---

### 3. Real Debt Calculation Engine (`js/state.js`)
- Pairwise net balance calculations across multiple payers and debtors.
- **Greedy Min-Cash-Flow Simplified Debt Algorithm:** Reduces complex multi-party group debts into the minimal number of direct transfers.
- Local persistence via `localStorage` with reactive subscription pattern: any change immediately updates the UI without page reloads.
- Pre-populated with realistic initial seed data (roommates, trips, dinners, pending debts).

---

## 🚀 How to Run Locally

### Option A: Open directly in your browser
Simply double-click `index.html` or open it in any modern browser:
```
file:///c:/Codex/index.html
```

### Option B: Run via local HTTP server
Run the included zero-dependency Node server:
```bash
node server.js
```
Then navigate to:
```
http://localhost:3000
```
*(Or use Python: `python -m http.server 3000`)*

---

## 📁 File Structure

```
c:\Codex\
  ├── index.html                   # Core HTML shell & templates
  ├── server.js                    # Zero-dependency local Node static server
  ├── README.md                    # Project documentation
  ├── css\
  │    ├── base.css                # CSS variables, typography, reset, buttons
  │    ├── navbar.css              # Splitwise top nav, search, notifications, user dropdown
  │    ├── layout.css              # 3-column desktop layout & responsive grid
  │    ├── sidebar.css             # Left nav: Dashboard, Activity, Expenses, Groups, Friends
  │    ├── main-content.css        # Center panel: Header, balances, lists, feeds, details
  │    ├── right-sidebar.css       # Right panel: Balances, simplified debts, members, whiteboard
  │    ├── modals.css              # Add expense, settle up, split tabs, category picker
  │    ├── charts.css              # Spending progress bars, histogram, rent calculator
  │    ├── login.css               # secure.splitwise.com/login auth screen styles
  │    └── toast.css               # Toast notification alerts
  └── js\
       ├── seed.js                 # Realistic seed data (Apartment 4B, Tahoe trip, friends)
       ├── state.js                # State management, debt engine, localStorage persistence
       ├── ui-helpers.js           # SVG icons, currency formatting, dates, toasts, avatar helper
       ├── views\
       │    ├── dashboard-view.js  # Dashboard overview with "YOU OWE" & "YOU ARE OWED"
       │    ├── activity-view.js   # Recent Activity feed
       │    ├── expenses-view.js   # All Expenses list, accordion drawer, comments
       │    ├── group-view.js      # Group details, expenses, whiteboard, CSV export
       │    ├── friend-view.js     # Friend view & 1-on-1 settlement
       │    ├── charts-view.js     # Visual spend analytics & category charts
       │    └── rent-calc-view.js  # Splitwise Fairness Rent Calculator
       ├── modals\
       │    ├── add-expense.js     # Add / Edit expense modal logic (splits, payers, categories)
       │    ├── settle-up.js       # Settle up modal logic (cash / venmo / paypal)
       │    └── group-modal.js     # Create group & add friend modals
       └── app.js                  # Main controller, event routing, search autocomplete
```
