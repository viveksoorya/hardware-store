import { getConfig } from '../state.js'

// ── Cart operations (pure) ──

export function addToCart(items, cart, itemId) {
  const item = items.find(i => i.id === itemId)
  if (!item) return { cart, error: 'Item not found' }
  if (item.stock === 0) return { cart, error: 'Out of stock' }

  const ex = cart.find(c => c.id === itemId)
  const currentQty = ex ? ex.qty : 0
  if (currentQty + 1 > item.stock) {
    return { cart, error: 'Only ' + item.stock + ' in stock / सिर्फ ' + item.stock + ' बचे हैं' }
  }

  if (ex) {
    return { cart: cart.map(c => c.id === itemId ? { ...c, qty: c.qty + 1 } : c) }
  }
  return { cart: [...cart, { ...item, qty: 1 }] }
}

export function changeCartQty(items, cart, itemId, delta) {
  const cartItem = cart.find(c => c.id === itemId)
  if (!cartItem) return { cart }

  if (delta > 0) {
    const masterItem = items.find(i => i.id === itemId)
    if (masterItem && cartItem.qty + delta > masterItem.stock) {
      return { cart, error: 'Only ' + masterItem.stock + ' in stock / सिर्फ ' + masterItem.stock + ' बचे हैं' }
    }
  }

  const newQty = cartItem.qty + delta
  if (newQty <= 0) {
    return { cart: cart.filter(c => c.id !== itemId) }
  }
  return { cart: cart.map(c => c.id === itemId ? { ...c, qty: newQty } : c) }
}

// ── Totals calculation (pure) ──

export function calcTotals(cart, discPercent) {
  const sub = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const disc = Math.min(50, Math.max(0, discPercent))
  const discAmt = Math.round(sub * disc / 100)
  const tot = sub - discAmt
  return { sub, disc, discAmt, tot }
}

// ── Bill data assembly (pure) ──

export function getBillData(cart, formValues) {
  const { name, phone, upiRef, contractorName, discPercent } = formValues
  const { sub, disc, discAmt, tot } = calcTotals(cart, discPercent)
  return {
    name: name || 'Walk-in',
    phone: phone || '',
    upiRef: upiRef || '',
    contractorName: contractorName || '',
    disc,
    discAmt,
    tot,
    items: cart.map(c => ({ id: c.id, name: c.name, qty: c.qty, price: c.price, cost: c.cost, unit: c.unit })),
  }
}

// ── Apply bill (pure: takes state, returns new state) ──

export function applyBill(state, billData, payMode) {
  const newBillCount = state.billCount + 1

  const newItems = state.items.map(item => {
    const inCart = state.cart.find(c => c.id === item.id)
    return inCart ? { ...item, stock: item.stock - inCart.qty } : item
  })

  const newContractors = state.contractors.map(c => {
    if (payMode === 'khata' && c.name === billData.contractorName) {
      return { ...c, balance: c.balance + billData.tot, lastPaid: 'Today', overdue: false }
    }
    return c
  })

  let newKhataCustomers = state.khataCustomers
  if (payMode === 'khata') {
    if (billData.contractorName) {
      const existingCustomer = newKhataCustomers.find(c => c.name === billData.contractorName)
      if (existingCustomer) {
        newKhataCustomers = newKhataCustomers.map(c =>
          c.name === billData.contractorName
            ? { ...c, balance: c.balance + billData.tot, lastPaid: 'Today' }
            : c
        )
      }
    } else if (billData.name !== 'Walk-in') {
      const existingCustomer = newKhataCustomers.find(c => c.name === billData.name)
      if (existingCustomer) {
        newKhataCustomers = newKhataCustomers.map(c =>
          c.name === billData.name
            ? { ...c, balance: c.balance + billData.tot, lastPaid: 'Today' }
            : c
        )
      } else {
        newKhataCustomers = [...newKhataCustomers, {
          name: billData.name,
          balance: billData.tot,
          lastPaid: 'Today',
        }]
      }
    }
  }

  const transaction = {
    id: newBillCount,
    customer: billData.name,
    phone: billData.phone,
    payMode,
    tot: billData.tot,
    disc: billData.disc,
    discAmt: billData.discAmt,
    contractorName: billData.contractorName || '',
    items: billData.items.map(c => ({ id: c.id, name: c.name, qty: c.qty, price: c.price, cost: c.cost, unit: c.unit })),
    createdAt: new Date().toISOString(),
    cancelled: false,
  }

  let newDiscountLog = state.discountLog
  if (billData.disc > 0) {
    newDiscountLog = [...state.discountLog, {
      bill: newBillCount,
      employee: 'Rajesh (Counter)',
      customer: billData.name,
      amt: billData.tot + billData.discAmt,
      disc: billData.discAmt,
      pct: billData.disc,
    }]
  }

  return {
    ...state,
    items: newItems,
    contractors: newContractors,
    khataCustomers: newKhataCustomers,
    transactions: [...state.transactions, transaction],
    discountLog: newDiscountLog,
    billCount: newBillCount,
    cart: [],
  }
}

// ── Receipt builders (pure)  ──

function shopInfo() {
  const cfg = getConfig()
  return { name: cfg?.name || 'Shop', tagline: cfg?.tagline || '' }
}

export function buildReceiptHTML(d, billCount, payMode) {
  const now = new Date()
  const t = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const dt = now.toLocaleDateString('en-IN')
  const pm = { cash: '💵 Cash', upi: '📱 UPI', khata: '📒 Khata / उधार' }
  const info = shopInfo()
  return '<div class="rcpt-logo"><b>' + info.name + '</b><small>' + info.tagline + '</small></div>' +
    '<hr class="rdiv">' +
    '<div class="rrow"><span><b>' + d.name + '</b></span><span style="color:#7A6A55;">Bill #' + billCount + '</span></div>' +
    '<div class="rrow" style="color:#7A6A55;font-size:11px;"><span>' + dt + ', ' + t + '</span><span>' + (pm[payMode] || payMode) + '</span></div>' +
    '<hr class="rdiv">' +
    d.items.map(c => '<div class="rrow"><span>' + c.name + ' × ' + c.qty + ' ' + (c.unit || '') + '</span><span>₹' + (c.price * c.qty) + '</span></div>').join('') +
    (d.discAmt > 0 ? '<div class="rrow" style="color:#A32D2D;"><span>Discount (' + d.disc + '%)</span><span>-₹' + d.discAmt + '</span></div>' : '') +
    '<div class="rtot"><span>Total</span><span style="color:' + (getConfig()?.theme?.['--primary'] || '#185FA5') + ';">₹' + d.tot.toLocaleString('en-IN') + '</span></div>' +
    (payMode === 'upi' && d.upiRef ? '<div class="rrow" style="color:#7A6A55;font-size:11px;margin-top:4px;"><span>UPI Ref</span><span>' + d.upiRef + '</span></div>' : '') +
    '<div class="rfooter">Thank you for your business<br>धन्यवाद 🙏</div>' +
    '<div class="rbtns">' +
    '<button class="rbtn-close" onclick="window.closeOverlay(\'overlay\')">Done</button>' +
    '<button class="rbtn-wa" onclick="window.sendWA(\'' + encodeURIComponent(buildWAMsg(d, billCount, payMode)) + '\',\'' + d.phone + '\')">📲 WhatsApp</button></div>'
}

export function buildWAMsg(d, billCount, payMode) {
  const pm = { cash: 'Cash', upi: 'UPI' + (d.upiRef ? ' (Ref: ' + d.upiRef + ')' : ''), khata: 'Khata / उधार' }
  const lines = d.items.map(c => '  ' + c.name + ' × ' + c.qty + ' ' + (c.unit || '') + ' — ₹' + (c.price * c.qty)).join('\n')
  const info = shopInfo()
  return '* ' + info.name + '*\n' + info.tagline + '\n\nBill #' + billCount + ' | ' + new Date().toLocaleDateString('en-IN') +
    '\nCustomer: *' + d.name + '*\n\n' + lines +
    (d.discAmt > 0 ? '\n  Discount (' + d.disc + '%) — -₹' + d.discAmt : '') +
    '\n\n*Total: ₹' + d.tot.toLocaleString('en-IN') + '*\nPayment: ' + (pm[payMode] || payMode) +
    '\n\nThank you! धन्यवाद 🙏'
}

export function buildReprintHTML(txn) {
  const date = new Date(txn.createdAt)
  const pm = { cash: '💵 Cash', upi: '📱 UPI', khata: '📒 Khata / उधार' }
  const info = shopInfo()
  return '<div class="rcpt-logo"><b>' + info.name + '</b><small>' + info.tagline + '</small></div>' +
    '<div class="rrow"><span style="color:#7A6A55;font-size:11px;">Reprint from ' + date.toLocaleDateString('en-IN') + '</span></div>' +
    '<hr class="rdiv">' +
    '<div class="rrow"><span><b>' + txn.customer + '</b></span><span style="color:#7A6A55;">Bill #' + txn.id + '</span></div>' +
    '<hr class="rdiv">' +
    (txn.items || []).map(c => '<div class="rrow"><span>' + c.name + ' × ' + c.qty + '</span><span>₹' + (c.price * c.qty) + '</span></div>').join('') +
    (txn.discAmt > 0 ? '<div class="rrow" style="color:#A32D2D;"><span>Discount</span><span>-₹' + txn.discAmt + '</span></div>' : '') +
    '<div class="rtot"><span>Total</span><span style="color:' + (getConfig()?.theme?.['--primary'] || '#185FA5') + ';">₹' + txn.tot.toLocaleString('en-IN') + '</span></div>' +
    '<div class="rrow" style="color:#7A6A55;font-size:11px;">' + (pm[txn.payMode] || txn.payMode) + '</div>' +
    '<div class="rbtns"><button class="rbtn-close" onclick="window.closeOverlay(\'overlay\')">Close</button></div>'
}
