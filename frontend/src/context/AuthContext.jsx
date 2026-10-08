import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Verify and hydrate session
  const verifySession = useCallback(async () => {
    const storedUser = localStorage.getItem('user')
    const token = localStorage.getItem('access_token')

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setUser(parsed)
      } catch (_) {
        setUser(null)
      }
    }

    if (token) {
      try {
        const { data } = await api.get('/auth/me', { timeout: 10000 })
        setUser(data)
        localStorage.setItem('user', JSON.stringify(data))
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('user')
          setUser(null)
        }
        // If network error/cold start, retain stored user session
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    verifySession()
  }, [verifySession])

  const login = async (email, password) => {
    const cleanEmail = email.trim().toLowerCase()
    const { data } = await api.post('/login', { email: cleanEmail, password })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const signup = async (name, email, password, phone = '') => {
    const cleanEmail = email.trim().toLowerCase()
    const cleanName = name.trim()
    const cleanPhone = phone ? phone.trim() : undefined
    const { data } = await api.post('/signup', {
      name: cleanName,
      email: cleanEmail,
      password,
      phone: cleanPhone,
    })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const changePassword = async (oldPassword, newPassword) => {
    const { data } = await api.post('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    })
    return data
  }

  const updateUser = (updatedUser) => {
    setUser(updatedUser)
    localStorage.setItem('user', JSON.stringify(updatedUser))
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, changePassword, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

