
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export interface User {
  id: string
  email: string
  name: string
  createdAt: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const USERS_KEY = "stageone_users"
const SESSION_KEY = "stageone_session"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    const sessionData = localStorage.getItem(SESSION_KEY)
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData)
        setUser(session.user)
      } catch {
        localStorage.removeItem(SESSION_KEY)
      }
    }
    setIsLoading(false)
  }, [])

  const getUsers = (): Record<string, { user: User; passwordHash: string }> => {
    try {
      const data = localStorage.getItem(USERS_KEY)
      return data ? JSON.parse(data) : {}
    } catch {
      return {}
    }
  }

  const saveUsers = (users: Record<string, { user: User; passwordHash: string }>) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  }

  // Simple hash function for demo purposes (not secure for production)
  const hashPassword = (password: string): string => {
    let hash = 0
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(36)
  }

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const users = getUsers()
    const userRecord = users[email.toLowerCase()]

    if (!userRecord) {
      return { success: false, error: "No account found with this email" }
    }

    if (userRecord.passwordHash !== hashPassword(password)) {
      return { success: false, error: "Incorrect password" }
    }

    setUser(userRecord.user)
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: userRecord.user }))
    return { success: true }
  }

  const signup = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    const users = getUsers()
    const emailLower = email.toLowerCase()

    if (users[emailLower]) {
      return { success: false, error: "An account with this email already exists" }
    }

    if (password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters" }
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      email: emailLower,
      name,
      createdAt: new Date().toISOString(),
    }

    users[emailLower] = {
      user: newUser,
      passwordHash: hashPassword(password),
    }

    saveUsers(users)
    setUser(newUser)
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: newUser }))
    return { success: true }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem(SESSION_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
