// ── Item CRUD (pure) ──

export function filterItems(items, query) {
  const q = (query || '').toLowerCase()
  return items.filter(i =>
    i.name.toLowerCase().includes(q) ||
    i.hi.includes(q) ||
    i.cat.toLowerCase().includes(q)
  )
}

export function getNextId(items) {
  return items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1
}

export function addItem(items, data) {
  if (!data.name || !data.price) return { items, error: 'Name and price are required' }
  const newItem = {
    id: getNextId(items),
    name: data.name,
    hi: data.hi || '',
    cat: data.cat || 'Misc',
    unit: data.unit || 'pc',
    price: +data.price,
    cost: +data.cost || 0,
    stock: +data.stock || 0,
  }
  return { items: [...items, newItem] }
}

export function updateItem(items, id, data) {
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return { items, error: 'Item not found' }
  const updated = items.map(i =>
    i.id === id
      ? {
          ...i,
          name: data.name !== undefined ? data.name : i.name,
          hi: data.hi !== undefined ? data.hi : i.hi,
          cat: data.cat !== undefined ? data.cat : i.cat,
          unit: data.unit !== undefined ? data.unit : i.unit,
          price: data.price !== undefined ? +data.price : i.price,
          cost: data.cost !== undefined ? +data.cost : i.cost,
          stock: data.stock !== undefined ? +data.stock : i.stock,
        }
      : i
  )
  return { items: updated }
}

export function deleteItem(items, id) {
  return { items: items.filter(i => i.id !== id) }
}
