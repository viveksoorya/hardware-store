// ── Payment recording (pure) ──

export function recordPayment(contractors, khataCustomers, payments, name, amount, mode, ref) {
  if (!amount || amount <= 0) {
    return { contractors, khataCustomers, payments, error: 'Enter a valid amount' }
  }

  const existsInContractors = contractors.some(c => c.name === name)
  const existsInCustomers = khataCustomers.some(c => c.name === name)

  if (!existsInContractors && !existsInCustomers) {
    return { contractors, khataCustomers, payments, error: 'Customer/contractor not found' }
  }

  let newContractors = contractors
  if (existsInContractors) {
    newContractors = contractors.map(c => {
      if (c.name === name) {
        return { ...c, balance: Math.max(0, c.balance - amount), lastPaid: 'Today', overdue: false }
      }
      return c
    })
  }

  let newKhataCustomers = khataCustomers
  if (existsInCustomers) {
    newKhataCustomers = khataCustomers.map(c => {
      if (c.name === name) {
        return { ...c, balance: Math.max(0, c.balance - amount), lastPaid: 'Today' }
      }
      return c
    })
  }

  const newPayment = {
    id: Date.now(),
    contractorName: name,
    amount,
    mode: mode || 'cash',
    ref: ref || '',
    date: new Date().toISOString(),
  }

  return {
    contractors: newContractors,
    khataCustomers: newKhataCustomers,
    payments: [...payments, newPayment],
  }
}

// ── Ledger entries (pure) ──

export function getLedgerEntries(transactions, payments, contractorName) {
  let entries = []

  transactions
    .filter(t => t.customer === contractorName || t.contractorName === contractorName)
    .forEach(t => {
      entries.push({
        date: new Date(t.createdAt),
        desc: 'Bill #' + t.id + ' — ' + (t.items ? t.items.map(i => i.name + '×' + i.qty).join(', ') : ''),
        debit: t.tot,
        credit: 0,
      })
    })

  payments
    .filter(p => p.contractorName === contractorName)
    .forEach(p => {
      entries.push({
        date: new Date(p.date),
        desc: 'Payment (' + p.mode + (p.ref ? ' — ' + p.ref : '') + ')',
        debit: 0,
        credit: p.amount,
      })
    })

  entries.sort((a, b) => a.date - b.date)
  return entries
}

// ── Credit check ──

export function checkCreditStatus(contractor) {
  if (!contractor) return { ok: false, message: 'Contractor not found' }
  if (contractor.overdue) return { ok: false, message: 'Overdue — do not extend more credit' }
  if (contractor.balance >= contractor.limit) return { ok: false, message: 'Credit limit reached' }
  if (contractor.balance / contractor.limit > 0.8) return { ok: true, message: 'Near limit — caution' }
  return { ok: true, message: 'OK to extend credit' }
}
