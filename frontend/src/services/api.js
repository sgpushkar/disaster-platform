import axios from 'axios'

// On Vercel / native Android / production, use VITE_API_URL if configured, otherwise default to /api for Vite dev proxy
const rawApiUrl = import.meta.env.VITE_API_URL
const API_BASE = rawApiUrl ? rawApiUrl.replace(/\/+$/, '') : '/api'

const api = axios.create({
  baseURL: API_BASE,
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

export default api
