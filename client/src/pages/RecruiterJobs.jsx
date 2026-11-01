import { useCallback, useEffect, useState } from 'react'
import { jobService } from '../services/jobService'
import { useToast } from '../context/useToast'
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates'
import RecruitmentPipelinePanel from '../components/RecruitmentPipelinePanel'

const emptyJob = { title: '', company: '', description: '', location: '', employmentType: 'full-time', experienceLevel: '', salary: '', skills: '', requiredSkills: '', preferredSkills: '', minExperienceYears: '', maxExperienceYears: '', educationRequirements: '' }
function jobToForm(job) { return { ...job, skills: (job.skills || []).join(', '), requiredSkills: (job.requiredSkills || []).join(', '), preferredSkills: (job.preferredSkills || []).join(', '), educationRequirements: (job.educationRequirements || []).join(', '), minExperienceYears: job.minExperienceYears ?? '', maxExperienceYears: job.maxExperienceYears ?? '' } }

export default function RecruiterJobs() {
  const { showToast } = useToast()
  const [jobs, setJobs] = useState([])
  const [form, setForm] = useState(emptyJob)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [reload, setReload] = useState(0)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    try { setJobs(await jobService.getMyJobs()); setLoadError(false) } catch { setLoadError(true) } finally { setLoading(false) }
  }, [])
  useEffect(() => {
    const request = window.setTimeout(loadJobs, 0)
    return () => window.clearTimeout(request)
  }, [loadJobs, reload])

  function resetForm() { setForm(emptyJob); setEditingId(null) }
  function updateForm(field, value) { setForm((current) => ({ ...current, [field]: value })) }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    const split = (value) => value.split(',').map((item) => item.trim()).filter(Boolean)
    const details = { ...form, skills: split(form.skills), requiredSkills: split(form.requiredSkills), preferredSkills: split(form.preferredSkills), educationRequirements: split(form.educationRequirements), minExperienceYears: form.minExperienceYears === '' ? null : Number(form.minExperienceYears), maxExperienceYears: form.maxExperienceYears === '' ? null : Number(form.maxExperienceYears) }
    try {
      if (editingId) { await jobService.updateJob(editingId, details); showToast('Job updated') }
      else { await jobService.createJob(details); showToast('Job published') }
      resetForm()
      await loadJobs()
    } catch (requestError) { setError(requestError.message || 'Unable to save this job.') } finally { setSaving(false) }
  }

  async function handleDelete(job) {
    setError('')
    try {
      await jobService.deleteJob(job._id)
      if (editingId === job._id) resetForm()
      setJobs((current) => current.filter((item) => item._id !== job._id))
      setConfirmDeleteId(null)
      showToast('Job deleted')
    } catch { setError('Unable to delete this job. Please try again.') }
  }

  function beginEdit(job) {
    setForm(jobToForm(job))
    setEditingId(job._id)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updatePipeline(jobId, pipeline) { setJobs((items) => items.map((job) => job._id === jobId ? { ...job, recruitmentPipeline: pipeline } : job)) }

  return <section className="jobs-section">
    <div className="page-heading"><div><p className="eyebrow">RECRUITER WORKSPACE</p><h1>{editingId ? 'Edit job' : 'Post a job'}</h1><p className="muted">Share a clear role description to reach relevant candidates.</p></div></div>
    <form className="job-form" onSubmit={handleSubmit}>
      <label>Job title<input value={form.title} onChange={(event) => updateForm('title', event.target.value)} minLength="2" maxLength="120" required /></label>
      <label>Company<input value={form.company} onChange={(event) => updateForm('company', event.target.value)} minLength="2" maxLength="120" required /></label>
      <label>Location<input value={form.location} onChange={(event) => updateForm('location', event.target.value)} maxLength="120" required /></label>
      <label>Employment type<select value={form.employmentType} onChange={(event) => updateForm('employmentType', event.target.value)}><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="internship">Internship</option><option value="contract">Contract</option></select></label>
      <label>Experience level<input value={form.experienceLevel} onChange={(event) => updateForm('experienceLevel', event.target.value)} maxLength="80" placeholder="Entry level, 3+ years" required /></label>
      <label>Salary (optional)<input value={form.salary} onChange={(event) => updateForm('salary', event.target.value)} maxLength="100" placeholder="e.g. â‚¹6â€“10 LPA" /></label>
      <label className="job-form-wide">Role description<textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} minLength="20" maxLength="10000" rows="5" required /></label>
      <label className="job-form-wide">Skills, separated by commas<input value={form.skills} onChange={(event) => updateForm('skills', event.target.value)} placeholder="React, Node.js, MongoDB" /></label>
      <label className="job-form-wide">Required skills for Job Fit<input value={form.requiredSkills} onChange={(event) => updateForm('requiredSkills', event.target.value)} placeholder="React, JavaScript" /></label>
      <label className="job-form-wide">Preferred skills for Job Fit<input value={form.preferredSkills} onChange={(event) => updateForm('preferredSkills', event.target.value)} placeholder="Node.js, Git" /></label>
      <label>Minimum experience (years)<input type="number" min="0" max="60" step="0.5" value={form.minExperienceYears} onChange={(event) => updateForm('minExperienceYears', event.target.value)} /></label>
      <label>Maximum experience (years)<input type="number" min="0" max="60" step="0.5" value={form.maxExperienceYears} onChange={(event) => updateForm('maxExperienceYears', event.target.value)} /></label>
      <label className="job-form-wide">Education requirements, separated by commas<input value={form.educationRequirements} onChange={(event) => updateForm('educationRequirements', event.target.value)} placeholder="Computer Science, Computer Engineering" /></label>
      {error && <p className="form-error job-form-wide" role="alert">{error}</p>}
      <div className="job-form-actions job-form-wide">{editingId && <button className="secondary-button" type="button" onClick={resetForm}>Cancel</button>}<button className="primary-button" type="submit" disabled={saving}>{saving ? 'Savingâ€¦' : editingId ? 'Save changes' : 'Publish job'}</button></div>
    </form>
    <section className="listing-section"><div className="section-heading"><div><p className="eyebrow">YOUR LISTINGS</p><h2>Posted jobs</h2></div></div>
      {loadError ? <ErrorState message="Your job listings could not be loaded." onRetry={() => setReload((value) => value + 1)} /> : loading ? <LoadingState label="Loading your job listings" /> : jobs.length === 0 ? <EmptyState title="No jobs posted yet" message="Create your first listing to start reaching applicants." /> : <div className="job-list">{jobs.map((job) => <article className="job-card recruiter-job-card" key={job._id}><div><h3>{job.title}</h3><p className="job-meta">{job.company} · {job.location} · {job.employmentType?.replace('-', ' ')}</p><p className="job-description">{job.description}</p><p className="job-skills"><strong>{job.applicationCount || 0}</strong> applications | {Object.entries(job.applicationsByStatus || {}).filter(([, count]) => count > 0).map(([status, count]) => status.replace('_', ' ').toLowerCase() + ' ' + count).join(' | ') || 'No pipeline activity yet'}</p><a className="row-action" href={'/recruiter/applications?jobId=' + job._id}>View applications</a>{job.skills?.length > 0 && <p className="job-skills">Skills: {job.skills.join(', ')}</p>}{confirmDeleteId === job._id && <p className="delete-confirmation" role="alert">Delete this listing? This cannot be undone.</p>}<RecruitmentPipelinePanel job={job} onSaved={updatePipeline} /></div><div className="job-actions">{confirmDeleteId === job._id ? <><button className="danger-button" type="button" onClick={() => handleDelete(job)}>Confirm delete</button><button className="secondary-button" type="button" onClick={() => setConfirmDeleteId(null)}>Cancel</button></> : <><button className="secondary-button" type="button" onClick={() => beginEdit(job)}>Edit</button><button className="danger-button" type="button" onClick={() => setConfirmDeleteId(job._id)}>Delete</button></>}</div></article>)}</div>}
    </section>
  </section>
}
