/**
 * REST API Route Handlers
 */

const crypto = require('node:crypto');
const db = require('./db');
const auth = require('./auth');
const debtEngine = require('./debt-engine');
const uploads = require('./uploads');

// Helper to extract JSON body
function getJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Helper to send JSON response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Extract Bearer token from header
function getBearerToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  return parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : null;
}

// Router dispatcher
async function handleApiRequest(req, res, pathname, queryParams) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // -------------------------------------------------------------
  // Public Auth Endpoints
  // -------------------------------------------------------------
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const body = await getJsonBody(req);
      const { name, email, password, default_currency, upi_id } = body;

      if (!name || !email || !password) {
        return sendJson(res, 400, { success: false, error: 'Name, email, and password are required' });
      }

      const cleanEmail = email.toLowerCase().trim();
      if (password.length < 6) {
        return sendJson(res, 400, { success: false, error: 'Password must be at least 6 characters' });
      }

      // Check if user already exists
      const existing = db.prepare(`SELECT * FROM users WHERE email = ?`).get(cleanEmail);

      const shortName = name.split(' ')[0] || name;
      const { hash, salt } = auth.hashPassword(password);
      let userId;

      if (existing) {
        if (existing.is_registered === 1) {
          return sendJson(res, 409, { success: false, error: 'An account with this email already exists. Please log in.' });
        }
        // Claim existing stub account!
        userId = existing.id;
        db.prepare(`
          UPDATE users
          SET name = ?, short_name = ?, password_hash = ?, salt = ?, is_registered = 1, default_currency = ?, upi_id = ?
          WHERE id = ?
        `).run(name, shortName, hash, salt, default_currency || 'USD', upi_id || null, userId);
      } else {
        // Create brand new user
        userId = 'usr_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
        const colorPalette = ['#5bc5a7', '#3280ea', '#f5a623', '#7a52cc', '#e74c3c', '#1abc9c', '#34495e'];
        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];

        db.prepare(`
          INSERT INTO users (id, name, short_name, email, password_hash, salt, is_registered, color, default_currency, upi_id)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        `).run(userId, name, shortName, cleanEmail, hash, salt, color, default_currency || 'USD', upi_id || null);
      }

      const { token } = auth.createSession(userId);
      const user = db.prepare(`SELECT id, name, short_name, email, avatar, color, default_currency, upi_id FROM users WHERE id = ?`).get(userId);

      return sendJson(res, 201, { success: true, user, token });
    } catch (err) {
      console.error('Registration error:', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await getJsonBody(req);
      const { email, password } = body;

      if (!email || !password) {
        return sendJson(res, 400, { success: false, error: 'Email and password are required' });
      }

      const cleanEmail = email.toLowerCase().trim();
      const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(cleanEmail);

      if (!user || user.is_registered !== 1 || !user.password_hash) {
        return sendJson(res, 401, { success: false, error: 'Invalid email or password' });
      }

      const isValid = auth.verifyPassword(password, user.password_hash, user.salt);
      if (!isValid) {
        return sendJson(res, 401, { success: false, error: 'Invalid email or password' });
      }

      const { token } = auth.createSession(user.id);
      const safeUser = {
        id: user.id,
        name: user.name,
        short_name: user.short_name,
        email: user.email,
        avatar: user.avatar,
        color: user.color,
        default_currency: user.default_currency,
        upi_id: user.upi_id
      };

      return sendJson(res, 200, { success: true, user: safeUser, token });
    } catch (err) {
      console.error('Login error:', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // -------------------------------------------------------------
  // Protected Routes - Require Authentication
  // -------------------------------------------------------------
  const token = getBearerToken(req);
  const currentUser = auth.authenticateToken(token);

  if (!currentUser) {
    return sendJson(res, 401, { success: false, error: 'Unauthorized: Valid session required' });
  }

  // 1. Current user profile
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    return sendJson(res, 200, { success: true, user: currentUser });
  }

  if (pathname === '/api/auth/profile' && req.method === 'PUT') {
    const body = await getJsonBody(req);
    const { name, default_currency, upi_id, avatar } = body;

    let avatarUrl = currentUser.avatar;
    if (avatar && avatar.startsWith('data:image')) {
      avatarUrl = uploads.saveBase64Image(avatar, 'avatar');
    }

    const shortName = name ? (name.split(' ')[0] || name) : currentUser.short_name;

    db.prepare(`
      UPDATE users
      SET name = COALESCE(?, name),
          short_name = COALESCE(?, short_name),
          default_currency = COALESCE(?, default_currency),
          upi_id = COALESCE(?, upi_id),
          avatar = COALESCE(?, avatar)
      WHERE id = ?
    `).run(name || null, shortName || null, default_currency || null, upi_id || null, avatarUrl, currentUser.id);

    const updated = db.prepare(`SELECT id, name, short_name, email, avatar, color, default_currency, upi_id FROM users WHERE id = ?`).get(currentUser.id);
    return sendJson(res, 200, { success: true, user: updated });
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    auth.destroySession(token);
    return sendJson(res, 200, { success: true });
  }

  // 2. Dashboard Balances
  if (pathname === '/api/dashboard' && req.method === 'GET') {
    const balances = debtEngine.getUserDashboardBalances(currentUser.id);
    return sendJson(res, 200, { success: true, ...balances });
  }

  // 3. Friends Endpoints
  if (pathname === '/api/friends' && req.method === 'GET') {
    const friends = db.prepare(`
      SELECT u.id, u.name, u.short_name, u.email, u.avatar, u.color, u.default_currency, u.upi_id, u.is_registered
      FROM friends f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ?
      ORDER BY u.name ASC
    `).all(currentUser.id);

    // Attach net balance with each friend
    const friendsWithBalances = friends.map(f => {
      const balance = debtEngine.getPairBalance(currentUser.id, f.id);
      return { ...f, balance };
    });

    return sendJson(res, 200, { success: true, friends: friendsWithBalances });
  }

  if (pathname === '/api/friends/add' && req.method === 'POST') {
    const body = await getJsonBody(req);
    const { name, email } = body;

    if (!email) {
      return sendJson(res, 400, { success: false, error: 'Friend email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail === currentUser.email.toLowerCase()) {
      return sendJson(res, 400, { success: false, error: 'You cannot add yourself as a friend' });
    }

    let friend = db.prepare(`SELECT * FROM users WHERE email = ?`).get(cleanEmail);

    if (!friend) {
      // Create invited stub account
      const friendId = 'usr_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
      const friendName = name ? name.trim() : cleanEmail.split('@')[0];
      const friendShort = friendName.split(' ')[0] || friendName;
      const colors = ['#3280ea', '#f5a623', '#7a52cc', '#e74c3c', '#1abc9c'];
      const color = colors[Math.floor(Math.random() * colors.length)];

      db.prepare(`
        INSERT INTO users (id, name, short_name, email, is_registered, color, default_currency)
        VALUES (?, ?, ?, ?, 0, ?, 'USD')
      `).run(friendId, friendName, friendShort, cleanEmail, color);

      friend = db.prepare(`SELECT id, name, short_name, email, avatar, color, default_currency, upi_id, is_registered FROM users WHERE id = ?`).get(friendId);
    }

    // Insert bidirectional friendship
    db.prepare(`INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)`).run(currentUser.id, friend.id);
    db.prepare(`INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)`).run(friend.id, currentUser.id);

    return sendJson(res, 201, {
      success: true,
      friend: {
        id: friend.id,
        name: friend.name,
        short_name: friend.short_name,
        email: friend.email,
        avatar: friend.avatar,
        color: friend.color,
        balance: 0.00
      }
    });
  }

  // 4. Groups Endpoints
  if (pathname === '/api/groups' && req.method === 'GET') {
    const groups = db.prepare(`
      SELECT g.*
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ?
      ORDER BY g.name ASC
    `).all(currentUser.id);

    const fullGroups = groups.map(g => {
      const members = db.prepare(`
        SELECT u.id, u.name, u.short_name, u.email, u.avatar, u.color
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ?
      `).all(g.id);
      return { ...g, members };
    });

    return sendJson(res, 200, { success: true, groups: fullGroups });
  }

  if (pathname === '/api/groups' && req.method === 'POST') {
    const body = await getJsonBody(req);
    const { name, type, icon, base_currency, members } = body;

    if (!name || !name.trim()) {
      return sendJson(res, 400, { success: false, error: 'Group name is required' });
    }

    const groupId = 'grp_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
    const memberIds = Array.isArray(members) ? [...new Set([currentUser.id, ...members])] : [currentUser.id];

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`
        INSERT INTO groups (id, name, type, icon, base_currency, whiteboard, created_by)
        VALUES (?, ?, ?, ?, ?, '', ?)
      `).run(groupId, name.trim(), type || 'Other', icon || '🏠', base_currency || 'USD', currentUser.id);

      const insertMember = db.prepare(`INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)`);
      const insertFriend = db.prepare(`INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)`);

      // Add members and establish bidirectional friendship between all members
      memberIds.forEach(mId => {
        insertMember.run(groupId, mId);
        memberIds.forEach(otherId => {
          if (mId !== otherId) {
            insertFriend.run(mId, otherId);
          }
        });
      });

      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    const created = db.prepare(`SELECT * FROM groups WHERE id = ?`).get(groupId);
    const groupMembers = db.prepare(`
      SELECT u.id, u.name, u.short_name, u.email, u.avatar, u.color
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
    `).all(groupId);

    return sendJson(res, 201, { success: true, group: { ...created, members: groupMembers } });
  }

  if (pathname.match(/^\/api\/groups\/([^/]+)\/whiteboard$/) && req.method === 'PUT') {
    const groupId = pathname.split('/')[3];
    const body = await getJsonBody(req);
    const { whiteboard } = body;

    db.prepare(`UPDATE groups SET whiteboard = ? WHERE id = ?`).run(whiteboard || '', groupId);
    return sendJson(res, 200, { success: true, whiteboard: whiteboard || '' });
  }

  if (pathname.match(/^\/api\/groups\/([^/]+)\/debts$/) && req.method === 'GET') {
    const groupId = pathname.split('/')[3];
    const debts = debtEngine.getSimplifiedGroupDebts(groupId);
    return sendJson(res, 200, { success: true, ...debts });
  }

  // 5. Expenses Endpoints
  if (pathname === '/api/expenses' && req.method === 'GET') {
    let sql = `
      SELECT DISTINCT e.*
      FROM expenses e
      LEFT JOIN expense_splits s ON e.id = s.expense_id
      WHERE (e.payer_id = ? OR s.user_id = ?)
    `;
    const params = [currentUser.id, currentUser.id];

    if (queryParams.groupId) {
      sql += ` AND e.group_id = ? `;
      params.push(queryParams.groupId);
    }

    if (queryParams.friendId) {
      sql += ` AND (
        (e.payer_id = ? AND s.user_id = ?) OR
        (e.payer_id = ? AND s.user_id = ?)
      )`;
      params.push(currentUser.id, queryParams.friendId, queryParams.friendId, currentUser.id);
    }

    if (queryParams.category) {
      sql += ` AND e.category = ? `;
      params.push(queryParams.category);
    }

    if (queryParams.type === 'settlements') {
      sql += ` AND e.is_settlement = 1 `;
    } else if (queryParams.type === 'expenses') {
      sql += ` AND e.is_settlement = 0 `;
    }

    if (queryParams.query) {
      sql += ` AND (e.description LIKE ? OR e.notes LIKE ?) `;
      params.push(`%${queryParams.query}%`, `%${queryParams.query}%`);
    }

    sql += ` ORDER BY e.date DESC, e.created_at DESC `;

    const expenses = db.prepare(sql).all(...params);

    const getSplitsStmt = db.prepare(`
      SELECT s.*, u.name, u.short_name, u.avatar, u.color
      FROM expense_splits s
      JOIN users u ON s.user_id = u.id
      WHERE s.expense_id = ?
    `);

    const getCommentsStmt = db.prepare(`
      SELECT c.*, u.name, u.short_name, u.avatar, u.color
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.expense_id = ?
      ORDER BY c.created_at ASC
    `);

    const getUserStmt = db.prepare(`SELECT id, name, short_name, email, avatar, color FROM users WHERE id = ?`);

    const hydrated = expenses.map(exp => {
      const splits = getSplitsStmt.all(exp.id);
      const comments = getCommentsStmt.all(exp.id);
      const payer = getUserStmt.get(exp.payer_id);
      let itemizedData = null;
      if (exp.itemized_data) {
        try { itemizedData = JSON.parse(exp.itemized_data); } catch(e) {}
      }
      return {
        ...exp,
        payer,
        splits,
        comments,
        itemized_data: itemizedData
      };
    });

    return sendJson(res, 200, { success: true, expenses: hydrated });
  }

  if (pathname === '/api/expenses' && req.method === 'POST') {
    const body = await getJsonBody(req);
    const {
      description,
      category,
      amount,
      currency,
      original_amount,
      original_currency,
      exchange_rate,
      date,
      group_id,
      payer_id,
      split_type,
      splits,
      itemized_data,
      notes,
      receipt
    } = body;

    const numAmount = Number(amount);
    if (!description || !numAmount || numAmount <= 0) {
      return sendJson(res, 400, { success: false, error: 'Valid description and amount are required' });
    }

    if (!Array.isArray(splits) || splits.length === 0) {
      return sendJson(res, 400, { success: false, error: 'At least one participant split is required' });
    }

    // Cent-accurate split check
    let splitSum = splits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
    const diff = Math.abs(splitSum - numAmount);

    // If rounding drift is <= 0.05, adjust the first split deterministically
    if (diff > 0.001 && diff <= 0.05) {
      const drift = Number((numAmount - splitSum).toFixed(2));
      splits[0].amount = Number((splits[0].amount + drift).toFixed(2));
      splitSum = numAmount;
    } else if (diff > 0.05) {
      return sendJson(res, 400, { success: false, error: `Split amounts ($${splitSum.toFixed(2)}) do not match total amount ($${numAmount.toFixed(2)})` });
    }

    // Save uploaded receipt if base64
    let receiptUrl = null;
    if (receipt) {
      receiptUrl = uploads.saveBase64Image(receipt, 'receipt');
    }

    const expenseId = 'exp_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
    const payerId = payer_id || currentUser.id;

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`
        INSERT INTO expenses (
          id, description, category, amount, currency, original_amount, original_currency,
          exchange_rate, date, group_id, payer_id, split_type, is_settlement,
          itemized_data, notes, receipt_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      `).run(
        expenseId,
        description.trim(),
        category || 'general',
        numAmount,
        currency || 'USD',
        original_amount ? Number(original_amount) : null,
        original_currency || null,
        exchange_rate ? Number(exchange_rate) : 1.0,
        date || new Date().toISOString().split('T')[0],
        group_id || null,
        payerId,
        split_type || 'equal',
        itemized_data ? JSON.stringify(itemized_data) : null,
        notes || '',
        receiptUrl
      );

      const insertSplit = db.prepare(`
        INSERT INTO expense_splits (id, expense_id, user_id, amount, percentage, shares)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      splits.forEach(s => {
        const splitId = 'spl_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
        insertSplit.run(splitId, expenseId, s.user_id, Number(s.amount), s.percentage || null, s.shares || null);
      });

      // Dispatch notifications
      const payer = db.prepare(`SELECT short_name FROM users WHERE id = ?`).get(payerId);
      const notifyStmt = db.prepare(`
        INSERT INTO notifications (id, user_id, actor_id, expense_id, group_id, message)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      splits.forEach(s => {
        if (s.user_id !== payerId) {
          notifyStmt.run(
            'notif_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
            s.user_id,
            payerId,
            expenseId,
            group_id || null,
            `${payer ? payer.short_name : 'Someone'} added "${description}"`
          );
        }
      });

      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    return sendJson(res, 201, { success: true, expenseId });
  }

  // 6. Settlements Endpoint (Record Cash, UPI with proof, Card)
  if (pathname === '/api/settlements' && req.method === 'POST') {
    const body = await getJsonBody(req);
    const { payer_id, recipient_id, amount, currency, method, group_id, date, upi_id, utr, notes, receipt } = body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return sendJson(res, 400, { success: false, error: 'Valid settlement amount is required' });
    }

    const payerId = payer_id || currentUser.id;
    const recipientId = recipient_id;

    if (!recipientId || payerId === recipientId) {
      return sendJson(res, 400, { success: false, error: 'Payer and recipient cannot be the same' });
    }

    let receiptUrl = null;
    if (receipt) {
      receiptUrl = uploads.saveBase64Image(receipt, 'upi_settle');
    }

    const payer = db.prepare(`SELECT * FROM users WHERE id = ?`).get(payerId);
    const recipient = db.prepare(`SELECT * FROM users WHERE id = ?`).get(recipientId);

    const expenseId = 'exp_settle_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
    const description = `${payer ? payer.short_name : 'Someone'} paid ${recipient ? recipient.short_name : 'Someone'}`;

    let defaultNote = `Recorded payment via ${String(method || 'cash').toUpperCase()}`;
    if (method === 'upi') {
      const upiStr = upi_id ? ` (${upi_id})` : '';
      const utrStr = utr ? ` · Ref/UTR: ${utr}` : '';
      defaultNote = `Recorded payment via UPI${upiStr}${utrStr}`;
    } else if (method === 'card') {
      defaultNote = `Recorded payment via Card (Instant settlement)`;
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`
        INSERT INTO expenses (
          id, description, category, amount, currency, date, group_id, payer_id,
          split_type, is_settlement, payment_method, upi_id, utr, notes, receipt_url
        ) VALUES (?, ?, 'general', ?, ?, ?, ?, ?, 'settlement', 1, ?, ?, ?, ?, ?)
      `).run(
        expenseId,
        description,
        numAmount,
        currency || 'USD',
        date || new Date().toISOString().split('T')[0],
        group_id || null,
        payerId,
        method || 'cash',
        upi_id || null,
        utr || null,
        notes || defaultNote,
        receiptUrl
      );

      // Single split row where debtor is the recipient of the payment
      const splitId = 'spl_settle_' + Date.now();
      db.prepare(`
        INSERT INTO expense_splits (id, expense_id, user_id, amount)
        VALUES (?, ?, ?, ?)
      `).run(splitId, expenseId, recipientId, numAmount);

      // Notification
      db.prepare(`
        INSERT INTO notifications (id, user_id, actor_id, expense_id, group_id, message)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'notif_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
        recipientId,
        payerId,
        expenseId,
        group_id || null,
        `${payer ? payer.short_name : 'Someone'} paid you $${numAmount.toFixed(2)} via ${String(method || 'cash').toUpperCase()}`
      );

      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    return sendJson(res, 201, { success: true, expenseId });
  }

  // 7. Delete Expense
  if (pathname.match(/^\/api\/expenses\/([^/]+)$/) && req.method === 'DELETE') {
    const expenseId = pathname.split('/')[3];
    const exp = db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(expenseId);

    if (!exp) {
      return sendJson(res, 404, { success: false, error: 'Expense not found' });
    }

    // Delete attached receipt file if stored locally
    if (exp.receipt_url) {
      uploads.deleteUploadedFile(exp.receipt_url);
    }

    db.prepare(`DELETE FROM expenses WHERE id = ?`).run(expenseId);
    return sendJson(res, 200, { success: true });
  }

  // 8. Comments
  if (pathname.match(/^\/api\/expenses\/([^/]+)\/comments$/) && req.method === 'POST') {
    const expenseId = pathname.split('/')[3];
    const body = await getJsonBody(req);
    const { text } = body;

    if (!text || !text.trim()) {
      return sendJson(res, 400, { success: false, error: 'Comment text required' });
    }

    const commentId = 'c_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
    db.prepare(`
      INSERT INTO comments (id, expense_id, user_id, text)
      VALUES (?, ?, ?, ?)
    `).run(commentId, expenseId, currentUser.id, text.trim());

    const created = db.prepare(`
      SELECT c.*, u.name, u.short_name, u.avatar, u.color
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(commentId);

    return sendJson(res, 201, { success: true, comment: created });
  }

  // 9. Notifications
  if (pathname === '/api/notifications' && req.method === 'GET') {
    const notifs = db.prepare(`
      SELECT n.*, u.name as actor_name, u.short_name as actor_short_name, u.avatar as actor_avatar, u.color as actor_color
      FROM notifications n
      JOIN users u ON n.actor_id = u.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 30
    `).all(currentUser.id);

    return sendJson(res, 200, { success: true, notifications: notifs });
  }

  if (pathname === '/api/notifications/read' && req.method === 'PUT') {
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(currentUser.id);
    return sendJson(res, 200, { success: true });
  }

  // 10. Analytics (Native Pro)
  if (pathname === '/api/analytics' && req.method === 'GET') {
    let sql = `
      SELECT e.id, e.description, e.category, e.amount, e.date, e.payer_id, s.amount as split_amount
      FROM expenses e
      JOIN expense_splits s ON e.id = s.expense_id
      WHERE (e.payer_id = ? OR s.user_id = ?) AND e.is_settlement = 0
    `;
    const params = [currentUser.id, currentUser.id];

    if (queryParams.groupId) {
      sql += ` AND e.group_id = ? `;
      params.push(queryParams.groupId);
    }

    const rows = db.prepare(sql).all(...params);

    const categoryTotals = {};
    let grandTotal = 0;

    rows.forEach(r => {
      const amt = Number(r.amount) || 0;
      grandTotal += amt;
      const cat = r.category || 'general';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    });

    return sendJson(res, 200, {
      success: true,
      grandTotal: Number(grandTotal.toFixed(2)),
      categoryTotals
    });
  }

  // 404 Route Not Found
  return sendJson(res, 404, { success: false, error: 'Endpoint not found' });
}

module.exports = {
  handleApiRequest
};
