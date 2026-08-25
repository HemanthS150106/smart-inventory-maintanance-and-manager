import React, { createContext, useEffect, useState } from 'react'

export const AuthContext = createContext(null)

export default function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('si_token'))

  useEffect(() => {
    if (token) localStorage.setItem('si_token', token)
    else localStorage.removeItem('si_token')
  }, [token])

  const login = (newToken) => setToken(newToken)
  const logout = () => setToken(null)

  const authFetch = (input, init = {}) => {
    init.headers = { ...(init.headers || {}), Authorization: token ? `Bearer ${token}` : '' }
    return fetch(input, init)
  }

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  )
}
