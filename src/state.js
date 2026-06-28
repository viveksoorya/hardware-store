import { DB } from './db.js'

let _config = null
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

export function getConfig() { return _config }

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
export function initState(config) {
  _config = config
  _items = DB.load('items', config.seedItems)
  _contractors = DB.load('contractors', config.seedContractors)
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
