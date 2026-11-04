import axios from 'axios'
import { getStoredToken } from '../utils/storage'

const DEFAULT_API_BASE_URL = 'https://hcm-lite-backend-u2yu.onrender.com/api/v1'
const configuredBaseUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)
  .replace(/\/+$/, '')
export const API_BASE_URL =
  configuredBaseUrl && /\/api(?:\/v1)?$/.test(configuredBaseUrl)
    ? configuredBaseUrl
    : `${configuredBaseUrl}/api/v1`

console.info(`[api] Resolved API base URL: ${API_BASE_URL}`)

const client = axios.create({
  baseURL: API_BASE_URL,
  // Render may need several seconds to wake a sleeping instance.
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
})

client.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (config.data === undefined && ['post', 'put', 'patch'].includes(config.method)) {
    config.data = {}
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false
      const isTimeout = ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)
      const message = isOffline
        ? 'You appear to be offline. Check your internet connection and try again.'
        : isTimeout
          ? 'Server is waking up, please try again in a moment.'
          : 'Could not reach the server. Check your connection; a browser CORS or preflight block may also prevent access.'
      console.error('[api] Request failed without an HTTP response (possible network or CORS/preflight issue)', {
        message: error.message,
        response: error.response,
        error,
      })
      window.dispatchEvent(new CustomEvent('hcm:toast', { detail: { type: 'error', message } }))
      error.userMessage = message
    }
    const status = error.response?.status
    const data = error.response?.data
    const parsed =
      data instanceof Blob
        ? { status, message: 'Request failed', errors: [], requestUrl: error.config?.url }
        : {
            status,
            message: error.userMessage || data?.message || error.message || 'Request failed',
            errors: data?.errors || [],
            data,
            requestId: data?.requestId || error.response?.headers?.['x-request-id'],
            requestUrl: `${error.config?.baseURL || API_BASE_URL}${error.config?.url || ''}`,
          }

    if (status === 401 && !error.config?.skipAuthRedirect) {
      window.dispatchEvent(new CustomEvent('hcm:unauthorized'))
    }
    if (status === 403) {
      window.dispatchEvent(
        new CustomEvent('hcm:toast', {
          detail: { type: 'error', message: data?.message || 'Access denied' },
        }),
      )
    }
    if (status === 429) {
      window.dispatchEvent(
        new CustomEvent('hcm:toast', {
          detail: { type: 'error', message: data?.message || 'Too many requests. Please wait and try again.' },
        }),
      )
    }
    if (status >= 500) {
      window.dispatchEvent(
        new CustomEvent('hcm:toast', {
          detail: { type: 'error', message: data?.message || 'Server error. Please try again later.' },
        }),
      )
    }
    return Promise.reject(parsed)
  },
)

export async function unwrap(promise) {
  const response = await promise
  return response.data?.data
}

export async function unwrapBlob(promise, fallbackName = 'download') {
  const response = await promise
  const blob = response.data
  if (blob?.type?.includes('application/json')) {
    const text = await blob.text()
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { message: text }
    }
    throw {
      status: 422,
      message: parsed.message || 'Download failed',
      errors: parsed.errors || [],
      data: parsed,
    }
  }
  const disposition = response.headers['content-disposition'] || ''
  const match = disposition.match(/filename="?([^"]+)"?/i)
  return { blob, filename: match?.[1] || fallbackName }
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default client
