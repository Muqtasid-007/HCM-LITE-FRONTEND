import { utf8ByteLength } from './format'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const CODE_RE = /^[A-Za-z0-9_-]{1,30}$/

export function isEmail(value) {
  return EMAIL_RE.test(String(value || '').trim())
}

export function passwordErrors(password) {
  const value = password || ''
  if (value.length < 12) return 'Password must be at least 12 characters'
  if (utf8ByteLength(value) > 72) return 'Password must be at most 72 UTF-8 bytes'
  return ''
}

export function fieldErrors(values, rules) {
  const errors = {}
  Object.entries(rules).forEach(([key, rule]) => {
    const value = values[key]
    if (rule.required && (value === undefined || value === null || String(value).trim() === '')) {
      errors[key] = rule.message || 'This field is required'
      return
    }
    if (rule.email && value && !isEmail(value)) errors[key] = 'Enter a valid email'
    if (rule.minLength && value && String(value).length < rule.minLength) {
      errors[key] = `Must be at least ${rule.minLength} characters`
    }
    if (rule.password && value) {
      const message = passwordErrors(value)
      if (message) errors[key] = message
    }
    if (rule.time && value && !TIME_RE.test(value)) errors[key] = 'Use HH:mm (24-hour)'
    if (rule.code && value && !CODE_RE.test(value)) errors[key] = 'Use 1–30 letters, numbers, _ or -'
    if (rule.min !== undefined && value !== '' && Number(value) < rule.min) {
      errors[key] = `Must be at least ${rule.min}`
    }
    if (rule.gt !== undefined && value !== '' && !(Number(value) > rule.gt)) {
      errors[key] = `Must be greater than ${rule.gt}`
    }
    if (typeof rule.test === 'function') {
      const message = rule.test(value, values)
      if (message) errors[key] = message
    }
  })
  return errors
}

export function apiFieldErrors(errors = []) {
  const map = {}
  errors.forEach((item) => {
    if (!item?.field) return
    map[item.field] = item.reason || item.message || 'Invalid'
  })
  return map
}

export function apiErrorText(error, fallback = 'Something went wrong') {
  if (!error) return fallback
  const details = (error.errors || [])
    .map((item) => {
      const field = item.field ? `${item.field}: ` : ''
      const row = item.row ? `Row ${item.row} ` : ''
      return `${row}${field}${item.reason || item.message || ''}`.trim()
    })
    .filter(Boolean)
    .join(' · ')
  return details || error.message || error.data?.message || fallback
}
