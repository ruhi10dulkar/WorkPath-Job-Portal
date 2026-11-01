const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

let accessToken = null

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })
  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(result.message || 'The request could not be completed.')
    error.status = response.status
    error.payload = result
    throw error
  }

  return result
}

export const apiRequest = request

export async function apiUpload(path, formData) {
  const headers = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', body: formData, headers, credentials: 'include' })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(result.message || 'The upload could not be completed.')
    error.status = response.status
    error.payload = result
    throw error
  }
  return result
}

export async function apiRequestBlob(path) {
  const headers = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const response = await fetch(`${API_BASE_URL}${path}`, { headers, credentials: 'include' })
  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    const error = new Error(result.message || 'The file could not be opened.')
    error.status = response.status
    error.payload = result
    throw error
  }
  return response.blob()
}

export const authService = {
  async register(details) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(details),
    })
  },

  async login(credentials) {
    const result = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    accessToken = result.accessToken
    return result.user
  },

  async refreshAccessToken() {
    const result = await request('/auth/refresh', { method: 'POST' })
    accessToken = result.accessToken
    return result.user
  },

  async getCurrentUser() {
    const result = await request('/auth/me')
    return result.user
  },

  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' })
    } finally {
      accessToken = null
    }
  },

  async resendVerification(email) {
    return request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  clearAccessToken() {
    accessToken = null
  },
}
