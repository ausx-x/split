/* ==========================================================================
   Splitwise Initial Seed Data
   Pre-loaded with realistic users, groups, expenses, and activity
   ========================================================================== */

const DEFAULT_SEED_DATA = {
  currentUser: {
    id: "user-1",
    name: "Alex Morgan",
    email: "alex.morgan@example.com",
    avatar: null,
    initials: "AM",
    color: "#5bc5a7",
    currency: "USD",
    symbol: "$"
  },
  users: [
    {
      id: "user-1",
      name: "Alex Morgan (you)",
      shortName: "Alex",
      email: "alex.morgan@example.com",
      avatar: null,
      initials: "AM",
      color: "#5bc5a7"
    },
    {
      id: "user-2",
      name: "Sarah Jenkins",
      shortName: "Sarah",
      email: "sarah.jenkins@example.com",
      avatar: null,
      initials: "SJ",
      color: "#3280ea"
    },
    {
      id: "user-3",
      name: "Dave Miller",
      shortName: "Dave",
      email: "dave.miller@example.com",
      avatar: null,
      initials: "DM",
      color: "#7a52cc"
    },
    {
      id: "user-4",
      name: "Michael Chang",
      shortName: "Mike",
      email: "mike.chang@example.com",
      avatar: null,
      initials: "MC",
      color: "#f5a623"
    },
    {
      id: "user-5",
      name: "Emily Watson",
      shortName: "Emily",
      email: "emily.watson@example.com",
      avatar: null,
      initials: "EW",
      color: "#e74c3c"
    }
  ],
  groups: [
    {
      id: "group-1",
      name: "Apartment 4B",
      type: "Home",
      icon: "🏠",
      members: ["user-1", "user-2", "user-3"],
      whiteboard: "Rent is due on the 1st! Trash night is Tuesday. WiFi password is 'Splitwise2026'."
    },
    {
      id: "group-2",
      name: "Lake Tahoe Trip",
      type: "Trip",
      icon: "✈️",
      members: ["user-1", "user-2", "user-4"],
      whiteboard: "Cabin check-in code: 4920. Remember to bring warm snow jackets and ski passes!"
    },
    {
      id: "group-3",
      name: "Dinner Club",
      type: "Other",
      icon: "🍽️",
      members: ["user-1", "user-3", "user-4", "user-5"],
      whiteboard: "Next meetup at Mario's Trattoria on Friday at 7:30 PM."
    }
  ],
  categories: [
    { id: "groceries", name: "Groceries", icon: "🛒", keywords: ["groceries", "supermarket", "whole foods", "trader joe", "market", "food store"] },
    { id: "dining", name: "Dining Out", icon: "🍽️", keywords: ["dinner", "lunch", "breakfast", "restaurant", "cafe", "sushi", "pizza", "burger", "bistro", "tacos"] },
    { id: "drinks", name: "Drinks", icon: "🍻", keywords: ["drinks", "beer", "bar", "cocktails", "wine", "pub", "coffee", "starbucks", "boba"] },
    { id: "rent", name: "Rent & Mortgage", icon: "🏠", keywords: ["rent", "lease", "mortgage", "housing"] },
    { id: "utilities", name: "Utilities", icon: "💡", keywords: ["wifi", "internet", "power", "electric", "water", "gas bill", "utility", "trash"] },
    { id: "travel", name: "Travel & Transit", icon: "✈️", keywords: ["flight", "hotel", "airbnb", "cabin", "trip", "vacation"] },
    { id: "taxi", name: "Taxi & Rideshare", icon: "🚕", keywords: ["uber", "lyft", "taxi", "cab", "rideshare"] },
    { id: "entertainment", name: "Entertainment", icon: "🎟️", keywords: ["movie", "concert", "tickets", "cinema", "show", "game", "bowling"] },
    { id: "general", name: "General", icon: "🧾", keywords: [] }
  ],
  expenses: [
    {
      id: "exp-1",
      description: "Whole Foods groceries",
      category: "groceries",
      amount: 120.00,
      currency: "USD",
      date: "2026-10-24",
      groupId: "group-1",
      payerId: "user-1", // Alex paid
      splitType: "equal",
      splits: [
        { userId: "user-1", amount: 40.00 },
        { userId: "user-2", amount: 40.00 },
        { userId: "user-3", amount: 40.00 }
      ],
      notes: "Organic vegetables, milk, eggs, pantry staples",
      receipt: null,
      comments: [
        { id: "c-1", userId: "user-2", text: "Thanks for stocking up the fridge!", createdAt: "2026-10-24T18:30:00Z" }
      ],
      createdAt: "2026-10-24T16:00:00Z"
    },
    {
      id: "exp-2",
      description: "High-speed Internet bill",
      category: "utilities",
      amount: 75.00,
      currency: "USD",
      date: "2026-10-22",
      groupId: "group-1",
      payerId: "user-3", // Dave paid
      splitType: "equal",
      splits: [
        { userId: "user-1", amount: 25.00 },
        { userId: "user-2", amount: 25.00 },
        { userId: "user-3", amount: 25.00 }
      ],
      notes: "Gigabit fiber internet for October",
      receipt: null,
      comments: [],
      createdAt: "2026-10-22T11:00:00Z"
    },
    {
      id: "exp-2b",
      description: "Concert tickets (Indie Rock)",
      category: "entertainment",
      amount: 110.00,
      currency: "USD",
      date: "2026-10-21",
      groupId: null,
      friendId: "user-3",
      payerId: "user-3", // Dave paid for Alex & Dave
      splitType: "equal",
      splits: [
        { userId: "user-1", amount: 55.00 },
        { userId: "user-3", amount: 55.00 }
      ],
      notes: "Floor tickets for Saturday night show",
      receipt: null,
      comments: [],
      createdAt: "2026-10-21T18:00:00Z"
    },
    {
      id: "exp-3",
      description: "Cabin rental deposit",
      category: "travel",
      amount: 300.00,
      currency: "USD",
      date: "2026-10-20",
      groupId: "group-2",
      payerId: "user-1", // Alex paid
      splitType: "equal",
      splits: [
        { userId: "user-1", amount: 100.00 },
        { userId: "user-2", amount: 100.00 },
        { userId: "user-4", amount: 100.00 }
      ],
      notes: "Tahoe luxury lakefront chalet booking deposit",
      receipt: null,
      comments: [
        { id: "c-2", userId: "user-4", text: "Place looks incredible!!", createdAt: "2026-10-20T19:40:00Z" }
      ],
      createdAt: "2026-10-20T15:20:00Z"
    },
    {
      id: "exp-4",
      description: "Sushi dinner at Nobu",
      category: "dining",
      amount: 220.00,
      currency: "USD",
      date: "2026-10-18",
      groupId: "group-3",
      payerId: "user-4", // Mike paid
      splitType: "equal",
      splits: [
        { userId: "user-1", amount: 55.00 },
        { userId: "user-3", amount: 55.00 },
        { userId: "user-4", amount: 55.00 },
        { userId: "user-5", amount: 55.00 }
      ],
      notes: "Omakase tasting course and green tea",
      receipt: null,
      comments: [],
      createdAt: "2026-10-18T21:15:00Z"
    },
    {
      id: "exp-5",
      description: "Uber ride to SFO airport",
      category: "taxi",
      amount: 48.00,
      currency: "USD",
      date: "2026-10-15",
      groupId: "group-2",
      payerId: "user-2", // Sarah paid
      splitType: "equal",
      splits: [
        { userId: "user-1", amount: 24.00 },
        { userId: "user-2", amount: 24.00 }
      ],
      notes: "Early morning flight ride",
      receipt: null,
      comments: [],
      createdAt: "2026-10-15T07:45:00Z"
    },
    {
      id: "exp-6",
      description: "Artisan coffee & pastries",
      category: "drinks",
      amount: 16.50,
      currency: "USD",
      date: "2026-10-12",
      groupId: null,
      friendId: "user-2",
      payerId: "user-1", // Alex paid
      splitType: "equal",
      splits: [
        { userId: "user-1", amount: 8.25 },
        { userId: "user-2", amount: 8.25 }
      ],
      notes: "Philz Mint Mojito and croissants",
      receipt: null,
      comments: [],
      createdAt: "2026-10-12T10:15:00Z"
    }
  ],
  notifications: [
    {
      id: "notif-1",
      userId: "user-2",
      message: "Sarah Jenkins commented on 'Whole Foods groceries'",
      time: "2 hours ago",
      unread: true
    },
    {
      id: "notif-2",
      userId: "user-4",
      message: "Michael Chang added 'Sushi dinner at Nobu'",
      time: "2 days ago",
      unread: false
    },
    {
      id: "notif-3",
      userId: "user-3",
      message: "Dave Miller added 'High-speed Internet bill'",
      time: "5 days ago",
      unread: false
    }
  ]
};

if (typeof window !== "undefined") {
  window.DEFAULT_SEED_DATA = DEFAULT_SEED_DATA;
}
if (typeof globalThis !== "undefined") {
  globalThis.DEFAULT_SEED_DATA = DEFAULT_SEED_DATA;
}

