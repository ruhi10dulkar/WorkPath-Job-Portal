import { useEffect, useState } from 'react'
import { applicationService } from '../services/applicationService'
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/PageStates'

const stages = [['', 'All applications'], ['APPLIED', 'Applied'], ['UNDER_REVIEW', 'Under review'], ['SHORTLISTED', 'Shortlisted'], ['INTERVIEW', 'Interview'], ['SELECTED', 'Selected'], ['REJECTED', 'Rejected']]
const date = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function RecruiterApplications() {
  const [data, setData] = useState({ applications: [], pagination: { page: 1, totalPages: 1, total: 0 }, counts: {} })
  const [filters, setFilters] = useState(() => ({ status: '', search: '', location: '', skill: '', experience: '', sort: 'newest', fitMin: '', page: 1, jobId: new URLSearchParams(window.location.search).get('jobId') || '' }))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    applicationService.getForRecruiter(filters).then((result) => { if (active) { setData(result); setError(false) } }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, reload])

  function setFilter(key, value) { setLoading(true); setFilters((current) => ({ ...current, [key]: value, page: 1 })) }
  async function confirmStatus() {
    if (!pendingStatus) return
    setSaving(true)
    try {
      await applicationService.updateStatus(pendingStatus.application._id, pendingStatus.status)
      setPendingStatus(null)
      setReload((n) => n + 1)
    } catch (requestError) { window.alert(requestError.message || 'Unable to update this application.') }
    finally { setSaving(false) }
  }
  const rangeStart = data.pagination.total ? (data.pagination.page - 1) * data.pagination.limit + 1 : 0
  const rangeEnd = Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)

  return <section className="browse-section recruiter-screening">
    <div className="page-heading"><div><p className="eyebrow">RECRUITER WORKSPACE</p><h1>Applicant pipeline</h1><p className="muted">Search and review candidates for your job listings.</p></div></div>
    <nav className="pipeline-stages" aria-label="Filter applications by status">{stages.map(([value, label]) => <button type="button" key={value} className={filters.status === value ? 'is-active' : ''} onClick={() => setFilter('status', value)}><span>{label}</span><strong>{data.counts?.[value || 'ALL'] ?? (value ? data.counts?.[value] ?? 0 : Object.values(data.counts || {}).reduce((sum, count) => sum + count, 0))}</strong></button>)}</nav>
    <div className="screening-filters">
      <label>Search candidates<input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Name or email" /></label>
      <label>Status<select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>{stages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Location<input value={filters.location} onChange={(event) => setFilter('location', event.target.value)} placeholder="City or region" /></label>
      <label>Skill<input value={filters.skill} onChange={(event) => setFilter('skill', event.target.value)} placeholder="e.g. React" /></label>
      <label>Experience<select value={filters.experience} onChange={(event) => setFilter('experience', event.target.value)}><option value="">Any experience</option><option value="fresher">Fresher</option><option value="0-1">0–1 years</option><option value="1-3">1–3 years</option><option value="3+">3+ years</option></select></label>
      <label>Applied from<input type="date" value={filters.from || ''} onChange={(event) => setFilter('from', event.target.value)} /></label>
      <label>Applied to<input type="date" value={filters.to || ''} onChange={(event) => setFilter('to', event.target.value)} /></label>
      <label>Sort by<select value={filters.sort} onChange={(event) => setFilter('sort', event.target.value)}><option value="newest">Newest applications</option><option value="oldest">Oldest applications</option><option value="name">Candidate name</option><option value="updated">Recent status update</option><option value="fitHigh">Job Fit: highest first</option><option value="fitLow">Job Fit: lowest first</option></select></label>
      <label>Job Fit<select value={filters.fitMin} onChange={(event) => setFilter('fitMin', event.target.value)}><option value="">Any match</option><option value="80">80% and above</option><option value="60">60% and above</option><option value="40">40% and above</option></select></label>
    </div>
    {error ? <ErrorState message="Applications could not be loaded." onRetry={() => { setLoading(true); setReload((value) => value + 1) }} /> : loading ? <LoadingState label="Loading applicants" /> : !data.applications.length ? <EmptyState title="No applications found" message="Try adjusting the search or filters." action="Manage jobs" href="/recruiter/jobs" /> : <>
      <div className="table-wrap screening-table-wrap"><table className="data-table screening-table"><thead><tr><th>Candidate</th><th>Experience</th><th>Skills</th><th>Job Fit</th><th>Current stage</th><th>Schedule</th><th>Applied</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.applications.map((app) => {
        const profile = app.profileSnapshot || {}
        const current = app.status
        const actions = { APPLIED: [['UNDER_REVIEW', 'Move to review'], ['SHORTLISTED', 'Shortlist'], ['REJECTED', 'Reject']], UNDER_REVIEW: [['SHORTLISTED', 'Shortlist'], ['REJECTED', 'Reject']], SHORTLISTED: [['INTERVIEW', 'Move to interview'], ['REJECTED', 'Reject']], INTERVIEW: [['SELECTED', 'Mark selected'], ['REJECTED', 'Reject']], SELECTED: [], REJECTED: [] }[current] || []
        const years = Number(app.experienceYears || 0)
        const expText = profile.isFresher ? 'Fresher' : (profile.experience || []).length ? years < 1 ? 'Less than 1 year' : `${years.toFixed(1)} years` : 'Not listed'
        return <tr key={app._id}><td data-label="Candidate"><strong>{profile.fullName || app.applicant?.name || 'Candidate'}</strong><span>{app.job?.title || 'Job unavailable'} · {profile.currentLocation || app.job?.location || 'Location not listed'}</span></td><td data-label="Experience">{expText}</td><td data-label="Skills">{(profile.skills || []).slice(0, 3).join(', ') || '—'}</td><td data-label="Job Fit"><strong>{app.jobFit?.score ?? '-'}%</strong><span>{app.jobFit?.level}</span></td><td data-label="Current stage">{app.currentRecruitmentStage || '-'}<span>{app.recruitmentStageStatus}</span></td><td data-label="Schedule">{app.recruitmentScheduledAt ? new Date(app.recruitmentScheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Not scheduled'}</td><td data-label="Applied">{date(app.appliedAt)}</td><td data-label="Status"><StatusBadge status={app.status} /></td><td data-label="Actions"><div className="screening-actions"><a className="row-action" href={`/applications/${app._id}`}>{app.recruitmentStageStatus === 'Eligible' ? 'Schedule' : 'View'}</a>{actions.map(([next, label]) => <button className={next === 'REJECTED' ? 'screening-action danger' : 'screening-action'} type="button" key={next} onClick={() => setPendingStatus({ application: app, status: next, label })}>{label}</button>)}</div></td></tr>
      })}</tbody></table></div>
      <div className="pagination-bar"><span>Showing {rangeStart}–{rangeEnd} of {data.pagination.total}</span><div><button className="secondary-button" type="button" disabled={filters.page <= 1} onClick={() => { setLoading(true); setFilters((f) => ({ ...f, page: f.page - 1 })) }}>Previous</button><span>Page {filters.page} of {data.pagination.totalPages}</span><button className="secondary-button" type="button" disabled={filters.page >= data.pagination.totalPages} onClick={() => { setLoading(true); setFilters((f) => ({ ...f, page: f.page + 1 })) }}>Next</button></div></div>
    </>}
    {pendingStatus && <div className="dialog-backdrop" role="presentation"><section className="screening-confirm" role="dialog" aria-modal="true" aria-labelledby="screening-confirm-title"><p className="eyebrow">CONFIRM STATUS CHANGE</p><h2 id="screening-confirm-title">{pendingStatus.label}?</h2><p>This will move {pendingStatus.application.profileSnapshot?.fullName || 'this candidate'} to {pendingStatus.status.replace('_', ' ').toLowerCase()} and notify the candidate.</p><div className="dialog-actions"><button className="secondary-button" type="button" disabled={saving} onClick={() => setPendingStatus(null)}>Cancel</button><button className={pendingStatus.status === 'REJECTED' ? 'danger-button' : 'primary-button'} type="button" disabled={saving} onClick={confirmStatus}>{saving ? 'Updating…' : pendingStatus.label}</button></div></section></div>}
  </section>
}
