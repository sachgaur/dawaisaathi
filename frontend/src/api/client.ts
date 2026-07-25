import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
})

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear token and reject.
// AuthContext reads the token and shows the login page when user is null.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
    }
    return Promise.reject(err)
  }
)

export function getImageUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('/uploads/')) {
    const baseUrl = import.meta.env.VITE_API_URL || ''
    return `${baseUrl}${url}`
  }
  return url
}

export default api
