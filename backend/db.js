/**
 * Database Module for Splitwise
 * Uses Node.js 22 built-in node:sqlite with WAL mode
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'splitwise.db');

// Ensure db directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Configure WAL mode and performance pragmas
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
`);

// Schema Definition
const SCHEMA = `
-- 1. Users table (functional accounts + invited stub accounts)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT DEFAULT NULL,
    salt TEXT DEFAULT NULL,
    is_registered INTEGER DEFAULT 1,
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
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    original_amount REAL DEFAULT NULL,
    original_currency TEXT DEFAULT NULL,
    exchange_rate REAL DEFAULT 1.0,
    date TEXT NOT NULL,
    group_id TEXT DEFAULT NULL,
    payer_id TEXT NOT NULL,
    split_type TEXT NOT NULL DEFAULT 'equal',
    is_settlement INTEGER DEFAULT 0,
    payment_method TEXT DEFAULT NULL,
    upi_id TEXT DEFAULT NULL,
    utr TEXT DEFAULT NULL,
    itemized_data TEXT DEFAULT NULL,
    notes TEXT DEFAULT '',
    receipt_url TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
    FOREIGN KEY (payer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Expense Splits
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

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payer ON expenses(payer_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_splits_user ON expense_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_expense ON comments(expense_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
`;

db.exec(SCHEMA);

module.exports = db;
