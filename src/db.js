const PREFIX = 'hs_'

export const DB = {
  save(key, data) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(data))
      return true
    } catch (e) {
      console.warn('DB save failed:', key, e)
      return false
    }
  },

  load(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw !== null ? JSON.parse(raw) : fallback
    } catch (e) {
      return fallback
    }
  },
}
