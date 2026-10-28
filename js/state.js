/* ==========================================================================
   Splitwise Reactive API Client Store
   Replaces localStorage with Persistent REST API & SQLite Backend
   ========================================================================== */

class SplitwiseState {
  constructor() {
    this.storageKey = 'splitwise_auth_token';
    this.token = localStorage.getItem(this.storageKey) || null;
    this.currentUser = null;
    this.listeners = [];

    // Cached client state
    this.state = {
      dashboard: {
        totalBalance: 0,
        youOwe: 0,
        youAreOwed: 0,
        friendsYouOwe: [],
        friendsWhoOweYou: []
      },
      friends: [],
      groups: [],
      expenses: [],
      notifications: []
    };
  }

  // --- Core API Fetcher ---
  async api(endpoint, options = {}) {
    const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const res = await fetch(url, {
        ...options,
        headers
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/register')) {
          this.handleUnauthorized();
        }
        throw new Error(data.error || `HTTP ${res.status}: Request failed`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on ${url}:`, err);
      throw err;
    }
  }

  handleUnauthorized() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem(this.storageKey);
    const loginModal = document.getElementById('login-page-wrapper');
    if (loginModal) loginModal.classList.add('active');
    this.notify();
  }

  // --- Subscriptions ---
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => {
      try { fn(this.state); } catch (e) { console.error('Listener error:', e); }
    });
  }

  // --- Initialization & Boot ---
  async init() {
    if (!this.token) {
      this.handleUnauthorized();
      return false;
    }

    try {
      const res = await this.api('/api/auth/me');
      this.currentUser = res.user;
      await this.refreshAll();
      const loginModal = document.getElementById('login-page-wrapper');
      if (loginModal) loginModal.classList.remove('active');
      return true;
    } catch (err) {
      this.handleUnauthorized();
      return false;
    }
  }

  // --- Refresh All Entities ---
  async refreshAll() {
    if (!this.currentUser) return;

    try {
      const [dashRes, friendsRes, groupsRes, expensesRes, notifsRes] = await Promise.all([
        this.api('/api/dashboard'),
        this.api('/api/friends'),
        this.api('/api/groups'),
        this.api('/api/expenses'),
        this.api('/api/notifications')
      ]);

      this.state.dashboard = {
        totalBalance: dashRes.totalBalance || 0,
        youOwe: dashRes.youOwe || 0,
        youAreOwed: dashRes.youAreOwed || 0,
        friendsYouOwe: dashRes.friendsYouOwe || [],
        friendsWhoOweYou: dashRes.friendsWhoOweYou || []
      };

      this.state.friends = friendsRes.friends || [];
      this.state.groups = groupsRes.groups || [];
      this.state.expenses = expensesRes.expenses || [];
      this.state.notifications = notifsRes.notifications || [];

      this.notify();
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  }

  // --- Authentication Actions ---
  async register({ name, email, password, default_currency, upi_id }) {
    const res = await this.api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, default_currency, upi_id })
    });

    this.token = res.token;
    this.currentUser = res.user;
    localStorage.setItem(this.storageKey, this.token);
    await this.refreshAll();

    const loginModal = document.getElementById('login-page-wrapper');
    if (loginModal) loginModal.classList.remove('active');

    return res.user;
  }

  async login({ email, password }) {
    const res = await this.api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    this.token = res.token;
    this.currentUser = res.user;
    localStorage.setItem(this.storageKey, this.token);
    await this.refreshAll();

    const loginModal = document.getElementById('login-page-wrapper');
    if (loginModal) loginModal.classList.remove('active');

    return res.user;
  }

  async logout() {
    try {
      if (this.token) {
        await this.api('/api/auth/logout', { method: 'POST' });
      }
    } catch (e) {}

    this.handleUnauthorized();
  }

  // --- Getters ---
  getCurrentUser() {
    return this.currentUser || {
      id: 'guest',
      name: 'User',
      short_name: 'User',
      email: '',
      color: '#5bc5a7',
      default_currency: 'USD'
    };
  }

  getUser(userId) {
    if (this.currentUser && this.currentUser.id === userId) {
      return this.currentUser;
    }
    const friend = this.state.friends.find(f => f.id === userId);
    if (friend) return friend;

    for (const g of this.state.groups) {
      const m = g.members && g.members.find(u => u.id === userId);
      if (m) return m;
    }

    return {
      id: userId,
      name: 'User',
      short_name: 'User',
      avatar: null,
      color: '#999999'
    };
  }

  getGroup(groupId) {
    return this.state.groups.find(g => g.id === groupId) || null;
  }

  getGroups() {
    return this.state.groups;
  }

  getFriends() {
    return this.state.friends;
  }

  getExpenses() {
    return this.state.expenses;
  }

  getExpense(id) {
    return this.state.expenses.find(e => e.id === id) || null;
  }

  getUserBalances() {
    return this.state.dashboard;
  }

  getFriendBalance(friendId) {
    const friend = this.state.friends.find(f => f.id === friendId);
    return friend ? (friend.balance || 0) : 0;
  }

  getSimplifiedGroupDebts(groupId) {
    const group = this.getGroup(groupId);
    if (!group) return { memberBalances: {}, transactions: [] };

    const memberBalances = {};
    if (group.members) {
      group.members.forEach(m => { memberBalances[m.id] = 0; });
    }

    const groupExpenses = this.state.expenses.filter(e => e.group_id === groupId);

    groupExpenses.forEach(exp => {
      const payerId = exp.payer_id;
      const totalAmount = Number(exp.amount) || 0;

      if (memberBalances[payerId] !== undefined) {
        memberBalances[payerId] += totalAmount;
      }

      if (exp.splits) {
        exp.splits.forEach(split => {
          const mId = split.user_id;
          const splitAmt = Number(split.amount) || 0;
          if (memberBalances[mId] !== undefined) {
            memberBalances[mId] -= splitAmt;
          }
        });
      }
    });

    const debtors = [];
    const creditors = [];

    Object.keys(memberBalances).forEach(mId => {
      const bal = Number(memberBalances[mId].toFixed(2));
      memberBalances[mId] = bal;
      if (bal < -0.005) debtors.push({ userId: mId, amount: Math.abs(bal) });
      else if (bal > 0.005) creditors.push({ userId: mId, amount: bal });
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const userMap = {};
    if (group.members) {
      group.members.forEach(m => { userMap[m.id] = m; });
    }

    const transactions = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const settled = Math.min(debtor.amount, creditor.amount);

      if (settled > 0.005) {
        transactions.push({
          from: userMap[debtor.userId] || { shortName: 'Member' },
          to: userMap[creditor.userId] || { shortName: 'Member' },
          amount: Number(settled.toFixed(2))
        });
      }

      debtor.amount -= settled;
      creditor.amount -= settled;
      if (debtor.amount < 0.005) i++;
      if (creditor.amount < 0.005) j++;
    }

    return { memberBalances, transactions };
  }

  // --- Data Mutations via REST API ---
  async addExpense(payload) {
    const res = await this.api('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await this.refreshAll();
    return res;
  }

  async settleDebt(payerId, recipientId, amount, method = 'cash', groupId = null, extraData = {}) {
    const res = await this.api('/api/settlements', {
      method: 'POST',
      body: JSON.stringify({
        payer_id: payerId,
        recipient_id: recipientId,
        amount: Number(amount),
        method,
        group_id: groupId,
        date: extraData.date,
        upi_id: extraData.upiId,
        utr: extraData.utr,
        notes: extraData.notes,
        receipt: extraData.receipt
      })
    });
    await this.refreshAll();
    return res;
  }

  async deleteExpense(expenseId) {
    await this.api(`/api/expenses/${expenseId}`, { method: 'DELETE' });
    await this.refreshAll();
  }

  async addGroup(groupData) {
    const res = await this.api('/api/groups', {
      method: 'POST',
      body: JSON.stringify(groupData)
    });
    await this.refreshAll();
    return res.group;
  }

  async updateWhiteboard(groupId, text) {
    const res = await this.api(`/api/groups/${groupId}/whiteboard`, {
      method: 'PUT',
      body: JSON.stringify({ whiteboard: text })
    });
    const grp = this.getGroup(groupId);
    if (grp) grp.whiteboard = text;
    this.notify();
    return res;
  }

  async addFriend(friendData) {
    const res = await this.api('/api/friends/add', {
      method: 'POST',
      body: JSON.stringify(friendData)
    });
    await this.refreshAll();
    return res.friend;
  }

  async addComment(expenseId, commentText) {
    const res = await this.api(`/api/expenses/${expenseId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text: commentText })
    });
    const exp = this.getExpense(expenseId);
    if (exp) {
      if (!exp.comments) exp.comments = [];
      exp.comments.push(res.comment);
    }
    this.notify();
    return res.comment;
  }

  async markNotificationsRead() {
    await this.api('/api/notifications/read', { method: 'PUT' });
    this.state.notifications.forEach(n => { n.is_read = 1; });
    this.notify();
  }
}

// Global Store Instance
const store = new SplitwiseState();

if (typeof window !== 'undefined') {
  window.store = store;
  window.SplitwiseState = SplitwiseState;
}
