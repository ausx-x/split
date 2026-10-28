/**
 * Debt Calculation & Simplification Engine
 * Pairwise Netting and Greedy Min-Cash-Flow Debt Simplification
 */

const db = require('./db');

/**
 * Calculates pairwise net balances across all expenses and settlements
 * or optionally filtered by group_id.
 * Returns a matrix map: { [userA_id]: { [userB_id]: netAmount } }
 * Positive value means userB owes userA. Negative means userA owes userB.
 */
function calculatePairwiseMatrix(groupIdFilter = null) {
  let query = `
    SELECT e.id, e.payer_id, e.amount, e.is_settlement, s.user_id as debtor_id, s.amount as split_amount
    FROM expenses e
    JOIN expense_splits s ON e.id = s.expense_id
  `;
  const params = [];
  if (groupIdFilter) {
    query += ` WHERE e.group_id = ? `;
    params.push(groupIdFilter);
  }

  const rows = db.prepare(query).all(...params);
  const matrix = {};

  function ensureUser(uid) {
    if (!matrix[uid]) matrix[uid] = {};
  }

  rows.forEach(row => {
    const payerId = row.payer_id;
    const debtorId = row.debtor_id;
    const splitAmt = Number(row.split_amount) || 0;

    if (payerId === debtorId) return; // Paying for self has no debt effect

    ensureUser(payerId);
    ensureUser(debtorId);

    matrix[payerId][debtorId] = (matrix[payerId][debtorId] || 0) + splitAmt;
    matrix[debtorId][payerId] = (matrix[debtorId][payerId] || 0) - splitAmt;
  });

  return matrix;
}

/**
 * Returns dashboard financial balance summary for a specific user
 */
function getUserDashboardBalances(userId) {
  const matrix = calculatePairwiseMatrix();
  const userPairwise = matrix[userId] || {};

  let youOwe = 0;
  let youAreOwed = 0;
  const friendsYouOwe = [];
  const friendsWhoOweYou = [];

  const getUserStmt = db.prepare(`SELECT id, name, short_name, email, avatar, color, default_currency, upi_id FROM users WHERE id = ?`);

  Object.keys(userPairwise).forEach(otherUserId => {
    const net = userPairwise[otherUserId];
    const otherUser = getUserStmt.get(otherUserId);
    if (!otherUser) return;

    if (net > 0.005) {
      youAreOwed += net;
      friendsWhoOweYou.push({
        user: otherUser,
        amount: Number(net.toFixed(2))
      });
    } else if (net < -0.005) {
      const absVal = Math.abs(net);
      youOwe += absVal;
      friendsYouOwe.push({
        user: otherUser,
        amount: Number(absVal.toFixed(2))
      });
    }
  });

  friendsYouOwe.sort((a, b) => b.amount - a.amount);
  friendsWhoOweYou.sort((a, b) => b.amount - a.amount);

  const totalBalance = youAreOwed - youOwe;

  return {
    totalBalance: Number(totalBalance.toFixed(2)),
    youOwe: Number(youOwe.toFixed(2)),
    youAreOwed: Number(youAreOwed.toFixed(2)),
    friendsYouOwe,
    friendsWhoOweYou
  };
}

/**
 * Calculates net balance between two specific users
 */
function getPairBalance(userAId, userBId) {
  const matrix = calculatePairwiseMatrix();
  if (matrix[userAId] && matrix[userAId][userBId] !== undefined) {
    return Number(matrix[userAId][userBId].toFixed(2));
  }
  return 0.00;
}

/**
 * Greedy Min-Cash-Flow Algorithm for Group Debt Simplification
 */
function getSimplifiedGroupDebts(groupId) {
  const group = db.prepare(`SELECT * FROM groups WHERE id = ?`).get(groupId);
  if (!group) return { memberBalances: {}, transactions: [] };

  const members = db.prepare(`
    SELECT u.id, u.name, u.short_name, u.avatar, u.color
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ?
  `).all(groupId);

  const memberBalances = {};
  members.forEach(m => {
    memberBalances[m.id] = 0;
  });

  const expenses = db.prepare(`
    SELECT e.id, e.payer_id, e.amount, s.user_id as debtor_id, s.amount as split_amount
    FROM expenses e
    JOIN expense_splits s ON e.id = s.expense_id
    WHERE e.group_id = ?
  `).all(groupId);

  expenses.forEach(row => {
    const payerId = row.payer_id;
    const debtorId = row.debtor_id;
    const splitAmt = Number(row.split_amount) || 0;

    if (memberBalances[payerId] !== undefined) {
      memberBalances[payerId] += splitAmt;
    }
    if (memberBalances[debtorId] !== undefined) {
      memberBalances[debtorId] -= splitAmt;
    }
  });

  // Separate into debtors (< 0) and creditors (> 0)
  const debtors = [];
  const creditors = [];

  Object.keys(memberBalances).forEach(mId => {
    const bal = Number(memberBalances[mId].toFixed(2));
    memberBalances[mId] = bal;
    if (bal < -0.005) {
      debtors.push({ userId: mId, amount: Math.abs(bal) });
    } else if (bal > 0.005) {
      creditors.push({ userId: mId, amount: bal });
    }
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const userMap = {};
  members.forEach(m => { userMap[m.id] = m; });

  const transactions = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settledAmount = Math.min(debtor.amount, creditor.amount);

    if (settledAmount > 0.005) {
      transactions.push({
        from: userMap[debtor.userId],
        to: userMap[creditor.userId],
        amount: Number(settledAmount.toFixed(2))
      });
    }

    debtor.amount = Number((debtor.amount - settledAmount).toFixed(2));
    creditor.amount = Number((creditor.amount - settledAmount).toFixed(2));

    if (debtor.amount < 0.005) i++;
    if (creditor.amount < 0.005) j++;
  }

  return {
    memberBalances,
    transactions
  };
}

module.exports = {
  calculatePairwiseMatrix,
  getUserDashboardBalances,
  getPairBalance,
  getSimplifiedGroupDebts
};
