/* ==========================================================================
   Splitwise Central State & Debt Calculation Engine
   ========================================================================== */

class SplitwiseState {
  constructor() {
    this.storageKey = "splitwise_clone_state_v1";
    this.listeners = [];
    this.currentView = "dashboard"; // 'dashboard' | 'activity' | 'all-expenses' | 'group' | 'friend' | 'charts' | 'rent-calculator'
    this.activeId = null; // groupId or friendId when viewing a specific group/friend
    this.state = this.loadState();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to load state from localStorage, falling back to seed", e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_SEED_DATA));
  }

  saveState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (e) {
      console.error("Failed to save state to localStorage", e);
    }
    this.notify();
  }

  resetDemoData() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_SEED_DATA));
    this.saveState();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this.state));
  }

  // --- Getters ---
  getCurrentUser() {
    return this.state.currentUser;
  }

  getUser(userId) {
    return this.state.users.find(u => u.id === userId) || {
      id: userId,
      name: "User",
      shortName: "User",
      initials: "U",
      color: "#999999"
    };
  }

  getGroup(groupId) {
    return this.state.groups.find(g => g.id === groupId);
  }

  getGroups() {
    return this.state.groups;
  }

  getFriends() {
    const currentUserId = this.state.currentUser.id;
    return this.state.users.filter(u => u.id !== currentUserId);
  }

  getExpenses() {
    return [...this.state.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  getExpense(id) {
    return this.state.expenses.find(e => e.id === id);
  }

  // --- Real-time Debt Calculation Engine ---

  /**
   * Calculates pairwise net balance between all users across all expenses,
   * or optionally filtered by a specific groupId.
   * Returns a map: { "userA_id": { "userB_id": netAmount (positive means userB owes userA) } }
   */
  calculatePairwiseDebts(groupIdFilter = null) {
    const matrix = {};
    const users = this.state.users;

    // Initialize pairwise zero balances
    users.forEach(u1 => {
      matrix[u1.id] = {};
      users.forEach(u2 => {
        if (u1.id !== u2.id) {
          matrix[u1.id][u2.id] = 0;
        }
      });
    });

    // Process every expense
    this.state.expenses.forEach(exp => {
      if (groupIdFilter && exp.groupId !== groupIdFilter) return;

      const payerId = exp.payerId;
      if (!exp.splits || !Array.isArray(exp.splits)) return;

      exp.splits.forEach(split => {
        const debtorId = split.userId;
        const amount = Number(split.amount) || 0;

        if (payerId !== debtorId && matrix[payerId] && matrix[debtorId]) {
          // Debtor owes Payer this amount
          matrix[payerId][debtorId] += amount;
          matrix[debtorId][payerId] -= amount;
        }
      });
    });

    return matrix;
  }

  /**
   * Calculates overall net balance summary for current user
   */
  getUserBalances() {
    const currentUserId = this.state.currentUser.id;
    const pairwise = this.calculatePairwiseDebts();

    let youOwe = 0;
    let youAreOwed = 0;
    const friendsYouOwe = [];
    const friendsWhoOweYou = [];

    const currentPairwise = pairwise[currentUserId] || {};

    Object.keys(currentPairwise).forEach(friendId => {
      const net = currentPairwise[friendId];
      const friend = this.getUser(friendId);

      // net > 0 means friend owes you
      // net < 0 means you owe friend
      if (net > 0.005) {
        youAreOwed += net;
        friendsWhoOweYou.push({
          user: friend,
          amount: net
        });
      } else if (net < -0.005) {
        const absVal = Math.abs(net);
        youOwe += absVal;
        friendsYouOwe.push({
          user: friend,
          amount: absVal
        });
      }
    });

    const totalBalance = youAreOwed - youOwe;

    return {
      totalBalance,
      youOwe,
      youAreOwed,
      friendsYouOwe: friendsYouOwe.sort((a, b) => b.amount - a.amount),
      friendsWhoOweYou: friendsWhoOweYou.sort((a, b) => b.amount - a.amount)
    };
  }

  /**
   * Returns 1-on-1 net balance between current user and a specific friend
   */
  getFriendBalance(friendId) {
    const currentUserId = this.state.currentUser.id;
    const pairwise = this.calculatePairwiseDebts();
    return (pairwise[currentUserId] && pairwise[currentUserId][friendId]) || 0;
  }

  /**
   * Computes simplified group debts using Greedy Min-Cash-Flow matching algorithm.
   * Simplifies many transactions into the minimal number of payments between members!
   */
  getSimplifiedGroupDebts(groupId) {
    const group = this.getGroup(groupId);
    if (!group) return [];

    const memberBalances = {};
    group.members.forEach(mId => {
      memberBalances[mId] = 0;
    });

    // Calculate net balance for each member in this group
    this.state.expenses.forEach(exp => {
      if (exp.groupId !== groupId) return;

      const payerId = exp.payerId;
      const totalAmount = Number(exp.amount) || 0;

      if (memberBalances[payerId] !== undefined) {
        memberBalances[payerId] += totalAmount;
      }

      exp.splits.forEach(split => {
        const mId = split.userId;
        const splitAmt = Number(split.amount) || 0;
        if (memberBalances[mId] !== undefined) {
          memberBalances[mId] -= splitAmt;
        }
      });
    });

    // Debtors and Creditors lists
    const debtors = [];
    const creditors = [];

    Object.keys(memberBalances).forEach(mId => {
      const bal = memberBalances[mId];
      if (bal < -0.005) {
        debtors.push({ userId: mId, amount: Math.abs(bal) });
      } else if (bal > 0.005) {
        creditors.push({ userId: mId, amount: bal });
      }
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transactions = [];

    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const settledAmount = Math.min(debtor.amount, creditor.amount);

      if (settledAmount > 0.005) {
        transactions.push({
          from: this.getUser(debtor.userId),
          to: this.getUser(creditor.userId),
          amount: settledAmount
        });
      }

      debtor.amount -= settledAmount;
      creditor.amount -= settledAmount;

      if (debtor.amount < 0.005) i++;
      if (creditor.amount < 0.005) j++;
    }

    return {
      memberBalances,
      transactions
    };
  }

  // --- Mutations ---

  addExpense(expenseData) {
    const newExpense = {
      id: "exp-" + Date.now(),
      description: expenseData.description || "Expense",
      category: expenseData.category || "general",
      amount: Number(expenseData.amount) || 0,
      currency: expenseData.currency || "USD",
      date: expenseData.date || new Date().toISOString().split("T")[0],
      groupId: expenseData.groupId || null,
      friendId: expenseData.friendId || null,
      payerId: expenseData.payerId || this.state.currentUser.id,
      splitType: expenseData.splitType || "equal",
      splits: expenseData.splits || [],
      notes: expenseData.notes || "",
      receipt: expenseData.receipt || null,
      comments: [],
      createdAt: new Date().toISOString()
    };

    this.state.expenses.unshift(newExpense);

    // Add activity record
    const payer = this.getUser(newExpense.payerId);
    let groupOrFriendName = "";
    if (newExpense.groupId) {
      const grp = this.getGroup(newExpense.groupId);
      if (grp) groupOrFriendName = ` in ${grp.name}`;
    }

    this.addNotification({
      userId: newExpense.payerId,
      message: `${payer.shortName} added "${newExpense.description}"${groupOrFriendName}`,
      time: "Just now",
      unread: false
    });

    this.saveState();
    return newExpense;
  }

  updateExpense(id, updatedData) {
    const idx = this.state.expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      this.state.expenses[idx] = {
        ...this.state.expenses[idx],
        ...updatedData
      };
      this.saveState();
      return this.state.expenses[idx];
    }
    return null;
  }

  deleteExpense(id) {
    const exp = this.getExpense(id);
    this.state.expenses = this.state.expenses.filter(e => e.id !== id);

    if (exp) {
      this.addNotification({
        userId: this.state.currentUser.id,
        message: `You deleted "${exp.description}"`,
        time: "Just now",
        unread: false
      });
    }

    this.saveState();
  }

  /**
   * Settle debt by creating a settlement transaction
   */
  settleDebt(payerId, recipientId, amount, method = "cash", groupId = null, extraData = {}) {
    const payer = this.getUser(payerId);
    const recipient = this.getUser(recipientId);

    let defaultNote = `Recorded payment via ${method.toUpperCase()}`;
    if (method === "upi") {
      const upiIdStr = extraData.upiId ? ` (${extraData.upiId})` : "";
      const utrStr = extraData.utr ? ` · Ref/UTR: ${extraData.utr}` : "";
      defaultNote = `Recorded payment via UPI${upiIdStr}${utrStr}`;
    } else if (method === "card") {
      const last4 = extraData.cardLast4 ? ` (ending in ${extraData.cardLast4})` : "";
      defaultNote = `Recorded payment via Card${last4}`;
    }

    const settlementExpense = {
      id: "exp-" + Date.now(),
      description: `${payer.shortName} paid ${recipient.shortName}`,
      category: "general",
      amount: Number(amount),
      currency: "USD",
      date: extraData.date || new Date().toISOString().split("T")[0],
      groupId: groupId,
      isSettlement: true,
      payerId: payerId,
      splitType: "single",
      splits: [
        { userId: recipientId, amount: Number(amount) }
      ],
      notes: extraData.notes || defaultNote,
      receipt: extraData.receipt || null,
      comments: [],
      createdAt: new Date().toISOString()
    };

    this.state.expenses.unshift(settlementExpense);

    this.addNotification({
      userId: payerId,
      message: `${payer.shortName} paid ${recipient.shortName} $${Number(amount).toFixed(2)} via ${method.toUpperCase()}`,
      time: "Just now",
      unread: false
    });

    this.saveState();
    return settlementExpense;
  }


  addGroup(groupData) {
    const newGroup = {
      id: "group-" + Date.now(),
      name: groupData.name || "New Group",
      type: groupData.type || "Other",
      icon: groupData.icon || "🏠",
      members: groupData.members || [this.state.currentUser.id],
      whiteboard: groupData.whiteboard || "Welcome to " + groupData.name + "!"
    };

    this.state.groups.push(newGroup);

    this.addNotification({
      userId: this.state.currentUser.id,
      message: `You created group "${newGroup.name}"`,
      time: "Just now",
      unread: false
    });

    this.saveState();
    return newGroup;
  }

  addFriend(friendData) {
    const newFriend = {
      id: "user-" + Date.now(),
      name: friendData.name || "Friend",
      shortName: friendData.name ? friendData.name.split(" ")[0] : "Friend",
      email: friendData.email || "",
      avatar: null,
      initials: friendData.name ? friendData.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "F",
      color: friendData.color || "#3280ea"
    };

    this.state.users.push(newFriend);

    this.addNotification({
      userId: this.state.currentUser.id,
      message: `You added ${newFriend.name} as a friend`,
      time: "Just now",
      unread: false
    });

    this.saveState();
    return newFriend;
  }

  addComment(expenseId, commentText) {
    const exp = this.getExpense(expenseId);
    if (!exp) return;

    if (!exp.comments) exp.comments = [];
    const newComment = {
      id: "c-" + Date.now(),
      userId: this.state.currentUser.id,
      text: commentText,
      createdAt: new Date().toISOString()
    };

    exp.comments.push(newComment);
    this.saveState();
    return newComment;
  }

  updateWhiteboard(groupId, text) {
    const grp = this.getGroup(groupId);
    if (grp) {
      grp.whiteboard = text;
      this.saveState();
    }
  }

  addNotification(notif) {
    if (!this.state.notifications) this.state.notifications = [];
    this.state.notifications.unshift({
      id: "notif-" + Date.now(),
      ...notif
    });
    if (this.state.notifications.length > 20) {
      this.state.notifications.pop();
    }
  }
}

// Global instance
const store = new SplitwiseState();

if (typeof window !== "undefined") {
  window.store = store;
  window.SplitwiseState = SplitwiseState;
}
if (typeof globalThis !== "undefined") {
  globalThis.store = store;
  globalThis.SplitwiseState = SplitwiseState;
}

