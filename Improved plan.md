# Full-Stack Backend, Functional Accounts & Native Pro Suite Implementation Plan

This document outlines the detailed architectural blueprint and implementation specification for upgrading the Splitwise web application from a client-only demo application (using `localStorage` and `js/seed.js`) into a **production-ready full-stack platform**.

---

## Table of Contents
1. [System Architecture & Data Flow](#1-system-architecture--data-flow)
2. [Database Specification & SQL Schema](#2-database-specification--sql-schema)
3. [Authentication, Onboarding & Security Architecture](#3-authentication-onboarding--security-architecture)
4. [Complete REST API Contract](#4-complete-rest-api-contract)
5. [Native Pro Features Specification](#5-native-pro-features-specification)
6. [Frontend State Refactoring & View Integration](#6-frontend-state-refactoring--view-integration)
7. [Step-by-Step Implementation Phases](#7-step-by-step-implementation-phases)
8. [Testing & Verification Checkpoints](#8-testing--verification-checkpoints)

---

## 1. System Architecture & Data Flow

The system transitions from an isolated in-memory/`localStorage` model (`js/seed.js` and client-only `js/state.js`) to an authoritative client-server architecture powered by a persistent **SQLite relational database (`WAL` mode)** and a **zero-dependency Node.js REST backend (`server.js`)**.

```
+-----------------------------------------------------------------------------------+
|                                CLIENT (Browser)                                   |
|                                                                                   |
|  +---------------------+   +---------------------+   +-------------------------+  |
|  |  Views (Dashboard,  |   |  Modals (Add Exp,   |   |  Native Pro Suite (OCR, |  |
|  |  Groups, Friends,   |   |  Settle Up [UPI/    |   |  Itemize, Multi-Curren, |  |
|  |  Activity, Rent)    |   |  Card/Cash], Auth)  |   |  Charts, CSV/JSON Exp)  |  |
|  +----------+----------+   +----------+----------+   +------------+------------+  |
|             |                         |                           |               |
|             +-------------------------+---------------------------+               |
|                                       |                                           |
|                        [ Reactive API Client (js/state.js) ]                      |
|                            Bearer Token Authentication                            |
+---------------------------------------+-------------------------------------------+
                                        | HTTP (JSON REST API)
                                        v
+---------------------------------------+-------------------------------------------+
|                         BACKEND (Node.js - server.js)                             |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |               HTTP Server, Static Asset & /uploads Router                   |  |
|  +------------------------------------+----------------------------------------+  |
|                                       |                                           |
|  +------------------------------------+----------------------------------------+  |
|  |                      Auth & Session Middleware                              |  |
|  |         (Crypto Scrypt Hashing, Bearer Token & Expiry Verification)         |  |
|  +------------------------------------+----------------------------------------+  |
|                                       |                                           |
|  +-------------------+----------------+-------------------+--------------------+  |
|  | Auth & Stubs      | Expenses & Settlements Controller  | Groups & Friends   |  |
|  | - Register/Login  | - Greedy Min-Cash-Flow Debt Engine | - Bidirectional    |  |
|  | - Claim Stub Acct | - Cent-Accurate Split & Itemizer   |   Friend Graph     |  |
|  | - Profile/Tokens  | - Base64-to-Disk Image Persistence | - Whiteboard Sync  |  |
|  +-------------------+----------------+-------------------+--------------------+  |
|                                       |                                           |
+---------------------------------------+-------------------------------------------+
                                        | Direct SQLite Driver (node:sqlite)
                                        v
+---------------------------------------+-------------------------------------------+
|                          PERSISTENT DATABASE (splitwise.db)                       |
|                                                                                   |
|  [ users ] [ sessions ] [ groups ] [ group_members ] [ friends ]                  |
|  [ expenses ] [ expense_splits ] [ comments ] [ notifications ]                   |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | File Upload Directory (/uploads) - Decoded PNG/JPG/WebP receipts & UPI proof|  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Database Specification & SQL Schema

A single-file relational database (`splitwise.db`) will be managed via Node 22's built-in `node:sqlite` (`DatabaseSync`) engine.

### 2.1 Concurrency & Integrity Pragmas
Every database connection initialization must execute:
```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```
*Why:* `WAL` (Write-Ahead Logging) and `busy_timeout` prevent `SQLITE_BUSY` lock errors when the frontend fires concurrent `fetch()` calls for dashboard, expenses, and notifications.

### 2.2 Table Definitions

```sql
-- 1. Users table (functional accounts + invited stub accounts)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT DEFAULT NULL,         -- NULL only when is_registered = 0
    salt TEXT DEFAULT NULL,                  -- NULL only when is_registered = 0
    is_registered INTEGER DEFAULT 1,         -- 1 = active account, 0 = invited by email stub
    avatar TEXT DEFAULT NULL,
    color TEXT DEFAULT '#5bc5a7',
    default_currency TEXT DEFAULT 'USD',
    upi_id TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Sessions table (cryptographic tokens)
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Groups table
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Other',
    icon TEXT DEFAULT '🏠',
    base_currency TEXT NOT NULL DEFAULT 'USD',
    simplify_debts INTEGER DEFAULT 1,
    whiteboard TEXT DEFAULT '',
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Group Members mapping
CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Friends relationships (stored bidirectionally: (A,B) and (B,A))
CREATE TABLE IF NOT EXISTS friends (
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Expenses & Settlements table
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    amount REAL NOT NULL,                    -- Normalized amount in group/base currency
    currency TEXT NOT NULL DEFAULT 'USD',    -- Base currency code
    original_amount REAL DEFAULT NULL,       -- Foreign currency amount (if converted)
    original_currency TEXT DEFAULT NULL,     -- Foreign currency code (e.g., 'EUR', 'INR')
    exchange_rate REAL DEFAULT 1.0,          -- Conversion rate applied
    date TEXT NOT NULL,
    group_id TEXT DEFAULT NULL,
    payer_id TEXT NOT NULL,
    split_type TEXT NOT NULL DEFAULT 'equal', -- 'equal', 'exact', 'percent', 'shares', 'itemized', 'settlement'
    is_settlement INTEGER DEFAULT 0,          -- 1 for payments (Settle Up), 0 for regular expenses
    payment_method TEXT DEFAULT NULL,         -- 'cash', 'upi', 'card' (Removed Venmo/PayPal)
    upi_id TEXT DEFAULT NULL,                 -- Optional payee UPI ID for UPI settlements
    utr TEXT DEFAULT NULL,                    -- Optional UPI Reference/UTR number
    itemized_data TEXT DEFAULT NULL,          -- JSON array of line items, tax, and tip for 'itemized' splits
    notes TEXT DEFAULT '',
    receipt_url TEXT DEFAULT NULL,            -- Relative file path in /uploads (e.g., '/uploads/upi_9821.png')
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
    FOREIGN KEY (payer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Expense Splits (who owes how much for each expense or settlement)
-- Note: For a settlement (is_settlement = 1), payer_id paid `amount`, and a single
-- expense_splits row exists with user_id = recipient_id and amount = settlement amount.
CREATE TABLE IF NOT EXISTS expense_splits (
    id TEXT PRIMARY KEY,
    expense_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    percentage REAL DEFAULT NULL,
    shares REAL DEFAULT NULL,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. Comments on expenses
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    expense_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 9. Activity & Notifications log
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    expense_id TEXT DEFAULT NULL,
    group_id TEXT DEFAULT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payer ON expenses(payer_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_splits_user ON expense_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_expense ON comments(expense_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
```

---

## 3. Authentication, Onboarding & Security Architecture

### 3.1 Removal of Demo Switcher (`js/seed.js`)
- Remove the hardcoded demo account switcher (`Alex`, `Dave`, `Sarah`, etc.) from the login screen and navbar.
- Deprecate client-side `js/seed.js` auto-injection so the app always boots into real database-backed sessions.

### 3.2 Password Hashing Strategy
- Built-in `crypto.scryptSync` with zero external native dependencies:
  - **Salt Generation:** `crypto.randomBytes(16).toString('hex')`
  - **Key Derivation:** `crypto.scryptSync(password, salt, 64).toString('hex')`
  - **Verification:** `crypto.timingSafeEqual(Buffer.from(savedHash, 'hex'), Buffer.from(derivedHash, 'hex'))`

### 3.3 Stub Account Claiming on Registration
- When User A adds a friend via `POST /api/friends/add` using an email (`bob@example.com`) that does not exist in `users`:
  1. The server creates a stub user (`is_registered = 0`, `password_hash = NULL`).
  2. User A can immediately add Bob to groups and split expenses with him.
  3. When Bob visits the app and signs up (`POST /api/auth/register`) with `bob@example.com`, the server detects the existing `is_registered = 0` row, sets `password_hash`, `salt`, `name`, and `is_registered = 1`, and preserves his existing `id`. Bob immediately sees all shared groups and balances.

### 3.4 Session Token Lifecycle & Cleanup
- `crypto.randomBytes(32).toString('hex')` stored in `sessions` with a 30-day expiry (`datetime('now', '+30 days')`).
- Auth middleware validates `Authorization: Bearer <token>` and checks `expires_at > CURRENT_TIMESTAMP`. Expired tokens are purged automatically.

### 3.5 Image Upload Handling (`/uploads`)
- Whenever `receipt` (Base64 Data URL: `data:image/(png|jpeg|webp);base64,...`) is sent to `POST /api/expenses` or `POST /api/settlements`:
  - Enforce a `5MB` payload limit in `server.js`.
  - Strip the Data URL prefix, validate the MIME type (`png`, `jpeg`, `webp`), write the binary buffer to `/uploads/<prefix>_<uuid>.<ext>`, and store `/uploads/<prefix>_<uuid>.<ext>` in `expenses.receipt_url`.

---

## 4. Complete REST API Contract

All endpoints exchange JSON (`Content-Type: application/json`). Protected routes require `Authorization: Bearer <token>`. Multi-table writes must run inside `BEGIN IMMEDIATE ... COMMIT` transactions.

### 4.1 Authentication & Profile Endpoints

#### `POST /api/auth/register`
Creates a new functional account (or claims an existing `is_registered = 0` stub account).
- **Request Body:**
  ```json
  {
    "name": "Alex Morgan",
    "email": "alex@example.com",
    "password": "Password123!",
    "default_currency": "INR",
    "upi_id": "alex@okaxis"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "user": {
      "id": "usr_91238491",
      "name": "Alex Morgan",
      "short_name": "Alex",
      "email": "alex@example.com",
      "default_currency": "INR",
      "upi_id": "alex@okaxis",
      "color": "#5bc5a7"
    },
    "token": "a8f3b209..."
  }
  ```

#### `POST /api/auth/login`
- **Request Body:** `{ "email": "alex@example.com", "password": "Password123!" }`
- **Response (200 OK):** `{ "success": true, "user": { ... }, "token": "a8f3b209..." }`

#### `GET /api/auth/me` & `PUT /api/auth/profile`
- `GET /api/auth/me`: Returns current user object.
- `PUT /api/auth/profile`: Updates `name`, `default_currency`, `upi_id`, or `avatar`.

#### `POST /api/auth/logout`
- Deletes the active Bearer token from `sessions`.

---

### 4.2 Dashboard & Financial Ledger Logic

#### Pairwise Net Balance Calculation Rule
For any two users $A$ (logged-in user) and $B$ (friend/group member), the net balance is calculated across all `expenses` and `expense_splits` (including settlements where `is_settlement = 1`):
$$\text{Net}(A, B) = \sum_{\substack{e \in \text{Expenses} \\ e.\text{payer\_id} = A}} \text{split}(e, B) - \sum_{\substack{e \in \text{Expenses} \\ e.\text{payer\_id} = B}} \text{split}(e, A)$$
- If $\text{Net}(A, B) > 0.005$: $B$ owes $A$.
- If $\text{Net}(A, B) < -0.005$: $A$ owes $B$.

#### `GET /api/dashboard`
- **Response (200 OK):**
  ```json
  {
    "totalBalance": 129.25,
    "youOwe": 40.00,
    "youAreOwed": 169.25,
    "friendsYouOwe": [
      { "user": { "id": "usr_2", "name": "Dave Miller" }, "amount": 40.00 }
    ],
    "friendsWhoOweYou": [
      { "user": { "id": "usr_3", "name": "Sarah Jenkins" }, "amount": 124.25 },
      { "user": { "id": "usr_4", "name": "Michael Chang" }, "amount": 45.00 }
    ]
  }
  ```

---

### 4.3 Expenses & Settlement Endpoints

#### Cent-Accurate Split Validation
Before inserting into `expense_splits`, the backend validates that $\sum \text{splits.amount} = \text{expense.amount}$ within $\pm 0.01$. For `equal`, `percent`, or `shares` splits, rounding remainders (e.g., `$0.01` on a `$100 / 3` split) are deterministically assigned to the first participant so totals never drift.

#### `GET /api/expenses`
- Query parameters: `?groupId=...`, `?friendId=...`, `?query=...`, `?category=...`, `?startDate=...`, `?endDate=...`, `?type=all|expenses|settlements`
- Returns expenses hydrated with `splits`, `comments`, `payer` details, and `receipt_url`.

#### `POST /api/expenses`
Logs a new expense (supports equal, exact, percent, shares, and itemized splits, plus foreign currency conversion).
- **Request Body:**
  ```json
  {
    "description": "Grocery run",
    "category": "groceries",
    "amount": 120.00,
    "currency": "USD",
    "original_amount": 110.00,
    "original_currency": "EUR",
    "exchange_rate": 1.0909,
    "date": "2026-10-28",
    "group_id": "grp_102",
    "payer_id": "usr_1",
    "split_type": "itemized",
    "itemized_data": {
      "items": [
        { "name": "Shared Produce", "amount": 90.00, "assigned_to": ["usr_1", "usr_2", "usr_3"] },
        { "name": "Protein Powder", "amount": 20.00, "assigned_to": ["usr_1"] }
      ],
      "tax": 10.00,
      "tip": 0.00
    },
    "splits": [
      { "user_id": "usr_1", "amount": 54.55 },
      { "user_id": "usr_2", "amount": 32.73 },
      { "user_id": "usr_3", "amount": 32.72 }
    ],
    "notes": "Pantry items and fresh vegetables",
    "receipt": "data:image/png;base64,..."
  }
  ```

#### `POST /api/settlements`
Records a payment via **Record Cash**, **UPI** (with optional screenshot upload, UPI ID, and UTR), or **Card**. Venmo and PayPal are removed.
- **Database Action:** Inserts a row into `expenses` with `is_settlement = 1`, `split_type = 'settlement'`, `payment_method = method`, `payer_id = payer_id`, and a single row into `expense_splits` with `user_id = recipient_id` and `amount = amount`.
- **Request Body:**
  ```json
  {
    "payer_id": "usr_1",
    "recipient_id": "usr_2",
    "amount": 40.00,
    "currency": "USD",
    "method": "upi",
    "group_id": "grp_102",
    "date": "2026-10-28",
    "upi_id": "dave@okhdfcbank",
    "utr": "429103859201",
    "notes": "Paid via GPay",
    "receipt": "data:image/png;base64,..."
  }
  ```

#### `PUT /api/expenses/:id` & `DELETE /api/expenses/:id`
- Replaces `expense_splits` atomically inside a transaction on `PUT`; deletes associated `/uploads` image file on `DELETE`.

#### `POST /api/expenses/:id/comments` & `DELETE /api/comments/:id`
- Appends or removes a comment on an expense and generates a notification for participants.

---

### 4.4 Groups, Friends & Activity Endpoints

#### `GET /api/groups`, `POST /api/groups`, `PUT /api/groups/:id`, `DELETE /api/groups/:id`
- Manage groups and member lists (`group_members`). Adding a group member automatically creates bidirectional `friends` entries between group members if not already linked.

#### `GET /api/groups/:id/debts`
- Runs the **Greedy Min-Cash-Flow algorithm** on the server if `simplify_debts = 1`, returning simplified `{ from, to, amount }` settlement instructions.

#### `PUT /api/groups/:id/whiteboard`
- Saves the group whiteboard notes (`groups.whiteboard`).

#### `GET /api/friends` & `POST /api/friends/add`
- `POST /api/friends/add`: Accepts `{ "name": "Bob", "email": "bob@example.com" }`. Finds existing user by email or creates a stub user (`is_registered = 0`), then inserts `(user_id, friend_id)` and `(friend_id, user_id)` into `friends`.

#### `GET /api/notifications` & `PUT /api/notifications/read`
- Powers `js/views/activity-view.js` and the navbar notification bell.

#### `GET /api/analytics`
- Returns pre-aggregated category totals, 6-month spending histograms, and member share matrices filtered by `?groupId=...&range=month|3months|year|all`.

---

## 5. Native Pro Features Specification

All "Upgrade to Pro" buttons, navbar badges, and promotional modals are removed from `index.html` and CSS. Every Pro feature is unlocked natively:

### 5.1 Settle Up Modal: Cash, UPI (with Screenshot Proof) & Card
- Replaces **Venmo** and **PayPal** tabs in `js/modals/settle-up.js` with **Record Cash**, **UPI**, and **Card**.
- Selecting **UPI** reveals:
  - Optional Payee UPI ID & UTR reference inputs.
  - **Upload UPI Screenshot** dropzone with instant thumbnail preview, file-size validation, and remove button.
  - Saved screenshots are served from `/uploads/...` and viewable inside the expense detail drawer.

### 5.2 Smart Receipt Scanner & Parser (OCR)
- Dropzone inside `js/modals/add-expense.js` that accepts receipt images (PNG, JPG, WebP), previews the image, and extracts merchant description, date, total amount, and line items to auto-fill the form.

### 5.3 Itemized Bill Splitting Tab
- Adds an **"Itemized"** split mode in `js/modals/add-expense.js`.
- Users enter individual receipt line items, toggle participant checkboxes per item, and enter tax/tip (distributed proportionally to each diner's subtotal). Saved in `expenses.itemized_data`.

### 5.4 Live Multi-Currency Converter
- Supports `USD ($)`, `INR (₹)`, `EUR (€)`, `GBP (£)`, `JPY (¥)`, `CAD ($)`, and `AUD ($)`.
- Converts foreign transaction amounts into the user's or group's `base_currency` at entry time while displaying both the original currency and converted amount in the expense row.

### 5.5 Advanced Spending Analytics (`js/views/charts-view.js`)
- Interactive **Category Donut Chart**, **6-Month Trend Histogram**, and **Member Share Matrix** with date range filters (*This Month*, *Last 3 Months*, *This Year*, *All Time*).

### 5.6 Deep Multi-Criteria Search & Data Export (`js/views/expenses-view.js`)
- Filter toolbar combining keyword search, group dropdown, friend dropdown, category pills, and date range inputs.
- **Export to CSV**, **Export to JSON**, and **Printable Summary Report** buttons.

---

## 6. Frontend State Refactoring & View Integration

### 6.1 Refactoring `js/state.js` into an Async API Store
- Stores only `splitwise_auth_token` in `localStorage`.
- Exposes `state.init()` which calls `GET /api/auth/me` and hydrates `state.user`, `state.dashboard`, `state.groups`, `state.friends`, `state.expenses`, and `state.notifications` in parallel via `Promise.all()`.
- All mutating methods (`addExpense`, `recordSettlement`, `addGroup`, `addFriend`, `updateWhiteboard`, `addComment`) become `async` functions calling `fetch()` with `Authorization: Bearer <token>`, followed by state re-sync and UI re-render.

### 6.2 Connecting All Existing Views (`js/views/*`)
- `index.html` & `js/app.js`: Remove `#upgrade-pro-btn` and demo account buttons; wire Login and Sign Up forms to `/api/auth/login` and `/api/auth/register`.
- `js/views/rent-calc-view.js`: Connect the "Save / Split Rent as Expense" action directly to `state.addExpense()` (`POST /api/expenses`) so calculated room splits persist to the selected group.
- `js/views/activity-view.js`: Populate from `state.notifications` (`GET /api/notifications`) with a "Mark all as read" button (`PUT /api/notifications/read`).

---

## 7. Step-by-Step Implementation Phases

```
Phase 1: Backend Foundation & SQLite WAL Database
  |--> Create backend/db.js with node:sqlite, WAL pragma, and 9-table schema
  |--> Configure /uploads directory and static file serving in server.js
  |--> Build Base64 image decoder & file writer utility

Phase 2: Functional Auth, Stub Accounts & Session Middleware
  |--> Build backend/auth.js (scrypt hashing, timingSafeEqual, Bearer middleware)
  |--> Implement /api/auth/register (with stub-account claiming), login, me, logout
  |--> Remove js/seed.js demo account buttons and wire real Auth UI in index.html

Phase 3: Transactional Ledger, UPI/Card Settlements & Debt Simplification
  |--> Implement cent-accurate /api/expenses and /api/settlements (Cash, UPI + proof, Card)
  |--> Implement /api/dashboard pairwise net balance calculation
  |--> Implement /api/groups, Greedy Min-Cash-Flow /debts, /api/friends, and /api/notifications

Phase 4: Native Pro Suite & UI Cleanup
  |--> Strip all "Upgrade to Pro" buttons, badges, and paywall prompts
  |--> Update js/modals/settle-up.js: replace Venmo/PayPal with UPI (+ screenshot upload) & Card
  |--> Add Itemized Splitting, Receipt OCR Scanner, and Multi-Currency Converter to add-expense.js
  |--> Upgrade charts-view.js and expenses-view.js with multi-criteria filters & CSV/JSON export

Phase 5: End-to-End Verification
  |--> Verify multi-user registration, stub-friend claiming, and cross-account balance sync
  |--> Verify UPI screenshot persistence in /uploads and expense drawer rendering
  |--> Verify itemized math, multi-currency conversion, and rent calculator expense logging
```

---

## 8. Testing & Verification Checkpoints

1. **Functional Auth & Stub Claiming:**
   - Register Account A (`alice@example.com`).
   - Alice adds `bob@example.com` as a friend (creates stub user) and splits a `$100.00` expense.
   - Register Account B with `bob@example.com`. Verify Bob automatically inherits the friend link and sees `You owe Alice $50.00` immediately upon first login.
2. **Cent-Accurate Remainder Splitting:**
   - Split `$100.00` equally among 3 group members. Verify `expense_splits` records `33.34`, `33.33`, and `33.33` (sum = `100.00`, zero floating-point drift).
3. **UPI & Card Settlement + Screenshot Proof:**
   - Open **Settle up**, verify **Venmo** and **PayPal** are gone, and **Record Cash**, **UPI**, and **Card** tabs are active.
   - Select **UPI**, attach a PNG screenshot, and click **Record payment**. Verify the file is saved in `/uploads/`, `expenses.receipt_url` points to it, and both users see the settlement proof and `$0.00` settled balance.
4. **Native Pro Features & Zero Paywalls:**
   - Confirm no "Upgrade to Pro" UI exists anywhere in the DOM.
   - Log an itemized bill with tax/tip and a foreign currency (`EUR` to `USD`), then export the ledger to CSV and verify all rows match the database.