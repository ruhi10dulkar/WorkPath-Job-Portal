import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { dashboardService } from '../services/dashboardService'
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/PageStates'
import ApplicationReadiness from '../components/ApplicationReadiness'

const statuses = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'REJECTED']
function greeting() { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening' }

export default function ApplicantDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    dashboardService.getApplicant().then((result) => { if (active) { setData(result); setError(false) } }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])

  const stats = data ? [
    ['Applications', data.totalApplications],
    ['Under review', data.applicationStats?.UNDER_REVIEW || 0],
    ['Shortlisted', data.applicationStats?.SHORTLISTED || 0],
    ['Interview', data.applicationStats?.INTERVIEW || 0],
    ['Selected', data.applicationStats?.SELECTED || 0],
  ] : []

  return <section className="dashboard-content">
    <div className="dashboard-heading"><div><p className="eyebrow">APPLICANT WORKSPACE</p><h1>{greeting()}, {user?.name?.split(' ')[0] || 'there'}</h1><p className="muted">Find your next opportunity and keep track of your progress.</p></div><div className="applicant-actions"><a className="primary-button" href="/jobs">Explore jobs <span aria-hidden="true">→</span></a><a className="secondary-button" href="/applications">View applications</a></div></div>
    {error ? <ErrorState message="Your dashboard could not be loaded." onRetry={() => { setLoading(true); setReload((value) => value + 1) }} /> : loading ? <LoadingState label="Loading applicant dashboard" /> : data && <>
      <div className="stat-grid">{stats.map(([label, value]) => <article className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <div className="dashboard-readiness-intro"><div><p className="eyebrow">PROFILE FIRST, APPLY FASTER</p><h2>Welcome to Workpath</h2><p className="muted">Your profile and primary resume are reused when you apply. You can still browse jobs at any time.</p></div><ApplicationReadiness compact /></div>
      <section className="dashboard-panel"><div className="section-heading"><div><p className="eyebrow">APPLICATION OVERVIEW</p><h2>Where things stand</h2></div></div><div className="status-overview">{statuses.map((status) => <div key={status}><StatusBadge status={status} /><strong>{data.applicationStats?.[status] ?? 0}</strong></div>)}</div></section>
      <section className="dashboard-panel"><div className="section-heading"><div><p className="eyebrow">LATEST ACTIVITY</p><h2>Recent applications</h2></div><a className="text-link" href="/applications">View all <span aria-hidden="true">→</span></a></div>
        {!data.recentApplications?.length ? <EmptyState title="No applications yet" message="Start exploring jobs and submit your first application." action="Browse jobs" href="/jobs" /> : <div className="application-list">{data.recentApplications.map((item) => <article className="application-row" key={item._id}><div className="application-row-main"><div className="company-mark small-mark" aria-hidden="true">{item.job?.company?.[0]?.toUpperCase() || '—'}</div><div><h3>{item.job?.title || 'Job no longer available'}</h3><p className="job-meta">{item.job?.company || 'Role unavailable'}{item.job?.location ? ` · ${item.job.location}` : ''}</p></div></div><time>{new Date(item.appliedAt).toLocaleDateString()}</time><StatusBadge status={item.status} />{item.job && <a className="row-action" href={`/jobs/${item.job._id}`}>View role</a>}</article>)}</div>}
      </section>
    </>}
  </section>
}
