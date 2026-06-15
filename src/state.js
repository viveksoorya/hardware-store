import { DB } from './db.js'

export const SEED_ITEMS = [
  {id:1,name:"GI Pipe",hi:"जीआई पाइप",cat:"Plumbing",unit:"ft",price:85,cost:60,stock:320},
  {id:2,name:"PVC Pipe",hi:"पीवीसी पाइप",cat:"Plumbing",unit:"ft",price:35,cost:22,stock:480},
  {id:3,name:"Copper Wire 2.5mm",hi:"तांबे का तार",cat:"Electrical",unit:"mtr",price:75,cost:55,stock:600},
  {id:4,name:"MCB Switch",hi:"एमसीबी स्विच",cat:"Electrical",unit:"pc",price:180,cost:120,stock:45},
  {id:5,name:"Cement Bag",hi:"सीमेंट",cat:"Construction",unit:"bag",price:380,cost:310,stock:8},
  {id:6,name:"M-Seal",hi:"एम-सील",cat:"Plumbing",unit:"pc",price:65,cost:40,stock:60},
  {id:7,name:'Paint Brush 4"',hi:"पेंट ब्रश",cat:"Paint",unit:"pc",price:90,cost:55,stock:30},
  {id:8,name:"Angle Grinder Disc",hi:"ग्राइंडर डिस्क",cat:"Tools",unit:"pc",price:120,cost:80,stock:3},
  {id:9,name:"3-pin Socket",hi:"सॉकेट",cat:"Electrical",unit:"pc",price:95,cost:60,stock:80},
  {id:10,name:"Nuts & Bolts Set",hi:"नट-बोल्ट",cat:"Fasteners",unit:"set",price:45,cost:25,stock:150},
  {id:11,name:"Plumber Tape",hi:"टेप",cat:"Plumbing",unit:"roll",price:25,cost:12,stock:90},
  {id:12,name:"WD-40 Spray",hi:"डब्ल्यूडी-40",cat:"Tools",unit:"can",price:320,cost:220,stock:2},
  {id:13,name:"Sandpaper",hi:"सैंडपेपर",cat:"Paint",unit:"sheet",price:15,cost:8,stock:200},
  {id:14,name:"Cable Ties",hi:"केबल टाई",cat:"Electrical",unit:"pack",price:55,cost:30,stock:0},
  {id:15,name:"CPVC Elbow",hi:"सीपीवीसी एल्बो",cat:"Plumbing",unit:"pc",price:28,cost:15,stock:180},
]

export const SEED_CONTRACTORS = [
  {name:"Raju Construction",hi:"राजू कंस्ट्रक्शन",balance:28400,limit:50000,lastPaid:"3 days ago",overdue:false},
  {name:"Suresh Builders",hi:"सुरेश बिल्डर्स",balance:45200,limit:40000,lastPaid:"18 days ago",overdue:true},
  {name:"Mahesh & Sons",hi:"महेश एंड संस",balance:12800,limit:30000,lastPaid:"1 day ago",overdue:false},
  {name:"Venkat Electricals",hi:"वेंकट इलेक्ट्रिकल्स",balance:8600,limit:20000,lastPaid:"5 days ago",overdue:false},
  {name:"Ram Plumbers",hi:"राम प्लंबर्स",balance:18900,limit:25000,lastPaid:"22 days ago",overdue:true},
  {name:"Lakshmi Interiors",hi:"लक्ष्मी इंटीरियर्स",balance:10600,limit:20000,lastPaid:"2 days ago",overdue:false},
]

// Internal state (not exported directly)
let _items = []
let _contractors = []
let _transactions = []
let _discountLog = []
let _payments = []
let _expenses = []
let _billCount = 0
let _openingFloat = 0
let _lastEODDate = ''
let _cart = []
let _payMode = 'cash'
let _khataCustomers = []

// --- Getters ---
export function getItems() { return _items }
export function getContractors() { return _contractors }
export function getKhataCustomers() { return _khataCustomers }
export function getTransactions() { return _transactions }
export function getDiscountLog() { return _discountLog }
export function getPayments() { return _payments }
export function getExpenses() { return _expenses }
export function getBillCount() { return _billCount }
export function getOpeningFloat() { return _openingFloat }
export function getCart() { return _cart }
export function getPayMode() { return _payMode }

// --- Setters (auto-save) ---
export function setItems(v) { _items = v; DB.save('items', v) }
export function setContractors(v) { _contractors = v; DB.save('contractors', v) }
export function setKhataCustomers(v) { _khataCustomers = v; DB.save('khataCustomers', v) }
export function setTransactions(v) { _transactions = v; DB.save('transactions', v) }
export function setDiscountLog(v) { _discountLog = v; DB.save('discountLog', v) }
export function setPayments(v) { _payments = v; DB.save('payments', v) }
export function setExpenses(v) { _expenses = v; DB.save('expenses', v) }
export function setBillCount(v) { _billCount = v; DB.save('billCount', v) }
export function setOpeningFloat(v) { _openingFloat = v; DB.save('openingFloat', v); DB.save('lastEODDate', _lastEODDate) }
export function setCart(v) { _cart = v }
export function setPayMode(v) { _payMode = v }

// --- Bulk apply (for logic results) ---
export function applyStateUpdate(u) {
  if (u.items !== undefined) setItems(u.items)
  if (u.contractors !== undefined) setContractors(u.contractors)
  if (u.transactions !== undefined) setTransactions(u.transactions)
  if (u.discountLog !== undefined) setDiscountLog(u.discountLog)
  if (u.billCount !== undefined) setBillCount(u.billCount)
  if (u.payments !== undefined) setPayments(u.payments)
  if (u.expenses !== undefined) setExpenses(u.expenses)
  if (u.openingFloat !== undefined) setOpeningFloat(u.openingFloat)
  if (u.cart !== undefined) setCart(u.cart)
  if (u.khataCustomers !== undefined) setKhataCustomers(u.khataCustomers)
}

// --- Snapshot (for pure logic functions) ---
export function getStateSnapshot() {
  return {
    items: _items,
    contractors: _contractors,
    transactions: _transactions,
    discountLog: _discountLog,
    payments: _payments,
    expenses: _expenses,
    billCount: _billCount,
    openingFloat: _openingFloat,
    cart: _cart,
    payMode: _payMode,
    khataCustomers: _khataCustomers,
  }
}

// --- Derived ---
export function getTodayTotals() {
  const today = new Date().toDateString()
  const todaysTxns = _transactions.filter(t =>
    !t.cancelled && new Date(t.createdAt).toDateString() === today
  )
  return {
    sales: todaysTxns.reduce((s, t) => s + t.tot, 0),
    cash: todaysTxns.filter(t => t.payMode === 'cash').reduce((s, t) => s + t.tot, 0),
    upi: todaysTxns.filter(t => t.payMode === 'upi').reduce((s, t) => s + t.tot, 0),
    khata: todaysTxns.filter(t => t.payMode === 'khata').reduce((s, t) => s + t.tot, 0),
    count: todaysTxns.length,
  }
}

export function getTodayExpenses() {
  const today = new Date().toDateString()
  return _expenses
    .filter(e => new Date(e.date).toDateString() === today)
    .reduce((s, e) => s + e.amount, 0)
}

// --- Init ---
export function initState() {
  _items = DB.load('items', SEED_ITEMS)
  _contractors = DB.load('contractors', SEED_CONTRACTORS)
  _transactions = DB.load('transactions', [])
  _discountLog = DB.load('discountLog', [])
  _payments = DB.load('payments', [])
  _expenses = DB.load('expenses', [])
  _khataCustomers = DB.load('khataCustomers', [])
  _billCount = DB.load('billCount', 0)
  _openingFloat = DB.load('openingFloat', 0)
  _lastEODDate = DB.load('lastEODDate', '')

  const today = new Date().toDateString()
  if (_lastEODDate !== today) {
    _openingFloat = 0
    _lastEODDate = today
    DB.save('openingFloat', 0)
    DB.save('lastEODDate', today)
  }
}
