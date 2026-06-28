// ── Totals derivation (pure) ──

export function getTodayTotals(transactions) {
  const today = new Date().toDateString()
  const todaysTxns = transactions.filter(t =>
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

export function getTodayExpenses(expenses) {
  const today = new Date().toDateString()
  return expenses
    .filter(e => new Date(e.date).toDateString() === today)
    .reduce((s, e) => s + e.amount, 0)
}

// ── EOD reconciliation (pure) ──

export function calcEOD(openingFloat, todayCash, todayExpenses, counted) {
  const expected = openingFloat + todayCash - todayExpenses
  const diff = counted - expected
  let status, message

  if (Math.abs(diff) < 10) {
    status = 'ok'
    message = 'All good — cash matches perfectly.'
  } else if (diff < 0) {
    status = 'shortage'
    message = 'Shortage of ₹' + Math.abs(diff) + '. Investigate before closing.'
  } else {
    status = 'surplus'
    message = 'Surplus of ₹' + Math.abs(diff) + '. Check if any bill was entered incorrectly.'
  }

  return { diff, expected, status, message }
}

// ── Expense helpers ──

export function addExpense(expenses, cat, amount) {
  if (!amount || amount <= 0) return { expenses, error: 'Enter a valid amount' }
  return {
    expenses: [...expenses, { id: Date.now(), cat, amount, date: new Date().toISOString() }],
  }
}


