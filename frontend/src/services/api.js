import axios from 'axios'

// In local development (import.meta.env.DEV), default to /api for Vite proxy to http://localhost:8000.
// In production builds (Vercel / Android), use VITE_API_URL or fallback to the live Render backend.
const rawApiUrl = import.meta.env.VITE_API_URL
const isDev = import.meta.env.DEV

const API_BASE = isDev
  ? (rawApiUrl && (rawApiUrl.includes('localhost') || rawApiUrl.includes('127.0.0.1'))
      ? rawApiUrl.replace(/\/+$/, '')
      : '/api')
  : (rawApiUrl
      ? rawApiUrl.replace(/\/+$/, '')
      : 'https://disaster-platform-6tom.onrender.com')


const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000, // 60s timeout to allow for Render free-tier cold starts (~30-50s)
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || ''
      const isAuthEndpoint = url.includes('/login') || url.includes('/signup')
      if (!isAuthEndpoint) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)


export async function checkApiHealth() {
  try {
    const res = await api.get('/health', { timeout: 15000 })
    return { ok: true, data: res.data }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

export { API_BASE }
export default api

