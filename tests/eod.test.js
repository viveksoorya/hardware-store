import { describe, it, expect, vi } from 'vitest'
import {
  getTodayTotals,
  getTodayExpenses,
  calcEOD,
  addExpense,
} from '../src/logic/eod.js'

function makeTxn(id, payMode, tot, dateOffset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + dateOffset)
  return { id, payMode, tot, cancelled: false, createdAt: d.toISOString() }
}

describe('getTodayTotals', () => {
  it('aggregates today transactions by pay mode', () => {
    const todayTxns = [
      makeTxn(1, 'cash', 1000), makeTxn(2, 'upi', 500),
      makeTxn(3, 'khata', 2000), makeTxn(4, 'cash', 300),
    ]
    const result = getTodayTotals(todayTxns)
    expect(result.sales).toBe(3800)
    expect(result.cash).toBe(1300)
    expect(result.upi).toBe(500)
    expect(result.khata).toBe(2000)
    expect(result.count).toBe(4)
  })

  it('excludes cancelled transactions', () => {
    const txns = [
      makeTxn(1, 'cash', 1000),
      { ...makeTxn(2, 'cash', 500), cancelled: true },
    ]
    const result = getTodayTotals(txns)
    expect(result.sales).toBe(1000)
    expect(result.count).toBe(1)
  })

  it('excludes non-today transactions', () => {
    const txns = [makeTxn(1, 'cash', 1000), makeTxn(2, 'upi', 500, -1)]
    const result = getTodayTotals(txns)
    expect(result.sales).toBe(1000)
    expect(result.count).toBe(1)
  })

  it('returns zero for empty transactions', () => {
    const result = getTodayTotals([])
    expect(result.sales).toBe(0)
    expect(result.cash).toBe(0)
    expect(result.upi).toBe(0)
    expect(result.khata).toBe(0)
    expect(result.count).toBe(0)
  })
})

describe('getTodayExpenses', () => {
  function makeExp(cat, amount, dateOffset = 0) {
    const d = new Date()
    d.setDate(d.getDate() + dateOffset)
    return { cat, amount, date: d.toISOString() }
  }

  it('sums today expenses', () => {
    const expenses = [makeExp('loading', 500), makeExp('chai', 50)]
    expect(getTodayExpenses(expenses)).toBe(550)
  })

  it('excludes non-today expenses', () => {
    const expenses = [makeExp('loading', 500), makeExp('rent', 10000, -2)]
    expect(getTodayExpenses(expenses)).toBe(500)
  })

  it('returns 0 for empty expenses', () => {
    expect(getTodayExpenses([])).toBe(0)
  })
})

describe('calcEOD', () => {
  it('returns ok for matching cash', () => {
    const result = calcEOD(1000, 5000, 300, 5700)
    expect(result.diff).toBe(0)
    expect(result.expected).toBe(5700)
    expect(result.status).toBe('ok')
  })

  it('returns ok for small difference (within tolerance)', () => {
    const result = calcEOD(1000, 5000, 300, 5705)
    expect(result.status).toBe('ok')
    expect(result.diff).toBe(5)
  })

  it('returns shortage when cash is less than expected', () => {
    const result = calcEOD(1000, 5000, 300, 5600)
    expect(result.status).toBe('shortage')
    expect(result.diff).toBe(-100)
    expect(result.message).toContain('Shortage of ₹100')
  })

  it('returns surplus when cash is more than expected', () => {
    const result = calcEOD(1000, 5000, 300, 5800)
    expect(result.status).toBe('surplus')
    expect(result.diff).toBe(100)
    expect(result.message).toContain('Surplus of ₹100')
  })

  it('handles no opening float', () => {
    const result = calcEOD(0, 3000, 200, 2800)
    expect(result.expected).toBe(2800)
    expect(result.diff).toBe(0)
  })
})

describe('addExpense', () => {
  it('adds expense with category and amount', () => {
    const result = addExpense([], 'chai', 50)
    expect(result.expenses).toHaveLength(1)
    expect(result.expenses[0].cat).toBe('chai')
    expect(result.expenses[0].amount).toBe(50)
  })

  it('returns error for zero amount', () => {
    const result = addExpense([], 'chai', 0)
    expect(result.error).toBe('Enter a valid amount')
  })

  it('returns error for negative amount', () => {
    const result = addExpense([], 'chai', -10)
    expect(result.error).toBe('Enter a valid amount')
  })
})
