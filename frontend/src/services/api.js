import axios from 'axios'

// On Vercel / native Android / production, default to the live Render backend
// unless overridden by VITE_API_URL. In local dev, default to /api for Vite proxy.
const rawApiUrl = import.meta.env.VITE_API_URL
const API_BASE = rawApiUrl
  ? rawApiUrl.replace(/\/+$/, '')
  : (import.meta.env.PROD
      ? 'https://disaster-platform-6tom.onrender.com'
      : '/api')


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
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
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

