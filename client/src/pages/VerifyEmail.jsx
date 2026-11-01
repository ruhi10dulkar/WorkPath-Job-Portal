import { useEffect, useState } from 'react'
import { apiRequest, authService } from '../services/authService'

export default function VerifyEmail() {
  const token = new URLSearchParams(window.location.search).get('token')
  const [state, setState] = useState(() => token ? 'loading' : 'error')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(token ? '' : 'This verification link is missing or invalid.')
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (!token) return
    let active = true
    apiRequest(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((result) => { if (active) { setState('success'); setMessage(result.message || 'Your email address is verified.') } })
      .catch(() => { if (active) { setState('error'); setMessage('This link may have expired. You can request another verification email.') } })
    return () => { active = false }
  }, [token])

  async function resend(event) {
    event.preventDefault()
    setResending(true)
    try { const result = await authService.resendVerification(email); setState('sent'); setMessage(result.message || 'If the account needs verification, a new email has been sent.') }
    catch { setState('error'); setMessage('Unable to resend the verification email. Check the address and try again.') }
    finally { setResending(false) }
  }

  return <main className="auth-shell"><a className="wordmark" href="/">workpath<span>.</span></a><section className="auth-card verification-card">
    <p className="eyebrow">ACCOUNT SECURITY</p><span className={`verification-icon verification-${state}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">{state === 'success' ? <path d="m5 12 4 4L19 6" /> : <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>}</svg></span>
    <h1>{state === 'loading' ? 'Verifying your email' : state === 'success' ? 'Email verified' : state === 'sent' ? 'Check your inbox' : 'Verify your email'}</h1>
    <p className="muted" role="status">{state === 'loading' ? 'Please wait while we confirm your email address.' : message}</p>
    {state === 'success' || state === 'sent' ? <a className="primary-button" href="/login">Continue to sign in</a> : state !== 'loading' && <form className="resend-form" onSubmit={resend}><label htmlFor="verification-email">Email address</label><input id="verification-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><button className="primary-button" type="submit" disabled={resending}>{resending ? 'Sending…' : 'Resend verification email'}</button><a className="text-link" href="/login">Back to sign in</a></form>}
  </section><p className="auth-footer">Questions? Return to <a href="/">Workpath</a>.</p></main>
}
