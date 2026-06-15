import {
  getItems, getContractors, getKhataCustomers, getTransactions, getDiscountLog,
  getExpenses, getBillCount, getPayments,
  getCart, getPayMode, getTodayTotals, getTodayExpenses,
  setCart, setPayMode, setOpeningFloat, applyStateUpdate, getStateSnapshot,
} from '../state.js'

import {
  addToCart, changeCartQty, calcTotals, getBillData, applyBill,
  buildReceiptHTML, buildWAMsg, buildReprintHTML,
} from '../logic/billing.js'

import {
  recordPayment, getLedgerEntries,
} from '../logic/khata.js'

import { calcEOD, addExpense as addExpenseLogic, EXPENSE_CATEGORIES } from '../logic/eod.js'

import { filterItems, addItem as addItemLogic, updateItem, CATEGORIES, UNITS } from '../logic/item.js'

let editingItemId = null

// ══════════════════════════════════════════
//  RENDER FUNCTIONS
// ══════════════════════════════════════════

export function renderAll() {
  renderOwnerDash()
  renderItemGrid()
  renderInventory()
  renderKhata()
  renderOwnerContractors()
  renderExpenses()
  populateContractorSelect()
}

// ── Item grid (counter billing) ──

export function renderItemGrid(f) {
  const q = (f || '').toLowerCase()
  const g = document.getElementById('item-grid')
  if (!g) return
  const fl = filterItems(getItems(), q)
  const cart = getCart()
  g.innerHTML = fl.map(i => {
    const inC = cart.find(c => c.id === i.id)
    const dis = i.stock === 0
    return '<div class="itile' + (inC ? ' added' : '') + '"' + (dis ? ' style="opacity:.4;pointer-events:none"' : '') + ' onclick="window.addItem(' + i.id + ')">' +
      '<div class="itile-name">' + i.name + '</div>' +
      '<div class="itile-sub">' + i.hi + '</div>' +
      '<div class="itile-price">₹' + i.price + '/' + i.unit + '</div></div>'
  }).join('')
}

export function filterItemsGrid(v) { renderItemGrid(v) }
window.filterItems = filterItemsGrid

// ── Bill panel ──

export function renderBill() {
  const cont = document.getElementById('bc-items')
  const cart = getCart()
  const { sub, disc, discAmt, tot } = calcTotals(cart, +document.getElementById('bc-disc')?.value || 0)

  document.getElementById('bc-count').textContent = cart.length + ' item' + (cart.length !== 1 ? 's' : '')
  if (cart.length === 0) {
    cont.innerHTML = '<div class="bempty">Add items →</div>'
  } else {
    cont.innerHTML = cart.map(c =>
      '<div class="bitem">' +
      '<div><div class="bitem-name">' + c.name + '</div><div class="bitem-sub">' + c.hi + ' · ₹' + c.price + '/' + c.unit + '</div></div>' +
      '<div style="display:flex;align-items:center;gap:5px;">' +
      '<button class="qbtn" onclick="window.changeQty(' + c.id + ',-1)">−</button>' +
      '<span class="qnum">' + c.qty + '</span>' +
      '<button class="qbtn" onclick="window.changeQty(' + c.id + ',1)">+</button></div>' +
      '<span class="bitem-tot">₹' + (c.price * c.qty) + '</span>' +
      '<span class="bdel" onclick="window.changeQty(' + c.id + ',-99)">×</span></div>'
    ).join('')
  }
  document.getElementById('bc-sub').textContent = '₹' + sub.toLocaleString('en-IN')
  document.getElementById('bc-disc-show').textContent = discAmt > 0 ? '-₹' + discAmt : '₹0'
  document.getElementById('disc-amt').textContent = discAmt > 0 ? '(₹' + discAmt + ' off)' : ''
  document.getElementById('bc-tot').textContent = '₹' + tot.toLocaleString('en-IN')
}

// ── Dashboard / Owner view ──

export function renderOwnerDash() {
  const t = getTodayTotals()
  const contractors = getContractors()
  const totalKhataDue = contractors.reduce((sum, c) => sum + c.balance, 0)
  const todayExp = getTodayExpenses()

  safeText('o-billing', '₹' + t.sales.toLocaleString('en-IN'))
  safeText('o-cash', '₹' + t.cash.toLocaleString('en-IN'))
  safeText('o-upi', '₹' + t.upi.toLocaleString('en-IN'))
  safeText('o-khata-today', '₹' + t.khata.toLocaleString('en-IN'))
  safeText('o-bills', String(t.count))

  const khataTotalEl = document.getElementById('o-khata-total')
  if (khataTotalEl) {
    khataTotalEl.textContent = totalKhataDue >= 10000000
      ? '₹' + (totalKhataDue / 100000).toFixed(1) + 'L'
      : '₹' + totalKhataDue.toLocaleString('en-IN')
  }

  safeText('eod-float', '₹' + getOpeningFloat().toLocaleString('en-IN'))
  safeText('eod-billed', '₹' + t.sales.toLocaleString('en-IN'))
  safeText('eod-upi', '₹' + t.upi.toLocaleString('en-IN'))
  safeText('eod-khata', '₹' + t.khata.toLocaleString('en-IN'))
  safeText('eod-expenses', '-₹' + todayExp.toLocaleString('en-IN'))
  safeText('eod-expected', '₹' + (getOpeningFloat() + t.cash - todayExp).toLocaleString('en-IN'))

  const floatInput = document.getElementById('eod-float-input')
  if (floatInput) floatInput.value = getOpeningFloat() || ''

  recalcEOD()
  renderTxnLog()
  renderDiscLog()
}

function safeText(id, text) {
  const el = document.getElementById(id)
  if (el) el.textContent = text
}

export function renderTxnLog() {
  const w = document.getElementById('owner-txn-wrap')
  if (!w) return
  const today = new Date().toDateString()
  const todaysTxns = getTransactions().filter(t => !t.cancelled && new Date(t.createdAt).toDateString() === today)
  if (todaysTxns.length === 0) {
    w.innerHTML = '<div style="color:var(--hint);font-size:13px;text-align:center;padding:20px;">No bills yet today</div>'
    return
  }
  const payLabel = { cash: '💵 Cash', upi: '📱 UPI', khata: '📒 Khata' }
  w.innerHTML = '<table style="width:100%;border-collapse:collapse;">' +
    '<thead><tr>' +
    '<th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--muted);border-bottom:0.5px solid var(--border);">#</th>' +
    '<th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--muted);border-bottom:0.5px solid var(--border);">Customer</th>' +
    '<th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--muted);border-bottom:0.5px solid var(--border);">Payment</th>' +
    '<th style="text-align:right;padding:8px 10px;font-size:11px;color:var(--muted);border-bottom:0.5px solid var(--border);">Amount</th>' +
    '<th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--muted);border-bottom:0.5px solid var(--border);">Action</th>' +
    '</tr></thead><tbody>' +
    todaysTxns.map(t => '<tr>' +
      '<td style="padding:8px 10px;font-size:13px;border-bottom:0.5px solid var(--border);color:var(--muted);">#' + t.id + '</td>' +
      '<td style="padding:8px 10px;font-size:13px;border-bottom:0.5px solid var(--border);">' + t.customer + '</td>' +
      '<td style="padding:8px 10px;font-size:13px;border-bottom:0.5px solid var(--border);">' + (payLabel[t.payMode] || t.payMode) + (t.disc > 0 ? ' · <span style="color:#A32D2D;font-size:11px;">' + t.disc + '% disc</span>' : '') + '</td>' +
      '<td style="padding:8px 10px;font-size:13px;border-bottom:0.5px solid var(--border);text-align:right;font-weight:500;">₹' + t.tot.toLocaleString('en-IN') + '</td>' +
      '<td style="padding:8px 10px;font-size:13px;border-bottom:0.5px solid var(--border);text-align:center;"><span style="color:var(--hint);font-size:11px;cursor:pointer;" onclick="window.reprintBill(' + t.id + ')">🖨️</span></td>' +
      '</tr>').join('') +
    '</tbody></table>'
}

export function renderDiscLog() {
  const body = document.getElementById('disc-log-body')
  if (!body) return
  const log = getDiscountLog()
  if (log.length === 0) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--hint);padding:20px;">No discounts given yet</td></tr>'
    return
  }
  body.innerHTML = log.map(d => {
    const flagClass = d.pct >= 20 ? 'flag-high' : d.pct >= 10 ? 'flag-mid' : 'flag-ok'
    const flagLabel = d.pct >= 20 ? 'High' : d.pct >= 10 ? 'Review' : 'OK'
    return '<tr>' +
      '<td style="padding:9px 12px;font-size:13px;border-bottom:0.5px solid var(--border);">#' + d.bill + '</td>' +
      '<td style="padding:9px 12px;font-size:13px;border-bottom:0.5px solid var(--border);">' + d.employee + '</td>' +
      '<td style="padding:9px 12px;font-size:13px;border-bottom:0.5px solid var(--border);">' + d.customer + '</td>' +
      '<td style="padding:9px 12px;font-size:13px;border-bottom:0.5px solid var(--border);">₹' + d.amt.toLocaleString('en-IN') + '</td>' +
      '<td style="padding:9px 12px;font-size:13px;border-bottom:0.5px solid var(--border);">₹' + d.disc + '</td>' +
      '<td style="padding:9px 12px;font-size:13px;border-bottom:0.5px solid var(--border);">' + d.pct + '%</td>' +
      '<td style="padding:9px 12px;font-size:13px;border-bottom:0.5px solid var(--border);"><span class="flag ' + flagClass + '">' + flagLabel + '</span></td>' +
      '</tr>'
  }).join('')
}

// ── EOD ──

export function recalcEOD() {
  const t = getTodayTotals()
  const todayExp = getTodayExpenses()
  const { diff, message } = calcEOD(getOpeningFloat(), t.cash, todayExp, +document.getElementById('eod-count')?.value || 0)
  const el = document.getElementById('eod-diff')
  const msg = document.getElementById('eod-msg')
  if (el) {
    el.textContent = (diff >= 0 ? '+' : '') + '₹' + diff.toLocaleString('en-IN')
    el.className = 'eod-val ' + (Math.abs(diff) < 10 ? 'gap-ok' : diff < 0 ? 'gap-bad' : 'gap-ok')
  }
  if (msg) msg.textContent = message
}

export function setFloat(v) {
  setOpeningFloat(+v || 0)
  renderOwnerDash()
}

// ── Expenses ──

export function renderExpenses() {
  const el = document.getElementById('exp-list')
  if (!el) return
  const today = new Date().toDateString()
  const todayExp = getExpenses().filter(e => new Date(e.date).toDateString() === today)
  if (todayExp.length === 0) {
    el.innerHTML = '<div style="color:var(--hint);text-align:center;padding:10px;">No expenses today</div>'
    return
  }
  el.innerHTML = todayExp.map(e =>
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:0.5px solid var(--border);">' +
    '<span style="color:var(--muted);font-size:12px;">' + (EXPENSE_CATEGORIES[e.cat] || e.cat) + '</span>' +
    '<span style="font-weight:500;font-size:13px;">-₹' + e.amount.toLocaleString('en-IN') + '</span></div>'
  ).join('')
}

// ── Inventory ──

export function renderInventory(f) {
  const q = (f || '').toLowerCase()
  const body = document.getElementById('inv-body')
  if (!body) return
  const fl = filterItems(getItems(), q)
  body.innerHTML = fl.map(i => {
    const s = i.stock === 0 ? 'sout' : i.stock <= 5 ? 'slow' : 'sok'
    const sl = i.stock === 0 ? 'Out of stock' : i.stock <= 5 ? 'Low stock' : 'In stock'
    return '<tr style="cursor:pointer;" onclick="window.editItem(' + i.id + ')">' +
      '<td style="font-size:13px;padding:10px 12px;border-bottom:0.5px solid var(--border);">' + i.name + '</td>' +
      '<td style="font-size:12px;color:var(--muted);padding:10px 12px;border-bottom:0.5px solid var(--border);">' + i.hi + '</td>' +
      '<td style="font-size:12px;color:var(--muted);padding:10px 12px;border-bottom:0.5px solid var(--border);">' + i.cat + '</td>' +
      '<td style="padding:10px 12px;border-bottom:0.5px solid var(--border);">' + i.unit + '</td>' +
      '<td style="padding:10px 12px;border-bottom:0.5px solid var(--border);">₹' + i.price + '</td>' +
      '<td style="padding:10px 12px;border-bottom:0.5px solid var(--border);color:var(--muted);">₹' + i.cost + '</td>' +
      '<td style="padding:10px 12px;border-bottom:0.5px solid var(--border);">' + i.stock + '</td>' +
      '<td style="padding:10px 12px;border-bottom:0.5px solid var(--border);"><span class="sbadge ' + s + '">' + sl + '</span></td></tr>'
  }).join('')
  renderAlerts()
}

export function filterInv(v) { renderInventory(v) }
window.filterInv = filterInv

export function renderAlerts() {
  const items = getItems()
  const low = items.filter(i => i.stock === 0 || i.stock <= 5).sort((a, b) => a.stock - b.stock)
  const el = document.getElementById('alert-list')
  if (!el) return
  if (low.length === 0) {
    el.innerHTML = '<div style="color:var(--hint);text-align:center;padding:20px;">No alerts — stock levels are good</div>'
    return
  }
  el.innerHTML = low.map(i =>
    '<div class="khata-card" style="' + (i.stock === 0 ? 'border-color:#E24B4A;' : 'border-color:#EF9F27;') + '">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;">' +
    '<div><div style="font-size:14px;font-weight:500;">' + i.name + ' <span style="font-size:12px;color:var(--muted);">' + i.hi + '</span></div>' +
    '<div style="font-size:12px;color:var(--muted);margin-top:2px;">' + i.cat + ' · ₹' + i.price + '/' + i.unit + '</div></div>' +
    '<span class="sbadge ' + (i.stock === 0 ? 'sout' : 'slow') + '">' + (i.stock === 0 ? 'Out of stock' : 'Only ' + i.stock + ' left') + '</span>' +
    '</div></div>'
  ).join('')
}

// ── Khata ──

export function renderKhata() {
  const el = document.getElementById('khata-list')
  if (!el) return
  const html = []
  getContractors().forEach(c => {
    const pct = c.limit > 0 ? Math.round(c.balance / c.limit * 100) : 0
    const barColor = c.overdue ? '#A32D2D' : pct > 80 ? '#854F0B' : '#185FA5'
    const nameEscaped = c.name.replace(/'/g, "\\'")
    html.push('<div class="khata-card ' + (c.overdue ? 'overdue' : '') + '">' +
      '<div class="khata-head">' +
      '<div class="av" style="background:' + (c.overdue ? 'var(--red-light)' : 'var(--blue-light)') + ';color:' + (c.overdue ? 'var(--red)' : 'var(--blue)') + ';">' + c.name.split(' ').map(w => w[0]).join('').slice(0, 2) + '</div>' +
      '<div style="flex:1">' +
      '<div style="font-size:14px;font-weight:500;">' + c.name + '</div>' +
      '<div style="font-size:12px;color:var(--muted);">' + c.hi + ' · Last paid: ' + c.lastPaid + '</div></div>' +
      (c.overdue ? '<span class="flag flag-high">Overdue</span>' : '') +
      '</div>' +
      '<div style="margin-bottom:8px;">' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:4px;"><span>बाकी (Outstanding)</span><span>₹' + c.balance.toLocaleString('en-IN') + ' / ₹' + c.limit.toLocaleString('en-IN') + '</span></div>' +
      '<div style="height:6px;background:var(--color-border-tertiary);border-radius:3px;overflow:hidden;"><div style="height:6px;width:' + pct + '%;background:' + barColor + ';border-radius:3px;"></div></div>' +
      '</div>' +
      '<div class="khata-stats">' +
      '<div class="ks"><div class="ks-v" style="color:' + (c.overdue ? 'var(--red)' : 'var(--blue)') + ';">₹' + c.balance.toLocaleString('en-IN') + '</div><div class="ks-l">उधार बाकी</div></div>' +
      '<div class="ks"><div class="ks-v">₹' + c.limit.toLocaleString('en-IN') + '</div><div class="ks-l">Credit limit</div></div>' +
      '<div class="ks"><div class="ks-v">' + pct + '%</div><div class="ks-l">Utilised</div></div>' +
      '<div class="ks"><div class="ks-v" style="color:var(--muted);">' + c.lastPaid + '</div><div class="ks-l">Last payment</div></div>' +
      '</div>' +
      '<div style="display:flex;gap:7px;margin-top:10px;">' +
      '<button class="btn-s" style="flex:1;font-size:12px;" onclick="window.showPaymentForm(\'' + nameEscaped + '\')">💰 Record payment</button>' +
      '<button class="btn-s" style="flex:1;font-size:12px;" onclick="window.showContractorLedger(\'' + nameEscaped + '\')">📋 Ledger</button>' +
      '</div></div>')
  })
  getKhataCustomers().forEach(c => {
    const nameEscaped = c.name.replace(/'/g, "\\'")
    html.push('<div class="khata-card">' +
      '<div class="khata-head">' +
      '<div class="av" style="background:var(--green-light);color:var(--green);">' + c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() + '</div>' +
      '<div style="flex:1">' +
      '<div style="font-size:14px;font-weight:500;">' + c.name + ' <span style="font-size:11px;color:var(--muted);">(Customer)</span></div>' +
      '<div style="font-size:12px;color:var(--muted);">Last paid: ' + c.lastPaid + '</div></div>' +
      '</div>' +
      '<div style="margin-bottom:8px;">' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:4px;"><span>उधार बाकी (Outstanding)</span><span>₹' + c.balance.toLocaleString('en-IN') + '</span></div>' +
      '</div>' +
      '<div class="khata-stats">' +
      '<div class="ks"><div class="ks-v" style="color:var(--green);">₹' + c.balance.toLocaleString('en-IN') + '</div><div class="ks-l">उधार बाकी</div></div>' +
      '<div class="ks"><div class="ks-v" style="color:var(--muted);">' + c.lastPaid + '</div><div class="ks-l">Last payment</div></div>' +
      '</div>' +
      '<div style="display:flex;gap:7px;margin-top:10px;">' +
      '<button class="btn-s" style="flex:1;font-size:12px;" onclick="window.showPaymentForm(\'' + nameEscaped + '\')">💰 Record payment</button>' +
      '<button class="btn-s" style="flex:1;font-size:12px;" onclick="window.showContractorLedger(\'' + nameEscaped + '\')">📋 Ledger</button>' +
      '</div></div>')
  })
  if (html.length === 0) {
    html.push('<div style="color:var(--hint);font-size:13px;text-align:center;padding:20px;">No khata entries yet</div>')
  }
  el.innerHTML = html.join('')
}

export function renderOwnerContractors() {
  const el = document.getElementById('owner-contractor-cards')
  if (!el) return
  const all = [
    ...getContractors().map(c => ({ ...c, _type: 'contractor' })),
    ...getKhataCustomers().map(c => ({ ...c, hi: 'Customer khata', _type: 'customer' })),
  ].sort((a, b) => b.balance - a.balance).slice(0, 6)
  el.innerHTML = all.map(c =>
    '<div class="card">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
    '<div class="av" style="background:' + (c._type === 'customer' ? 'var(--green-light)' : c.overdue ? 'var(--red-light)' : 'var(--blue-light)') + ';color:' + (c._type === 'customer' ? 'var(--green)' : c.overdue ? 'var(--red)' : 'var(--blue)') + ';">' + c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() + '</div>' +
    '<div><div style="font-size:13px;font-weight:500;">' + c.name + '</div><div style="font-size:11px;color:var(--muted);">' + (c._type === 'customer' ? 'Customer khata' : c.hi) + '</div></div>' +
    (c.overdue ? '<span class="flag flag-high" style="margin-left:auto;">Overdue</span>' : '') +
    '</div>' +
    '<div style="font-size:20px;font-weight:500;color:' + (c._type === 'customer' ? 'var(--green)' : c.overdue ? 'var(--red)' : 'var(--blue)') + ';">₹' + c.balance.toLocaleString('en-IN') + '</div>' +
    '<div style="font-size:11px;color:var(--muted);margin-top:2px;">Last paid: ' + c.lastPaid + '</div></div>'
  ).join('')
}

export function populateContractorSelect() {
  const sel = document.getElementById('bc-contractor')
  if (!sel) return
  const contractors = getContractors().map(c =>
    '<option value="' + c.name.replace(/"/g, '&quot;') + '">' + c.name + ' (' + c.hi + ')</option>'
  ).join('')
  const customers = getKhataCustomers().map(c =>
    '<option value="' + c.name.replace(/"/g, '&quot;') + '">' + c.name + ' (Customer)</option>'
  ).join('')
  sel.innerHTML = '<option value="">Select contractor / ठेकेदार चुनें</option>' + contractors + customers
}

export function filterKhataSearch(f) {
  const el = document.getElementById('khata-search-results')
  if (!el) return
  const q = (f || '').toLowerCase()
  const all = [
    ...getContractors().map(c => ({ ...c, _type: 'contractor' })),
    ...getKhataCustomers().map(c => ({ ...c, hi: '', limit: 0, overdue: false, _type: 'customer' })),
  ].filter(c => !q || c.name.toLowerCase().includes(q) || c.hi.includes(q))
  if (all.length === 0) {
    el.innerHTML = '<div style="color:var(--hint);font-size:13px;">No match found</div>'
    return
  }
  el.innerHTML = all.map(c =>
    '<div class="khata-card">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;">' +
    '<div><div style="font-size:14px;font-weight:500;">' + c.name + ' <span style="font-size:11px;color:var(--muted);">(' + (c._type === 'customer' ? 'Customer' : c.hi) + ')</span></div></div>' +
    '<div style="text-align:right;">' +
    '<div style="font-size:18px;font-weight:500;color:' + (c._type === 'customer' ? 'var(--green)' : c.overdue ? 'var(--red)' : 'var(--blue)') + ';">₹' + c.balance.toLocaleString('en-IN') + '</div>' +
    '<div style="font-size:11px;color:var(--muted);">' + (c._type === 'customer' ? 'Customer khata' : 'of ₹' + c.limit.toLocaleString('en-IN') + ' limit') + '</div>' +
    '</div></div></div>'
  ).join('')
}


// ── Window-exposed helpers (for HTML onclick/oninput) ──

window.renderBill = renderBill
window.filterKhataSearch = filterKhataSearch

// ══════════════════════════════════════════
//  EVENT HANDLERS
// ══════════════════════════════════════════

// ── Billing ──

window.addItem = function (id) {
  const { cart: newCart, error } = addToCart(getItems(), getCart(), id)
  if (error) { showToast(error); return }
  setCart(newCart)
  renderBill()
  renderItemGrid(document.querySelector('.item-search')?.value)
}

window.changeQty = function (id, delta) {
  const { cart: newCart, error } = changeCartQty(getItems(), getCart(), id, delta)
  if (error) { showToast(error); return }
  setCart(newCart)
  renderBill()
  renderItemGrid(document.querySelector('.item-search')?.value)
}

window.setPayMode = function (m) {
  setPayMode(m)
  ;['cash', 'upi', 'khata'].forEach(x => {
    const b = document.getElementById('ptog-' + x)
    if (b) b.className = 'ptog' + (m === x ? ' ' + x + '-on' : '')
  })
  const upiRef = document.getElementById('bc-upi-ref')
  if (upiRef) upiRef.style.display = m === 'upi' ? 'block' : 'none'
  const contractor = document.getElementById('bc-contractor')
  if (contractor) contractor.style.display = m === 'khata' ? 'block' : 'none'
}

window.printBill = function () {
  const cart = getCart()
  if (cart.length === 0) { showToast('Add items first'); return }

  const name = document.getElementById('bc-cust')?.value || ''
  const phone = document.getElementById('bc-phone')?.value?.trim() || ''
  const upiRef = document.getElementById('bc-upi-ref')?.value?.trim() || ''
  const contractorName = document.getElementById('bc-contractor')?.value || ''
  const discPercent = +document.getElementById('bc-disc')?.value || 0

  const billData = getBillData(cart, { name, phone, upiRef, contractorName, discPercent })
  const payMode = getPayMode()
  const snapshot = getStateSnapshot()
  const newState = applyBill(snapshot, billData, payMode)
  applyStateUpdate(newState)

  const receiptHTML = buildReceiptHTML(billData, newState.billCount, payMode)
  document.getElementById('rcpt-content').innerHTML = receiptHTML
  document.getElementById('overlay').classList.add('on')
  window.clearBill()
  renderAll()
}

window.waBill = function () {
  const cart = getCart()
  if (cart.length === 0) { showToast('Add items first'); return }

  const name = document.getElementById('bc-cust')?.value || ''
  const phone = document.getElementById('bc-phone')?.value?.trim() || ''
  const upiRef = document.getElementById('bc-upi-ref')?.value?.trim() || ''
  const contractorName = document.getElementById('bc-contractor')?.value || ''
  const discPercent = +document.getElementById('bc-disc')?.value || 0

  const billData = getBillData(cart, { name, phone, upiRef, contractorName, discPercent })
  const payMode = getPayMode()
  const snapshot = getStateSnapshot()
  const newState = applyBill(snapshot, billData, payMode)
  applyStateUpdate(newState)

  const msg = buildWAMsg(billData, newState.billCount, payMode)
  sendWA(encodeURIComponent(msg), phone)
  showToast('Opening WhatsApp...')
  window.clearBill()
  renderAll()
}

window.clearBill = function () {
  setCart([])
  const ids = ['bc-cust', 'bc-phone', 'bc-upi-ref', 'bc-contractor']
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
  const disc = document.getElementById('bc-disc')
  if (disc) disc.value = '0'
  renderBill()
  renderItemGrid()
}

window.reprintBill = function (id) {
  const txn = getTransactions().find(t => t.id === id)
  if (!txn) { showToast('Bill not found'); return }
  document.getElementById('rcpt-content').innerHTML = buildReprintHTML(txn)
  document.getElementById('overlay').classList.add('on')
}

window.sendWA = function (msg, phone) {
  const n = (phone || '').replace(/\D/g, '')
  window.open((n ? 'https://wa.me/91' + n : 'https://wa.me/') + '?text=' + msg, '_blank')
}

// ── Overlays ──

window.closeOverlay = function (id) {
  const el = document.getElementById(id)
  if (el) el.classList.remove('on')
}

// ── Item CRUD ──

window.showAddItemForm = function () {
  editingItemId = null
  document.getElementById('item-modal-title').textContent = 'Add item'
  ;['item-name', 'item-hi', 'item-price', 'item-cost', 'item-stock'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.value = ''
  })
  const cat = document.getElementById('item-cat')
  if (cat) cat.value = 'Plumbing'
  const unit = document.getElementById('item-unit')
  if (unit) unit.value = 'pc'
  document.getElementById('item-overlay').classList.add('on')
}

window.editItem = function (id) {
  const item = getItems().find(i => i.id === id)
  if (!item) return
  editingItemId = id
  document.getElementById('item-modal-title').textContent = 'Edit item — ' + item.name
  document.getElementById('item-name').value = item.name
  document.getElementById('item-hi').value = item.hi
  document.getElementById('item-cat').value = item.cat
  document.getElementById('item-unit').value = item.unit
  document.getElementById('item-price').value = item.price
  document.getElementById('item-cost').value = item.cost
  document.getElementById('item-stock').value = item.stock
  document.getElementById('item-overlay').classList.add('on')
}

window.saveItem = function () {
  const name = document.getElementById('item-name')?.value?.trim()
  const hi = document.getElementById('item-hi')?.value?.trim() || ''
  const cat = document.getElementById('item-cat')?.value || 'Misc'
  const unit = document.getElementById('item-unit')?.value || 'pc'
  const price = +document.getElementById('item-price')?.value
  const cost = +document.getElementById('item-cost')?.value || 0
  const stock = +document.getElementById('item-stock')?.value || 0

  if (!name || !price) { showToast('Name and price are required'); return }

  const items = getItems()
  let result
  if (editingItemId) {
    result = updateItem(items, editingItemId, { name, hi, cat, unit, price, cost, stock })
  } else {
    result = addItemLogic(items, { name, hi, cat, unit, price, cost, stock })
  }

  if (result.error) { showToast(result.error); return }
  applyStateUpdate({ items: result.items })
  window.closeOverlay('item-overlay')
  renderInventory()
  renderItemGrid()
}

// ── Khata / Payment ──

window.showPaymentForm = function (name) {
  document.getElementById('pay-contractor-name').textContent = name
  document.getElementById('pay-amount').value = ''
  document.getElementById('pay-mode').value = 'cash'
  document.getElementById('pay-ref').value = ''
  document.getElementById('payment-overlay').classList.add('on')
}

window.recordPayment = function () {
  const name = document.getElementById('pay-contractor-name').textContent
  const amount = +document.getElementById('pay-amount')?.value
  const mode = document.getElementById('pay-mode')?.value || 'cash'
  const ref = document.getElementById('pay-ref')?.value?.trim() || ''

  const result = recordPayment(getContractors(), getKhataCustomers(), getPayments(), name, amount, mode, ref)
  if (result.error) { showToast(result.error); return }
  applyStateUpdate({ contractors: result.contractors, khataCustomers: result.khataCustomers, payments: result.payments })
  window.closeOverlay('payment-overlay')
  renderAll()
  showToast('Payment of ₹' + amount + ' recorded for ' + name)
}

window.showContractorLedger = function (name) {
  const contractor = getContractors().find(c => c.name === name)
  const customer = getKhataCustomers().find(c => c.name === name)
  if (!contractor && !customer) return
  const label = contractor ? (contractor.hi + ' — Full ledger') : 'Customer khata — Full ledger'

  const entries = getLedgerEntries(getTransactions(), getPayments(), name)
  let bal = 0
  const lines = entries.map(e => {
    bal += e.debit - e.credit
    return '<div class="rrow"><span style="font-size:10px;">' + e.date.toLocaleDateString('en-IN') + '</span>' +
      '<span style="flex:1;font-size:11px;padding:0 6px;">' + e.desc + '</span>' +
      '<span style="color:#A32D2D;font-size:11px;width:50px;text-align:right;">' + (e.debit ? '₹' + e.debit : '') + '</span>' +
      '<span style="color:#3B6D11;font-size:11px;width:50px;text-align:right;">' + (e.credit ? '₹' + e.credit : '') + '</span>' +
      '<span style="font-weight:500;font-size:11px;width:55px;text-align:right;">₹' + bal + '</span></div>'
  }).join('')

  const html = '<div class="rcpt-logo"><b>' + name + '</b><small>' + label + '</small></div><hr class="rdiv">' +
    '<div class="rrow" style="font-size:10px;color:var(--muted);"><span>Date</span><span style="flex:1;">Description</span><span style="width:50px;text-align:right;">Bill</span><span style="width:50px;text-align:right;">Paid</span><span style="width:55px;text-align:right;">Balance</span></div>' +
    (lines || '<div style="text-align:center;color:var(--hint);padding:10px;">No transactions</div>') +
    '<div style="display:flex;gap:7px;margin-top:12px;"><button class="rbtn-close" onclick="window.closeOverlay(\'overlay\')">Close</button></div>'

  document.getElementById('rcpt-content').innerHTML = html
  document.getElementById('overlay').classList.add('on')
}

// ── Expenses ──

window.addExpense = function () {
  const cat = document.getElementById('exp-cat')?.value || 'misc'
  const amt = +document.getElementById('exp-amt')?.value
  const result = addExpenseLogic(getExpenses(), cat, amt)
  if (result.error) { showToast(result.error); return }
  applyStateUpdate({ expenses: result.expenses })
  document.getElementById('exp-amt').value = ''
  renderExpenses()
  renderOwnerDash()
}

// ── EOD ──

window.setFloat = function (v) {
  setFloat(v)
}

window.calcEOD = function () {
  recalcEOD()
}

// ── Navigation ──

window.setRole = function (r, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('on'))
  document.querySelectorAll('.rtab').forEach(b => b.classList.remove('on'))
  const view = document.getElementById('view-' + r)
  if (view) view.classList.add('on')
  if (btn) btn.classList.add('on')
}

window.showSub = function (role, tab, btn) {
  document.querySelectorAll('#view-' + role + ' .subtab').forEach(t => t.classList.remove('on'))
  document.querySelectorAll('#view-' + role + ' .snav').forEach(b => b.classList.remove('on'))
  const tabEl = document.getElementById(role + '-' + tab)
  if (tabEl) tabEl.classList.add('on')
  if (btn) btn.classList.add('on')
  if (role === 'counter' && tab === 'check-khata') filterKhataSearch('')
}

// ── Toast ──

export function showToast(msg) {
  const t = document.getElementById('toast')
  if (!t) return
  t.textContent = msg
  t.classList.add('on')
  setTimeout(function () { t.classList.remove('on') }, 2500)
}
window.showToast = showToast
