import { describe, it, expect } from 'vitest'
import { recordPayment, getLedgerEntries, checkCreditStatus } from '../src/logic/khata.js'

const contractors = [
  { name: 'Raju Construction', balance: 28400, limit: 50000, lastPaid: '3 days ago', overdue: false },
  { name: 'Suresh Builders', balance: 45200, limit: 40000, lastPaid: '18 days ago', overdue: true },
  { name: 'Mahesh & Sons', balance: 12800, limit: 30000, lastPaid: '1 day ago', overdue: false },
]

const khataCustomers = [
  { name: 'Amit Sharma', balance: 6000, lastPaid: 'Today' },
]

describe('recordPayment', () => {
  it('deducts amount from contractor balance', () => {
    const result = recordPayment(contractors, [], [], 'Raju Construction', 4000, 'cash', '')
    const raju = result.contractors.find(c => c.name === 'Raju Construction')
    expect(raju.balance).toBe(24400) // 28400 - 4000
    expect(raju.lastPaid).toBe('Today')
  })

  it('clamps balance to 0 (no negative)', () => {
    const result = recordPayment(contractors, [], [], 'Raju Construction', 50000, 'upi', 'UPI123')
    const raju = result.contractors.find(c => c.name === 'Raju Construction')
    expect(raju.balance).toBe(0)
  })

  it('clears overdue flag after payment', () => {
    const result = recordPayment(contractors, [], [], 'Suresh Builders', 10000, 'cash', '')
    const suresh = result.contractors.find(c => c.name === 'Suresh Builders')
    expect(suresh.overdue).toBe(false)
  })

  it('records payment in payments array', () => {
    const result = recordPayment(contractors, [], [], 'Raju Construction', 5000, 'cheque', 'CHQ-001')
    expect(result.payments).toHaveLength(1)
    expect(result.payments[0].contractorName).toBe('Raju Construction')
    expect(result.payments[0].amount).toBe(5000)
    expect(result.payments[0].mode).toBe('cheque')
    expect(result.payments[0].ref).toBe('CHQ-001')
  })

  it('returns error for invalid amount', () => {
    const result = recordPayment(contractors, [], [], 'Raju Construction', 0, 'cash', '')
    expect(result.error).toBe('Enter a valid amount')
  })

  it('returns error for negative amount', () => {
    const result = recordPayment(contractors, [], [], 'Raju Construction', -100, 'cash', '')
    expect(result.error).toBe('Enter a valid amount')
  })

  it('preserves other contractors unchanged', () => {
    const result = recordPayment(contractors, [], [], 'Mahesh & Sons', 2000, 'cash', '')
    expect(result.contractors).toHaveLength(3)
    const suresh = result.contractors.find(c => c.name === 'Suresh Builders')
    expect(suresh.balance).toBe(45200) // unchanged
  })

  it('deducts amount from customer khata balance', () => {
    const result = recordPayment([], khataCustomers, [], 'Amit Sharma', 2000, 'cash', '')
    const amit = result.khataCustomers.find(c => c.name === 'Amit Sharma')
    expect(amit.balance).toBe(4000) // 6000 - 2000
    expect(amit.lastPaid).toBe('Today')
  })

  it('clamps customer balance to 0', () => {
    const result = recordPayment([], khataCustomers, [], 'Amit Sharma', 10000, 'upi', 'UPI999')
    const amit = result.khataCustomers.find(c => c.name === 'Amit Sharma')
    expect(amit.balance).toBe(0)
  })

  it('returns error for non-existent name', () => {
    const result = recordPayment(contractors, khataCustomers, [], 'Unknown Person', 100, 'cash', '')
    expect(result.error).toBe('Customer/contractor not found')
  })
})

describe('getLedgerEntries', () => {
  const transactions = [
    { id: 1, customer: 'Raju Construction', contractorName: '', tot: 5000,
      items: [{ name: 'Cement', qty: 10 }],
      createdAt: new Date('2025-06-01T10:00:00').toISOString() },
    { id: 2, customer: 'Walk-in', contractorName: 'Raju Construction', tot: 3000,
      items: [{ name: 'Pipe', qty: 5 }],
      createdAt: new Date('2025-06-05T10:00:00').toISOString() },
    { id: 3, customer: 'Other', contractorName: 'Other', tot: 1000,
      items: [],
      createdAt: new Date('2025-06-10T10:00:00').toISOString() },
  ]

  const payments = [
    { contractorName: 'Raju Construction', amount: 2000, mode: 'cash', ref: '',
      date: new Date('2025-06-03T10:00:00').toISOString() },
  ]

  it('returns combined and sorted entries', () => {
    const entries = getLedgerEntries(transactions, payments, 'Raju Construction')
    expect(entries).toHaveLength(3)
    // sorted by date asc
    expect(entries[0].desc).toContain('Bill #1')
    expect(entries[0].debit).toBe(5000)
    expect(entries[0].credit).toBe(0)
    expect(entries[1].desc).toContain('Payment')
    expect(entries[1].debit).toBe(0)
    expect(entries[1].credit).toBe(2000)
    expect(entries[2].desc).toContain('Bill #2')
    expect(entries[2].debit).toBe(3000)
  })

  it('returns empty array for unknown contractor', () => {
    const entries = getLedgerEntries(transactions, payments, 'Unknown')
    expect(entries).toEqual([])
  })
})

describe('checkCreditStatus', () => {
  it('returns ok for good contractor', () => {
    const result = checkCreditStatus({ name: 'Good', balance: 10000, limit: 50000, overdue: false })
    expect(result.ok).toBe(true)
    expect(result.message).toBe('OK to extend credit')
  })

  it('returns caution when balance > 80% of limit', () => {
    const result = checkCreditStatus({ name: 'Close', balance: 41000, limit: 50000, overdue: false })
    expect(result.ok).toBe(true)
    expect(result.message).toBe('Near limit — caution')
  })

  it('rejects when credit limit reached', () => {
    const result = checkCreditStatus({ name: 'Maxed', balance: 50000, limit: 50000, overdue: false })
    expect(result.ok).toBe(false)
    expect(result.message).toBe('Credit limit reached')
  })

  it('rejects when overdue', () => {
    const result = checkCreditStatus({ name: 'Overdue', balance: 10000, limit: 50000, overdue: true })
    expect(result.ok).toBe(false)
    expect(result.message).toBe('Overdue — do not extend more credit')
  })

  it('returns error for null contractor', () => {
    const result = checkCreditStatus(null)
    expect(result.ok).toBe(false)
    expect(result.message).toBe('Contractor not found')
  })
})
