export function pickParams(source = {}, keys = []) {
  const params = {}
  keys.forEach((key) => {
    const value = source[key]
    if (value !== undefined && value !== null && value !== '') params[key] = value
  })
  return params
}

export function collectionFrom(payload) {
  if (!payload) return { items: [], total: 0, page: 1, limit: 20 }
  if (Array.isArray(payload)) {
    return { items: payload, total: payload.length, page: 1, limit: payload.length || 20 }
  }
  const items = payload.items || payload.data || []
  return {
    items,
    total: payload.total ?? items.length,
    page: payload.page ?? 1,
    limit: payload.limit ?? items.length ?? 20,
  }
}
