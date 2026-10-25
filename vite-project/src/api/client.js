import axios from 'axios'
import { getStoredToken } from '../utils/storage'

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
export const API_BASE_URL =
  configuredBaseUrl && /\/api(?:\/v1)?$/.test(configuredBaseUrl)
    ? configuredBaseUrl
    : `${configuredBaseUrl || 'http://localhost:5000'}/api`

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
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
      const url = `${error.config?.baseURL || API_BASE_URL}${error.config?.url || ''}`
      console.error(`[api] Backend unreachable: ${url}`, error.message)
      window.dispatchEvent(new CustomEvent('hcm:toast', { detail: { type: 'error', message: `Backend unreachable at ${url}` } }))
    }
    const status = error.response?.status
    const data = error.response?.data
    const parsed =
      data instanceof Blob
        ? { status, message: 'Request failed', errors: [], requestUrl: error.config?.url }
        : {
            status,
            message: data?.message || error.message || 'Request failed',
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
          detail: { type: 'error', message: 'Too many requests. Please wait and try again.' },
        }),
      )
    }
    if (status >= 500) {
      window.dispatchEvent(
        new CustomEvent('hcm:toast', {
          detail: { type: 'error', message: 'Server error. Please try again later.' },
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
