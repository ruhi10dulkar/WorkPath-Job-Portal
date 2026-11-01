import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { dashboardService } from '../services/dashboardService'
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/PageStates'

function greeting() { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening' }

export default function RecruiterDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    dashboardService.getRecruiter().then((result) => { if (active) { setData(result); setError(false) } }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])

  const stats = data ? [
    ['Active jobs', data.activeJobs ?? data.totalJobs],
    ['Total applicants', data.totalApplications],
    ['Under review', data.applicationsByStatus?.UNDER_REVIEW || 0],
    ['Shortlisted', data.applicationsByStatus?.SHORTLISTED || 0],
    ['Interviews', data.applicationsByStatus?.INTERVIEW || 0],
  ] : []

  return <section className="dashboard-content">
    <div className="dashboard-heading"><div><p className="eyebrow">RECRUITER WORKSPACE</p><h1>{greeting()}, {user?.name?.split(' ')[0] || 'there'}</h1><p className="muted">Manage your listings and review incoming applications.</p></div><a className="primary-button" href="/recruiter/jobs">Post a job <span aria-hidden="true">+</span></a></div>
    {error ? <ErrorState message="Your dashboard could not be loaded." onRetry={() => { setLoading(true); setReload((value) => value + 1) }} /> : loading ? <LoadingState label="Loading recruiter dashboard" /> : data && <>
      <div className="stat-grid">{stats.map(([label, value]) => <article className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <section className="dashboard-panel"><div className="section-heading"><div><p className="eyebrow">YOUR LISTINGS</p><h2>Jobs</h2></div><a className="text-link" href="/recruiter/jobs">Manage jobs <span aria-hidden="true">→</span></a></div>
        {!data.jobsWithApplicationCounts?.length ? <EmptyState title="No jobs posted yet" message="Create your first listing to start reaching applicants." action="Post a job" href="/recruiter/jobs" /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Position</th><th>Location</th><th>Applicants</th><th>Posted</th><th>Actions</th></tr></thead><tbody>{data.jobsWithApplicationCounts.map((job) => <tr key={job.jobId}><td><strong>{job.title}</strong><span>{job.company}</span></td><td>{job.location}</td><td>{job.applicationCount}</td><td>{new Date(job.createdAt).toLocaleDateString()}</td><td><a className="row-action" href={`/recruiter/applications?jobId=${job.jobId}`}>Review applicants</a></td></tr>)}</tbody></table></div>}
      </section>
      <section className="dashboard-panel"><div className="section-heading"><div><p className="eyebrow">LATEST ACTIVITY</p><h2>Recent applicants</h2></div><a className="text-link" href="/recruiter/applications">View all <span aria-hidden="true">→</span></a></div>
        {!data.recentApplications?.length ? <EmptyState title="No applications received" message="New applications for your listings will appear here." action="Manage jobs" href="/recruiter/jobs" /> : <div className="application-list">{data.recentApplications.map((item) => <article className="application-row recruiter-app-row" key={item._id}><div className="application-row-main"><div className="company-mark small-mark" aria-hidden="true">{item.applicant?.name?.[0]?.toUpperCase() || 'A'}</div><div><h3>{item.applicant?.name || 'Applicant unavailable'}</h3><p className="job-meta">{item.job?.title || 'Job unavailable'}{item.job?.company ? ` · ${item.job.company}` : ''}</p></div></div><time>{new Date(item.appliedAt).toLocaleDateString()}</time><StatusBadge status={item.status} /><a className="row-action" href="/recruiter/applications">Review</a></article>)}</div>}
      </section>
    </>}
  </section>
}
