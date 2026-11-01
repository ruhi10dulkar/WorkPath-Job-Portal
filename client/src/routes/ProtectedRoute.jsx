import { useEffect } from 'react'
import { useAuth } from '../context/useAuth'

export default function ProtectedRoute({ children }) {
  const { loading, isAuthenticated } = useAuth()

  useEffect(() => {
    if (!loading && !isAuthenticated) window.location.replace('/login')
  }, [loading, isAuthenticated])

  if (loading) {
    return <main className="auth-shell"><p className="muted">Checking your session…</p></main>
  }

  if (!isAuthenticated) {
    return <main className="auth-shell"><p className="muted">Redirecting to sign in…</p></main>
  }

  return children
}
