import { useRef, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { authService } from '../services/authService'

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const requestedRole = new URLSearchParams(window.location.search).get('role')
  const { login, register } = useAuth()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const emailInput = useRef(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)

    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const details = Object.fromEntries(form.entries())

    try {
      if (isRegister) {
        const result = await register(details)
        setNotice(result.message)
        formElement.reset()
      } else {
        await login({ email: details.email, password: details.password })
        window.location.assign('/dashboard')
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <a className="wordmark" href="/">workpath<span>.</span></a>
      <section className="auth-card">
        <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
        <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">
          {isRegister ? 'Join a community moving careers forward.' : 'Sign in to continue to your account.'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <>
              <label>
                Full name
                <input name="name" type="text" autoComplete="name" minLength="2" maxLength="100" required />
              </label>
              <label>
                I am joining as
                <select name="role" defaultValue={requestedRole === 'recruiter' ? 'recruiter' : 'applicant'}>
                  <option value="applicant">Applicant</option>
                  <option value="recruiter">Recruiter</option>
                </select>
              </label>
            </>
          )}
          <label>
            Email address
            <input ref={emailInput} name="email" type="email" autoComplete="email" maxLength="254" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength="8" required />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {!isRegister && (
          <button className="text-button" type="button" onClick={async () => {
            const email = emailInput.current?.value.trim()
            if (!email) { setError('Enter your email address first.'); return }
            setError('')
            try {
              const result = await authService.resendVerification(email)
              setNotice(result.message)
            } catch (requestError) { setError(requestError.message) }
          }}>Resend verification email</button>
        )}

        <p className="switch-auth">
          {isRegister ? 'Already have an account?' : 'New to Workpath?'}{' '}
          <a href={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</a>
        </p>
      </section>
      <p className="auth-footer">A little closer to the work you love.</p>
    </main>
  )
}
