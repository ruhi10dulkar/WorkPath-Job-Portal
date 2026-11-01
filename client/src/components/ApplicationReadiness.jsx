import { useCallback, useEffect, useState } from 'react'
import { profileService } from '../services/profileService'

export default function ApplicationReadiness({ initialReadiness, compact = false }) {
  const [readiness, setReadiness] = useState(initialReadiness || null)
  const [loading, setLoading] = useState(!initialReadiness)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const result = await profileService.getReadiness(); setReadiness(result.readiness); setError(false) }
    catch { setError(true) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    if (initialReadiness) return undefined
    const request = window.setTimeout(load, 0)
    return () => window.clearTimeout(request)
  }, [initialReadiness, load])

  return <section className={`readiness-card${compact ? ' readiness-compact' : ''}`} aria-labelledby="readiness-title">
    <div className="readiness-heading"><div><p className="eyebrow">APPLICATION READINESS</p><h2 id="readiness-title">{readiness?.ready ? 'Your profile is ready' : 'Complete your profile once'}</h2></div>{readiness && <strong className="readiness-percent">{readiness.completionPercentage}%</strong>}</div>
    {loading ? <p className="muted" role="status">Checking your profile…</p> : error ? <div><p className="muted">We couldn't check profile readiness.</p><button className="text-button" type="button" onClick={load}>Try again</button></div> : readiness && <>
      <div className="readiness-progress" role="progressbar" aria-valuenow={readiness.completionPercentage} aria-valuemin="0" aria-valuemax="100" aria-label="Profile completion"><span style={{ width: `${readiness.completionPercentage}%` }} /></div>
      <ul className="readiness-checklist">{readiness.checklist.map((item) => <li key={item.key} className={item.complete ? 'is-complete' : 'is-missing'}><span aria-hidden="true">{item.complete ? '✓' : '○'}</span>{item.label}</li>)}</ul>
      <p className={readiness.ready ? 'readiness-message is-ready' : 'readiness-message'}>{readiness.ready ? 'Your profile is ready for job applications.' : 'Complete the required details before applying.'}</p>
      <a className={readiness.ready ? 'secondary-button' : 'primary-button'} href="/profile">{readiness.ready ? 'Review profile' : 'Complete profile'}</a>
    </>}
  </section>
}
