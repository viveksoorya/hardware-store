import { describe, it, expect } from 'vitest'
import {
  filterItems,
  getNextId,
  addItem,
  updateItem,
  deleteItem,
} from '../src/logic/item.js'

const items = [
  { id: 1, name: 'GI Pipe', hi: 'जीआई पाइप', cat: 'Plumbing', unit: 'ft', price: 85, cost: 60, stock: 320 },
  { id: 2, name: 'PVC Pipe', hi: 'पीवीसी पाइप', cat: 'Plumbing', unit: 'ft', price: 35, cost: 22, stock: 480 },
  { id: 3, name: 'MCB Switch', hi: 'एमसीबी स्विच', cat: 'Electrical', unit: 'pc', price: 180, cost: 120, stock: 45 },
  { id: 4, name: 'Cement Bag', hi: 'सीमेंट', cat: 'Construction', unit: 'bag', price: 380, cost: 310, stock: 8 },
]

describe('filterItems', () => {
  it('returns all items for empty query', () => {
    expect(filterItems(items, '')).toHaveLength(4)
  })

  it('filters by English name', () => {
    const result = filterItems(items, 'pipe')
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('GI Pipe')
    expect(result[1].name).toBe('PVC Pipe')
  })

  it('filters by Hindi name', () => {
    const result = filterItems(items, 'सीमेंट')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Cement Bag')
  })

  it('filters by category', () => {
    const result = filterItems(items, 'electrical')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('MCB Switch')
  })

  it('is case insensitive', () => {
    const result = filterItems(items, 'PIPE')
    expect(result).toHaveLength(2)
  })
})

describe('getNextId', () => {
  it('returns max id + 1', () => {
    expect(getNextId(items)).toBe(5)
  })

  it('returns 1 for empty array', () => {
    expect(getNextId([])).toBe(1)
  })
})

describe('addItem', () => {
  it('adds a new item with all fields', () => {
    const result = addItem(items, {
      name: 'New Item', hi: 'नया', cat: 'Tools', unit: 'pc',
      price: 100, cost: 50, stock: 20,
    })
    expect(result.items).toHaveLength(5)
    expect(result.items[4]).toMatchObject({
      id: 5, name: 'New Item', hi: 'नया', cat: 'Tools',
      unit: 'pc', price: 100, cost: 50, stock: 20,
    })
  })

  it('returns error when name is missing', () => {
    const result = addItem(items, { price: 100 })
    expect(result.error).toBe('Name and price are required')
    expect(result.items).toHaveLength(4)
  })

  it('returns error when price is missing', () => {
    const result = addItem(items, { name: 'Test' })
    expect(result.error).toBe('Name and price are required')
  })

  it('applies defaults for optional fields', () => {
    const result = addItem(items, { name: 'Test', price: 50 })
    expect(result.items[4].hi).toBe('')
    expect(result.items[4].cat).toBe('Misc')
    expect(result.items[4].unit).toBe('pc')
    expect(result.items[4].cost).toBe(0)
    expect(result.items[4].stock).toBe(0)
  })
})

describe('updateItem', () => {
  it('updates specific fields of an item', () => {
    const result = updateItem(items, 1, { price: 95, stock: 300 })
    expect(result.items[0].price).toBe(95)
    expect(result.items[0].stock).toBe(300)
    expect(result.items[0].name).toBe('GI Pipe') // unchanged
  })

  it('returns error for non-existent id', () => {
    const result = updateItem(items, 999, { name: 'X' })
    expect(result.error).toBe('Item not found')
  })

  it('does not change other items', () => {
    const result = updateItem(items, 2, { name: 'Updated' })
    expect(result.items[1].name).toBe('Updated')
    expect(result.items[0].name).toBe('GI Pipe') // unchanged
  })
})

describe('deleteItem', () => {
  it('removes the item with given id', () => {
    const result = deleteItem(items, 1)
    expect(result.items).toHaveLength(3)
    expect(result.items.find(i => i.id === 1)).toBeUndefined()
  })

  it('leaves other items intact', () => {
    const result = deleteItem(items, 3)
    expect(result.items.find(i => i.id === 1)).toBeDefined()
    expect(result.items.find(i => i.id === 2)).toBeDefined()
  })
})
