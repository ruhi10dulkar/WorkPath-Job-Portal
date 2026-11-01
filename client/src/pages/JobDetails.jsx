import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { useToast } from '../context/useToast'
import { ErrorState, LoadingState, StatusBadge } from '../components/PageStates'
import { applicationService } from '../services/applicationService'
import { jobService } from '../services/jobService'
import { profileService } from '../services/profileService'
import { openPrivateFile } from '../utils/openPrivateFile'
import ApplyFlowDialog from '../components/ApplyFlowDialog'
import JobFitCard from '../components/JobFitCard'

export default function JobDetails({ jobId }) {
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const [job, setJob] = useState(null)
  const [jobFit, setJobFit] = useState(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [preparingApplication, setPreparingApplication] = useState(false)
  const [submittingApplication, setSubmittingApplication] = useState(false)
  const [applicationFlow, setApplicationFlow] = useState(null)
  const [applicationProfile, setApplicationProfile] = useState(null)
  const [applicationId, setApplicationId] = useState('')
  const [applicationState, setApplicationState] = useState({ state: 'checking', application: null })
  const [applicationCheckAttempt, setApplicationCheckAttempt] = useState(0)
  const [applicationError, setApplicationError] = useState('')
  const [reload, setReload] = useState(0)
  const applicationCheckKey = `${jobId}:${user?._id || user?.id || ''}`
  const currentApplicationState = applicationState.key === applicationCheckKey ? applicationState : { state: 'checking', application: null }

  useEffect(() => {
    let active = true
    jobService.getJob(jobId).then((result) => { if (active) { setJob(result); setError(false) } }).catch(() => { if (active) { setJob(null); setError(true) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [jobId, reload])

  useEffect(() => {
    let active = true
    if (user?.role === 'applicant' && jobId) jobService.getMatch(jobId).then((result) => { if (active) setJobFit(result) }).catch(() => { if (active) setJobFit(null) })
    else setJobFit(null)
    return () => { active = false }
  }, [jobId, user?.role])

  useEffect(() => {
    let active = true
    if (authLoading) {
      setApplicationState({ key: applicationCheckKey, state: 'checking', application: null })
      return () => { active = false }
    }
    if (user?.role !== 'applicant' || !jobId) {
      setApplicationState({ key: applicationCheckKey, state: 'anonymous', application: null })
      return () => { active = false }
    }
    setApplicationState({ key: applicationCheckKey, state: 'checking', application: null })
    applicationService.getForJob(jobId)
      .then((result) => { if (active) setApplicationState({ key: applicationCheckKey, state: result.hasApplied ? 'applied' : 'not-applied', application: result.application }) })
      .catch(() => { if (active) setApplicationState({ key: applicationCheckKey, state: 'error', application: null }) })
    return () => { active = false }
  }, [authLoading, applicationCheckKey, applicationCheckAttempt, jobId, user?._id, user?.id, user?.role])

  function retryLoad() { setLoading(true); setReload((value) => value + 1) }

  const closeApplicationFlow = useCallback(() => {
    setApplicationFlow(null)
    setApplicationError('')
  }, [])

  async function beginApplication() {
    if (currentApplicationState.state !== 'not-applied') return
    setPreparingApplication(true)
    setApplicationError('')
    if (!user?.emailVerified) {
      showToast('Verify your email before applying.', 'error')
      setPreparingApplication(false)
      return
    }
    try {
      const result = await profileService.getMine()
      setApplicationProfile(result)
      setApplicationFlow(result.readiness.ready ? 'review' : 'blocked')
    } catch {
      showToast('We could not check your profile. Please try again.', 'error')
    } finally { setPreparingApplication(false) }
  }

  async function confirmApplication() {
    setSubmittingApplication(true)
    setApplicationError('')
    try {
      const application = await applicationService.apply(jobId, applicationProfile?.profile?.updatedAt)
      setApplicationId(application._id)
      setApplicationState({ key: applicationCheckKey, state: 'applied', application })
      setApplicationFlow('success')
    } catch (error) {
      if (error.payload?.code === 'PROFILE_INCOMPLETE') {
        setApplicationProfile((current) => ({ ...current, readiness: error.payload.readiness }))
        setApplicationFlow('blocked')
      } else if (error.payload?.code === 'ALREADY_APPLIED') {
        try {
          const result = await applicationService.getForJob(jobId)
          setApplicationState({ key: applicationCheckKey, state: 'applied', application: result.application })
          setApplicationId(result.application?._id || error.payload.applicationId || '')
          setApplicationFlow('duplicate')
        } catch {
          setApplicationState({ key: applicationCheckKey, state: 'error', application: null })
          setApplicationError('You already have an application for this job. Refresh the page to view its status.')
          setApplicationFlow('duplicate')
        }
      } else if (error.payload?.code === 'PROFILE_CHANGED') {
        try {
          const currentProfile = await profileService.getMine()
          setApplicationProfile(currentProfile)
          setApplicationError('Your profile changed after review. The latest details are shown above; review them before confirming again.')
          setApplicationFlow(currentProfile.readiness.ready ? 'review' : 'blocked')
        } catch { setApplicationError('Your profile changed after review. Reload your profile, then try again.') }
      } else {
        setApplicationError('Your application could not be submitted. Please try again.')
      }
    } finally { setSubmittingApplication(false) }
  }

  async function viewResume() {
    try { await openPrivateFile(() => profileService.downloadResume()) }
    catch { showToast('Unable to open your resume.', 'error') }
  }

  async function shareJob() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: job.title, text: `${job.title} at ${job.company}`, url })
      else { await navigator.clipboard.writeText(url); showToast('Job link copied') }
    } catch (shareError) {
      if (shareError.name !== 'AbortError') showToast('Unable to share this job right now.', 'error')
    }
  }

  if (loading) return <LoadingState label="Loading job details" />
  if (error || !job) return <div className="detail-error"><a className="text-link" href="/jobs">← Back to jobs</a><ErrorState message="This role could not be loaded." onRetry={retryLoad} /></div>

  return <article className="detail-card">
    <a className="text-link" href="/jobs">← Back to jobs</a>
    <div className="detail-header"><div className="company-mark detail-company-mark" aria-hidden="true">{job.company?.trim()?.[0]?.toUpperCase() || 'C'}</div><div><p className="job-company">{job.company || 'Company not specified'}</p><p className="job-meta">{job.location || 'Location not specified'} <span aria-hidden="true">·</span> {job.employmentType?.replace('-', ' ') || 'Type not specified'}</p></div></div>
    <p className="eyebrow detail-eyebrow">OPEN POSITION</p><h1>{job.title}</h1>
    <p className="job-meta detail-meta">{job.experienceLevel || 'Experience not specified'}{job.salary ? ` · ${job.salary}` : ''}</p>
    <div className="detail-layout">
      <div className="detail-main">
        {user?.role === 'applicant' && jobFit && <JobFitCard match={jobFit} title="Your Job Fit" />}
        <section className="detail-section"><h2>About the role</h2><p className="detail-description">{job.description || 'The recruiter has not added a role description.'}</p></section>
        {(job.requiredSkills?.length || job.skills?.length) > 0 && <section className="detail-section"><h2>Required skills</h2><div className="job-tags">{(job.requiredSkills?.length ? job.requiredSkills : job.skills).map((skill) => <span key={skill}>{skill}</span>)}</div>{job.preferredSkills?.length > 0 && <p className="muted">Preferred: {job.preferredSkills.join(', ')}</p>}</section>}
        <section className="detail-section"><h2>Role information</h2><dl className="role-facts"><div><dt>Company</dt><dd>{job.company || 'Not specified'}</dd></div><div><dt>Location</dt><dd>{job.location || 'Not specified'}</dd></div><div><dt>Employment type</dt><dd>{job.employmentType?.replace('-', ' ') || 'Not specified'}</dd></div><div><dt>Experience</dt><dd>{job.experienceLevel || 'Not specified'}</dd></div></dl></section>
      </div>
      <aside className="detail-action-panel"><div><span>Compensation</span><strong>{job.salary || 'Not specified'}</strong></div><div><span>Location</span><strong>{job.location || 'Not specified'}</strong></div><div><span>Employment type</span><strong>{job.employmentType?.replace('-', ' ') || 'Not specified'}</strong></div><div><span>Experience</span><strong>{job.experienceLevel || 'Not specified'}</strong></div>{job.recruiter?.name && <div><span>Hiring contact</span><strong>{job.recruiter.name}</strong></div>}
        {authLoading || currentApplicationState.state === 'checking' ? <p className="application-checking" role="status">Checking application status…</p> : user?.role === 'applicant' && currentApplicationState.state === 'error' ? <div className="application-check-error" role="alert"><p>Unable to check application status. Please try again.</p><button className="secondary-button" type="button" onClick={() => setApplicationCheckAttempt((attempt) => attempt + 1)}>Retry</button></div> : user?.role === 'applicant' && currentApplicationState.state === 'applied' ? <section className="job-application-state"><div className="job-application-state-heading"><span aria-hidden="true">✓</span><strong>{({ APPLIED: 'Application Submitted', UNDER_REVIEW: 'Application Submitted', SHORTLISTED: 'Shortlisted', INTERVIEW: 'Interview Stage', SELECTED: 'Selected', REJECTED: 'Application Closed', WITHDRAWN: 'Application Withdrawn' })[currentApplicationState.application?.status] || 'Application Submitted'}</strong></div><div className="job-application-state-facts"><div><span>Application status</span><StatusBadge status={currentApplicationState.application?.status || 'APPLIED'} /></div><div><span>Applied on</span><strong>{currentApplicationState.application?.appliedAt ? new Date(currentApplicationState.application.appliedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Date unavailable'}</strong></div></div>{currentApplicationState.application?._id && <a className="primary-button" href={`/applications/${currentApplicationState.application._id}`}>View application</a>}</section> : user?.role === 'applicant' && currentApplicationState.state === 'not-applied' ? <button className="primary-button" type="button" onClick={beginApplication} disabled={preparingApplication}>{preparingApplication ? 'Checking profile…' : 'Apply now'}</button> : !user ? <a className="primary-button" href="/login">Sign in to apply</a> : <p className="muted">Recruiter accounts cannot apply for jobs.</p>}
        <button className="secondary-button share-job-button" type="button" onClick={shareJob}>Share job</button></aside>
    </div>
    {applicationFlow && <ApplyFlowDialog step={applicationFlow} job={job} account={applicationProfile?.account} profile={applicationProfile?.profile} readiness={applicationProfile?.readiness} applicationId={applicationId} submitting={submittingApplication} error={applicationError} onClose={closeApplicationFlow} onCompleteProfile={() => { window.location.assign('/profile') }} onConfirm={confirmApplication} onViewResume={viewResume} />}
  </article>
}
