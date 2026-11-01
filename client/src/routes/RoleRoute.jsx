import { useEffect } from 'react'
import { useAuth } from '../context/useAuth'

export default function RoleRoute({ role, children }) {
  const { user, loading, isAuthenticated } = useAuth()
  const target = user?.role === 'recruiter' ? '/dashboard/recruiter' : '/dashboard/applicant'

  useEffect(() => {
    if (!loading && !isAuthenticated) window.location.replace('/login')
    else if (!loading && user?.role !== role) window.location.replace(target)
  }, [loading, isAuthenticated, role, target, user?.role])

  if (loading) return <main className="auth-shell"><p className="muted">Checking your session…</p></main>
  if (!isAuthenticated || user?.role !== role) return <main className="auth-shell"><p className="muted">Redirecting…</p></main>
  return children
}
