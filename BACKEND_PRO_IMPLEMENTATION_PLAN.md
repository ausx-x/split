# Full-Stack Backend, Functional Accounts & Native Pro Suite Implementation Plan

This document outlines the detailed architectural blueprint and implementation specification for upgrading the Splitwise web application from a client-only demo application (using `localStorage`) into a **production-ready full-stack platform**.

---

## Table of Contents
1. [System Architecture & Data Flow](#1-system-architecture--data-flow)
2. [Database Specification & SQL Schema](#2-database-specification--sql-schema)
3. [Authentication & Security Architecture](#3-authentication--security-architecture)
4. [Complete REST API Contract](#4-complete-rest-api-contract)
5. [Native Pro Features Specification](#5-native-pro-features-specification)
6. [Frontend State Refactoring & API Integration](#6-frontend-state-refactoring--api-integration)
7. [Step-by-Step Implementation Phases](#7-step-by-step-implementation-phases)
8. [Testing & Verification Checkpoints](#8-testing--verification-checkpoints)

---

## 1. System Architecture & Data Flow

The system transitions from an isolated in-memory/localStorage model to an authoritative client-server architecture powered by a persistent **SQLite relational database** and a **Node.js REST backend**.

```
+-----------------------------------------------------------------------------------+
|                                CLIENT (Browser)                                   |
|                                                                                   |
|  +---------------------+   +---------------------+   +-------------------------+  |
|  |  Views (Dashboard,  |   |  Modals (Add Exp,   |   |  Native Pro Suite (OCR, |  |
|  |  Groups, Friends)   |   |  Settle Up, Auth)   |   |  Itemize, Multi-Curren) |  |
|  +----------+----------+   +----------+----------+   +------------+------------+  |
|             |                         |                           |               |
|             +-------------------------+---------------------------+               |
|                                       |                                           |
|                           [ API Client Layer (Fetch) ]                            |
|                            Bearer Token Authentication                            |
+---------------------------------------+-------------------------------------------+
                                        | HTTP (JSON REST API)
                                        v
+---------------------------------------+-------------------------------------------+
|                            BACKEND (Node.js Server)                               |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                          HTTP Server & Request Router                       |  |
|  +------------------------------------+----------------------------------------+  |
|                                       |                                           |
|  +------------------------------------+----------------------------------------+  |
|  |                      Auth & Session Middleware                              |  |
|  |               (Crypto Scrypt Hashing, Token Verification)                   |  |
|  +------------------------------------+----------------------------------------+  |
|                                       |                                           |
|  +-------------------+----------------+-------------------+--------------------+  |
|  | Auth Controller   | Expenses & Settlements Controller  | Groups & Friends   |  |
|  | - Register/Login  | - Greedy Min-Cash-Flow Debt Engine | - Whiteboard Sync  |  |
|  | - Profile/Tokens  | - Split Engine (Equal, Itemized)   | - Member Ledger    |  |
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
|  | File Upload Directory (/uploads) - Payment proofs, UPI screenshots, receipts|  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Database Specification & SQL Schema

A single-file relational database (`splitwise.db`) will be managed via Node 22's built-in `node:sqlite` engine. This eliminates all external database dependencies while providing full ACID guarantees, foreign key enforcement, and instant queries.

### 2.1 Table Definitions

```sql
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- 1. Users table (real accounts)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
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

-- 5. Friends relationships
CREATE TABLE IF NOT EXISTS friends (
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    date TEXT NOT NULL,
    group_id TEXT DEFAULT NULL,
    payer_id TEXT NOT NULL,
    split_type TEXT NOT NULL DEFAULT 'equal', -- 'equal', 'exact', 'percent', 'shares', 'itemized'
    is_settlement INTEGER DEFAULT 0,          -- 1 for payments, 0 for expenses
    payment_method TEXT DEFAULT NULL,        -- 'cash', 'upi', 'card'
    notes TEXT DEFAULT '',
    receipt TEXT DEFAULT NULL,               -- URL or Base64 data of receipt/screenshot
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
    FOREIGN KEY (payer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Expense Splits (who owes how much for each expense)
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
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payer ON expenses(payer_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_splits_user ON expense_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_expense ON comments(expense_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
```

---

## 3. Authentication & Security Architecture

### 3.1 Password Hashing Strategy
- Using Node.js standard built-in `crypto.scryptSync`.
- **Salt Generation:** `crypto.randomBytes(16).toString('hex')`.
- **Key Derivation:** `crypto.scryptSync(password, salt, 64).toString('hex')`.
- **Verification:** Timing-safe buffer comparison using `crypto.timingSafeEqual` prevents timing attack vulnerabilities.

### 3.2 Session Token Lifecycle
- Upon successful login/registration, a 32-byte cryptographic hex token is generated: `crypto.randomBytes(32).toString('hex')`.
- Session tokens are stored in the `sessions` table with a 30-day expiration window.
- The token is transmitted via the standard `Authorization: Bearer <TOKEN>` HTTP header.
- On client logout, `POST /api/auth/logout` deletes the active token from the database.

---

## 4. Complete REST API Contract

All endpoints exchange JSON (`Content-Type: application/json`). Protected routes require a valid session token in the `Authorization: Bearer <token>` header.

### 4.1 Authentication Endpoints

#### `POST /api/auth/register`
Creates a new functional user account.
- **Request Body:**
  ```json
  {
    "name": "Alex Morgan",
    "email": "alex@example.com",
    "password": "Password123!",
    "default_currency": "USD"
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
      "default_currency": "USD"
    },
    "token": "a8f3b209..."
  }
  ```

#### `POST /api/auth/login`
Authenticates an existing user.
- **Request Body:**
  ```json
  {
    "email": "alex@example.com",
    "password": "Password123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "user": { ... },
    "token": "a8f3b209..."
  }
  ```

#### `GET /api/auth/me`
Fetches the currently authenticated profile using the Bearer token.
- **Response (200 OK):** `{ "user": { ... } }`

#### `POST /api/auth/logout`
Revokes the session token.
- **Response (200 OK):** `{ "success": true }`

---

### 4.2 Dashboard & Financial Balances

#### `GET /api/dashboard`
Returns live calculated balances for the logged-in user:
- Total balance (net sum)
- You owe (sum of debts to friends)
- You are owed (sum of credits from friends)
- Itemized lists of friends you owe and friends who owe you.
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

#### `GET /api/expenses`
Supports querying and filtering:
- Query parameters: `?groupId=...`, `?friendId=...`, `?query=...`, `?category=...`, `?startDate=...`, `?endDate=...`

#### `POST /api/expenses`
Logs a new expense with itemized or proportional splits.
- **Request Body:**
  ```json
  {
    "description": "Grocery run",
    "category": "groceries",
    "amount": 120.00,
    "currency": "USD",
    "date": "2026-10-28",
    "group_id": "grp_102",
    "payer_id": "usr_1",
    "split_type": "equal",
    "splits": [
      { "user_id": "usr_1", "amount": 40.00 },
      { "user_id": "usr_2", "amount": 40.00 },
      { "user_id": "usr_3", "amount": 40.00 }
    ],
    "notes": "Pantry items and fresh vegetables",
    "receipt": "data:image/png;base64,..."
  }
  ```

#### `POST /api/settlements`
Records a debt clearance via Cash, UPI, or Card.
- **Request Body:**
  ```json
  {
    "payer_id": "usr_1",
    "recipient_id": "usr_2",
    "amount": 40.00,
    "method": "upi",
    "group_id": "grp_102",
    "date": "2026-10-28",
    "upi_id": "dave@okhdfcbank",
    "utr": "429103859201",
    "receipt": "data:image/png;base64,..."
  }
  ```

#### `PUT /api/expenses/:id` & `DELETE /api/expenses/:id`
Updates or deletes an existing expense with automatic recalculation of balances.

#### `POST /api/expenses/:id/comments`
Adds a comment to an expense ledger.

---

### 4.4 Groups & Friends Endpoints

#### `GET /api/groups` & `POST /api/groups`
List user's groups and create new groups.

#### `GET /api/groups/:id/debts`
Runs the **Greedy Min-Cash-Flow algorithm** on the server to return simplified balances for the group.

#### `PUT /api/groups/:id/whiteboard`
Updates the persistent group whiteboard sticky note.

#### `GET /api/friends` & `POST /api/friends/add`
List active friends and add other registered users by email address.

---

## 5. Native Pro Features Specification

All upgrade triggers, banners, and paywalls will be removed. The following capabilities become **standard features** available to all users:

### 5.1 Smart Receipt Scanner & Parser (OCR)
- **Dropzone in Add Expense Modal:** Users can attach any receipt image (PNG, JPG, WebP).
- **Parser Engine:** Extracts merchant name, transaction date, and line item amounts using heuristic OCR parsing.
- **Auto-Fill:** Instantly populates the Description, Date, Amount, and Category fields.

### 5.2 Itemized Bill Splitting Tab
- In the Split Options selector, users can switch to the **"Itemized"** tab.
- Users can add line items (e.g. *Appetizer $14*, *Main Course $28*, *Drinks $18*), check off which diners shared each item, and automatically calculate tax and tip proportionally.

### 5.3 Live Multi-Currency Converter
- Live currency converter modal and widget supporting:
  - USD ($), EUR (€), GBP (£), INR (₹), JPY (¥), CAD ($), AUD ($).
- Lets users enter expenses in foreign currencies while tracking group balances in their primary base currency.

### 5.4 Advanced Spending Analytics
- Direct access to:
  - Interactive **Category Donut Chart** showing spending distribution.
  - **Monthly Spend Histograms** comparing past 6 months of expenses.
  - **Member Share Matrix** showing who spent the most vs. who received the most.
  - Date range filters: *This Month*, *Last 3 Months*, *This Year*, *All Time*.

### 5.5 Deep Multi-Criteria Search & Filtering
- Persistent search and filter toolbar on the **All Expenses** page allowing simultaneous filtering by:
  - Keyword search in titles and notes.
  - Group filter dropdown.
  - Friend filter dropdown.
  - Category icon pills.
  - Date range picker.

### 5.6 Data Export Suite
- **Export to CSV:** Detailed multi-column spreadsheet of all transactions.
- **Export to JSON:** Machine-readable ledger backup.
- **Printable Summary Report:** Clean formatted printable summary of expenses and net debts.

---

## 6. Frontend State Refactoring & API Integration

### 6.1 Replacing `localStorage` with `APIClient`
The client-side `js/state.js` will be refactored into a reactive **API Service**:
- Caches authenticated user data and session token in `localStorage`.
- Automatically attaches `Authorization: Bearer <token>` to all HTTP requests.
- Implements optimistic UI updates with error rollback.
- Dispatches state updates to view subscribers whenever server data changes.

### 6.2 Auth Screen & View Guarding
- If no token is present:
  - Displays the authentic Splitwise Login / Sign Up portal.
  - Instant toggle between "Log in to Splitwise" and "Sign up for Splitwise".
- Once authenticated:
  - Loads the full 3-column dashboard populated with the user's real database records.
  - Displays the logged-in user's name, avatar, and email in the top navigation bar.

---

## 7. Step-by-Step Implementation Phases

```
Phase 1: Backend Architecture & Database Engine
  |--> Initialize database module (backend/db.js) using node:sqlite
  |--> Execute table creation and indexes
  |--> Create uploads directory for receipt images

Phase 2: Authentication Engine & Session Middleware
  |--> Build password hashing and token generation utilities (backend/auth.js)
  |--> Implement registration, login, profile check, and logout endpoints
  |--> Connect front-end auth forms with validation and error toasts

Phase 3: Core Transactional & Ledger APIs
  |--> Implement Expenses, Splits, Comments, and Notifications endpoints
  |--> Implement Settlements with Cash, UPI (screenshot upload), and Card support
  |--> Implement Group simplified debts algorithm on the server
  |--> Implement Friends and Group Whiteboard endpoints

Phase 4: Native Pro Suite & UI Cleanup
  |--> Remove all "Upgrade to Pro" banners, buttons, and promo cards
  |--> Implement Receipt parsing auto-fill in Add Expense modal
  |--> Implement Itemized Bill Split tab
  |--> Implement Multi-Currency Live Converter
  |--> Build Advanced Category Donut & Trends Analytics
  |--> Build Deep Multi-Criteria Filter Toolbar

Phase 5: End-to-End Testing & Git Push
  |--> Verify multi-account creation, friend requests, and cross-user splits
  |--> Test receipt scanning, screenshot attachments, and CSV exports
  |--> Commit all code and push to https://github.com/ausx-x/split
```

---

## 8. Testing & Verification Checkpoints

1. **Authentication Testing:**
   - Register Account A (`alice@example.com`) and Account B (`bob@example.com`).
   - Verify passwords are securely hashed with salt in `splitwise.db`.
   - Verify invalid passwords receive `401 Unauthorized` with user-friendly error messages.

2. **Cross-User Financial Ledger:**
   - Account A adds Account B as a friend and logs a `$100` expense split equally.
   - Verify Account A's dashboard immediately shows `+$50.00 (You are owed)`.
   - Log into Account B and verify dashboard shows `-$50.00 (You owe Alice $50.00)`.

3. **Settlement & Screenshot Verification:**
   - Account B settles `$50.00` via UPI and uploads a payment proof screenshot.
   - Verify the screenshot is persisted in the database and visible in Account A's expense drawer.

4. **Pro Feature Verification:**
   - Test itemized splitting with multiple line items.
   - Test multi-currency exchange conversion.
   - Verify CSV and JSON exports match database balances.
   - Confirm complete absence of all "Upgrade to Pro" promotional gates.
