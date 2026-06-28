import { describe, it, expect } from 'vitest'
import {
  addToCart,
  changeCartQty,
  calcTotals,
  getBillData,
  applyBill,
  buildReceiptHTML,
  buildWAMsg,
  buildReprintHTML,
} from '../src/logic/billing.js'

const items = [
  { id: 1, name: 'Pipe', hi: 'पाइप', cat: 'Plumbing', unit: 'ft', price: 85, cost: 60, stock: 10 },
  { id: 2, name: 'Switch', hi: 'स्विच', cat: 'Electrical', unit: 'pc', price: 180, cost: 120, stock: 3 },
  { id: 3, name: 'M-Seal', hi: 'एम-सील', cat: 'Plumbing', unit: 'pc', price: 65, cost: 40, stock: 60 },
  { id: 4, name: 'Out of Stock Item', hi: 'खत्म', cat: 'Tools', unit: 'pc', price: 100, cost: 50, stock: 0 },
]

describe('addToCart', () => {
  it('adds new item to empty cart', () => {
    const result = addToCart(items, [], 1)
    expect(result.error).toBeUndefined()
    expect(result.cart).toHaveLength(1)
    expect(result.cart[0].id).toBe(1)
    expect(result.cart[0].qty).toBe(1)
  })

  it('increments qty if item already in cart', () => {
    const cart = [{ id: 1, name: 'Pipe', price: 85, cost: 60, qty: 1 }]
    const result = addToCart(items, cart, 1)
    expect(result.cart).toHaveLength(1)
    expect(result.cart[0].qty).toBe(2)
  })

  it('returns error for non-existent item', () => {
    const result = addToCart(items, [], 999)
    expect(result.error).toBe('Item not found')
  })

  it('returns error when item out of stock', () => {
    const result = addToCart(items, [], 4)
    expect(result.error).toBe('Out of stock')
  })

  it('returns error when adding beyond stock', () => {
    const cart = [{ id: 2, name: 'Switch', price: 180, cost: 120, qty: 3 }]
    const result = addToCart(items, cart, 2)
    expect(result.error).toContain('Only 3 in stock')
  })

  it('stores full item data in cart entry', () => {
    const result = addToCart(items, [], 3)
    expect(result.cart[0]).toMatchObject({
      id: 3, name: 'M-Seal', price: 65, cost: 40, unit: 'pc', qty: 1,
    })
  })
})

describe('changeCartQty', () => {
  it('increases qty by delta', () => {
    const cart = [{ id: 1, name: 'Pipe', price: 85, cost: 60, qty: 2 }]
    const result = changeCartQty(items, cart, 1, 3)
    expect(result.cart[0].qty).toBe(5)
  })

  it('removes item when qty reaches 0 or less', () => {
    const cart = [{ id: 1, name: 'Pipe', price: 85, cost: 60, qty: 2 }]
    const result = changeCartQty(items, cart, 1, -2)
    expect(result.cart).toHaveLength(0)
  })

  it('returns error when increasing beyond stock', () => {
    const cart = [{ id: 2, name: 'Switch', price: 180, cost: 120, qty: 2 }]
    const result = changeCartQty(items, cart, 2, 2)
    expect(result.error).toContain('Only 3 in stock')
  })

  it('does nothing for non-existent cart item', () => {
    const cart = [{ id: 1, name: 'Pipe', price: 85, cost: 60, qty: 2 }]
    const result = changeCartQty(items, cart, 999, 1)
    expect(result.cart).toBe(cart)
  })

  it('decrements by 1 when delta is -1', () => {
    const cart = [{ id: 3, name: 'M-Seal', price: 65, cost: 40, qty: 5 }]
    const result = changeCartQty(items, cart, 3, -1)
    expect(result.cart[0].qty).toBe(4)
  })
})

describe('calcTotals', () => {
  it('calculates subtotal, discount and total', () => {
    const cart = [
      { name: 'Pipe', price: 85, qty: 2 },
      { name: 'Switch', price: 180, qty: 1 },
    ]
    const result = calcTotals(cart, 10)
    expect(result.sub).toBe(350)
    expect(result.disc).toBe(10)
    expect(result.discAmt).toBe(35)
    expect(result.tot).toBe(315)
  })

  it('clamps discount to 0-50 range', () => {
    const cart = [{ name: 'Pipe', price: 100, qty: 1 }]
    expect(calcTotals(cart, -5).disc).toBe(0)
    expect(calcTotals(cart, 75).disc).toBe(50)
  })

  it('returns zero for empty cart', () => {
    const result = calcTotals([], 0)
    expect(result.sub).toBe(0)
    expect(result.discAmt).toBe(0)
    expect(result.tot).toBe(0)
  })

  it('rounds discount amount to integer', () => {
    const cart = [{ name: 'Pipe', price: 99, qty: 1 }]
    const result = calcTotals(cart, 10)
    expect(result.discAmt).toBe(10)
    expect(result.tot).toBe(89)
  })
})

describe('getBillData', () => {
  it('assembles bill data from cart and form values', () => {
    const cart = [{ id: 1, name: 'Pipe', price: 85, cost: 60, qty: 2, unit: 'ft' }]
    const formValues = {
      name: 'Amit', phone: '9876543210', upiRef: 'UPI123',
      contractorName: '', discPercent: 5,
    }
    const data = getBillData(cart, formValues)
    expect(data.name).toBe('Amit')
    expect(data.tot).toBe(161) // 170 - Math.round(8.5) = 161
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toEqual({ id: 1, name: 'Pipe', qty: 2, price: 85, cost: 60, unit: 'ft' })
  })

  it('defaults name to Walk-in', () => {
    const cart = [{ id: 1, name: 'Pipe', price: 85, cost: 60, qty: 1 }]
    const data = getBillData(cart, { name: '', phone: '', upiRef: '', contractorName: '', discPercent: 0 })
    expect(data.name).toBe('Walk-in')
  })
})

describe('applyBill', () => {
  const baseState = {
    items: [
      { id: 1, name: 'Pipe', price: 85, cost: 60, stock: 10 },
      { id: 2, name: 'Switch', price: 180, cost: 120, stock: 3 },
    ],
    contractors: [
      { name: 'Raju Construction', balance: 10000, limit: 50000, lastPaid: '2 days ago', overdue: false },
    ],
    khataCustomers: [
      { name: 'Amit Sharma', balance: 3000, lastPaid: 'Yesterday' },
    ],
    transactions: [],
    discountLog: [],
    billCount: 0,
    cart: [{ id: 1, name: 'Pipe', price: 85, cost: 60, unit: 'ft', qty: 2 }],
  }

  const billData = {
    name: 'Amit', phone: '', upiRef: '', contractorName: '',
    disc: 0, discAmt: 0, tot: 170,
    items: [{ id: 1, name: 'Pipe', qty: 2, price: 85, cost: 60, unit: 'ft' }],
  }

  it('decrements stock for billed items', () => {
    const result = applyBill(baseState, billData, 'cash')
    expect(result.items[0].stock).toBe(8) // 10 - 2
    expect(result.items[1].stock).toBe(3) // unchanged
  })

  it('increments billCount and clears cart', () => {
    const result = applyBill(baseState, billData, 'cash')
    expect(result.billCount).toBe(1)
    expect(result.cart).toEqual([])
  })

  it('adds transaction entry', () => {
    const result = applyBill(baseState, billData, 'cash')
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].customer).toBe('Amit')
    expect(result.transactions[0].payMode).toBe('cash')
    expect(result.transactions[0].tot).toBe(170)
    expect(result.transactions[0].id).toBe(1)
    expect(result.transactions[0].cancelled).toBe(false)
  })

  it('adds contractor balance for khata payment', () => {
    const khataData = { ...billData, tot: 5000, contractorName: 'Raju Construction' }
    const result = applyBill(baseState, khataData, 'khata')
    const raju = result.contractors.find(c => c.name === 'Raju Construction')
    expect(raju.balance).toBe(15000) // 10000 + 5000
    expect(raju.lastPaid).toBe('Today')
  })

  it('adds customer khata balance for existing customer', () => {
    const custData = { ...billData, name: 'Amit Sharma', tot: 2000, contractorName: '' }
    const result = applyBill(baseState, custData, 'khata')
    const amit = result.khataCustomers.find(c => c.name === 'Amit Sharma')
    expect(amit.balance).toBe(5000) // 3000 + 2000
    expect(amit.lastPaid).toBe('Today')
  })

  it('creates new customer khata entry for new customer', () => {
    const newCustData = { ...billData, name: 'New Customer', tot: 1500, contractorName: '' }
    const result = applyBill(baseState, newCustData, 'khata')
    expect(result.khataCustomers).toHaveLength(2)
    const n = result.khataCustomers.find(c => c.name === 'New Customer')
    expect(n.balance).toBe(1500)
  })

  it('does not add customer khata for Walk-in', () => {
    const walkData = { ...billData, name: 'Walk-in', tot: 2000, contractorName: '' }
    const result = applyBill(baseState, walkData, 'khata')
    expect(result.khataCustomers).toHaveLength(1) // unchanged
  })

  it('does not add discount log entry when discount is 0', () => {
    const result = applyBill(baseState, billData, 'cash')
    expect(result.discountLog).toHaveLength(0)
  })

  it('adds discount log entry when discount > 0', () => {
    const discData = { ...billData, disc: 5, discAmt: 9, tot: 161 }
    const result = applyBill(baseState, discData, 'cash')
    expect(result.discountLog).toHaveLength(1)
    expect(result.discountLog[0].bill).toBe(1)
    expect(result.discountLog[0].disc).toBe(9)
    expect(result.discountLog[0].pct).toBe(5)
  })

  it('updates customer khata when customer selected from dropdown', () => {
    const custData = { ...billData, name: 'Walk-in', tot: 2000, contractorName: 'Amit Sharma' }
    const result = applyBill(baseState, custData, 'khata')
    const amit = result.khataCustomers.find(c => c.name === 'Amit Sharma')
    expect(amit.balance).toBe(5000) // 3000 + 2000
    expect(amit.lastPaid).toBe('Today')
    const raju = result.contractors.find(c => c.name === 'Raju Construction')
    expect(raju.balance).toBe(10000)
  })

  it('handles contractor selected from dropdown normally', () => {
    const khataData = { ...billData, name: 'Walk-in', tot: 5000, contractorName: 'Raju Construction' }
    const result = applyBill(baseState, khataData, 'khata')
    const raju = result.contractors.find(c => c.name === 'Raju Construction')
    expect(raju.balance).toBe(15000)
    const amit = result.khataCustomers.find(c => c.name === 'Amit Sharma')
    expect(amit.balance).toBe(3000)
  })

  it('does not crash when dropdown name matches neither contractor nor customer', () => {
    const unknownData = { ...billData, name: 'Walk-in', tot: 2000, contractorName: 'Unknown Person' }
    const result = applyBill(baseState, unknownData, 'khata')
    expect(result.contractors).toHaveLength(1)
    expect(result.khataCustomers).toHaveLength(1)
  })
})

describe('buildReceiptHTML', () => {
  it('returns a non-empty HTML string', () => {
    const html = buildReceiptHTML(
      { name: 'Amit', phone: '', upiRef: '', contractorName: '', disc: 0, discAmt: 0, tot: 170,
        items: [{ id: 1, name: 'Pipe', qty: 2, price: 85, cost: 60, unit: 'ft' }] },
      1, 'cash'
    )
    expect(html).toContain('Shop')
    expect(html).toContain('Amit')
    expect(html).toContain('Bill #1')
    expect(html).toContain('₹170')
    expect(html).toContain('Done')
  })

  it('shows discount line when discAmt > 0', () => {
    const html = buildReceiptHTML(
      { name: 'Test', phone: '', upiRef: '', contractorName: '', disc: 10, discAmt: 17, tot: 153,
        items: [{ id: 1, name: 'Pipe', qty: 1, price: 170, cost: 60, unit: 'ft' }] },
      2, 'upi'
    )
    expect(html).toContain('Discount (10%)')
    expect(html).toContain('-₹17')
  })
})

describe('buildWAMsg', () => {
  it('builds a WhatsApp message with item lines', () => {
    const msg = buildWAMsg(
      { name: 'Amit', phone: '', upiRef: '', contractorName: '', disc: 0, discAmt: 0, tot: 170,
        items: [{ id: 1, name: 'Pipe', qty: 2, price: 85, cost: 60, unit: 'ft' }] },
      1, 'cash'
    )
    expect(msg).toContain('Shop')
    expect(msg).toContain('Bill #1')
    expect(msg).toContain('Pipe × 2')
    expect(msg).toContain('Total: ₹170')
  })
})

describe('buildReprintHTML', () => {
  it('builds a reprint from a transaction object', () => {
    const txn = {
      id: 5, customer: 'Amit', payMode: 'cash', tot: 340, disc: 0, discAmt: 0,
      items: [{ id: 1, name: 'Pipe', qty: 4, price: 85, cost: 60 }],
      createdAt: new Date('2025-06-15T10:00:00').toISOString(),
    }
    const html = buildReprintHTML(txn)
    expect(html).toContain('Reprint from')
    expect(html).toContain('Amit')
    expect(html).toContain('Bill #5')
    expect(html).toContain('₹340')
  })
})
