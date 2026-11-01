import { useCallback, useEffect, useState } from 'react'
import { applicationService } from '../services/applicationService'
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/PageStates'

export default function MyApplications() {
  const [applications, setApplications] = useState([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const load = useCallback(async () => {
    setLoading(true)
    try { setApplications(await applicationService.getMine()); setError(false) } catch { setError(true) } finally { setLoading(false) }
  }, [])
  useEffect(() => {
    const request = window.setTimeout(load, 0)
    return () => window.clearTimeout(request)
  }, [load, reload])

  return <section className="browse-section">
    <div className="page-heading"><div><p className="eyebrow">APPLICANT WORKSPACE</p><h1>Applications</h1><p className="muted">Track the status of roles you have applied to.</p></div></div>
    {error ? <ErrorState message="Your applications could not be loaded." onRetry={() => { setLoading(true); setReload((value) => value + 1) }} /> : loading ? <LoadingState label="Loading applications" /> : applications.length === 0 ? <EmptyState title="No applications yet" message="Start exploring jobs and submit your first application." action="Browse jobs" href="/jobs" /> : <div className="application-list application-list-page">{applications.map((item) => <article className="application-row" key={item._id}><div className="application-row-main"><div className="company-mark small-mark" aria-hidden="true">{item.job?.company?.[0]?.toUpperCase() || '—'}</div><div>{item.job ? <><h3><a className="application-job-link" href={`/jobs/${item.job._id}`}>{item.job.title}</a></h3><p className="job-meta">{item.job.company}{item.job.location ? ` · ${item.job.location}` : ''}</p></> : <h3>Job no longer available</h3>}</div></div>{Number.isInteger(item.jobFit?.score) && <div className="application-date"><span>Job Fit</span><strong>{item.jobFit.score}% · {item.jobFit.level}</strong></div>}<div className="application-date"><span>Applied</span><time>{new Date(item.appliedAt).toLocaleDateString()}</time></div><StatusBadge status={item.status} /><a className="row-action" href={`/applications/${item._id}`}>View application</a></article>)}</div>}
  </section>
}
