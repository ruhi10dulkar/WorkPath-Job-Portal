import { useEffect, useState } from 'react'
import { applicationService } from '../services/applicationService'
import { ErrorState, LoadingState, StatusBadge } from '../components/PageStates'
import { profileService } from '../services/profileService'
import { openPrivateFile } from '../utils/openPrivateFile'
import { useAuth } from '../context/useAuth'
import { useToast } from '../context/useToast'
import JobFitCard from '../components/JobFitCard'
import RecruitmentTimeline from '../components/RecruitmentTimeline'

const date = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' }) : '-'
const statusActions = { APPLIED: [['UNDER_REVIEW', 'Move to review'], ['SHORTLISTED', 'Shortlist'], ['REJECTED', 'Reject']], UNDER_REVIEW: [['SHORTLISTED', 'Shortlist'], ['REJECTED', 'Reject']], SHORTLISTED: [['INTERVIEW', 'Move to interview'], ['REJECTED', 'Reject']], INTERVIEW: [['SELECTED', 'Mark selected'], ['REJECTED', 'Reject']], SELECTED: [], REJECTED: [] }

export default function ApplicationDetails({ applicationId }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [application, setApplication] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [resumeError, setResumeError] = useState('')
  const [noteText, setNoteText] = useState('')
  const [editingNote, setEditingNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState(null)

  async function load() {
    try { setApplication(await applicationService.getById(applicationId)); setError(false) }
    catch { setError(true) }
    finally { setLoading(false) }
  }
  useEffect(() => { let active = true; applicationService.getById(applicationId).then((item) => { if (active) { setApplication(item); setError(false) } }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [applicationId])

  async function viewResume() { setResumeError(''); try { await openPrivateFile(() => profileService.downloadApplicationResume(applicationId)) } catch (error) { setResumeError(error.message || 'The submitted resume could not be opened.') } }
  async function downloadResume() {
    setResumeError('')
    try { const blob = await profileService.downloadApplicationResume(applicationId); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = application.resumeSnapshot?.originalName || 'resume'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000) }
    catch (error) { setResumeError(error.message || 'The submitted resume could not be downloaded.') }
  }
  async function changeStatus() {
    if (!confirmStatus) return
    setBusy(true)
    try { await applicationService.updateStatus(applicationId, confirmStatus.status); setConfirmStatus(null); await load(); showToast('Application status updated') }
    catch (requestError) { showToast(requestError.message || 'Unable to update application status.', 'error') }
    finally { setBusy(false) }
  }
  async function addNote(event) {
    event.preventDefault(); setBusy(true)
    try { await applicationService.addNote(applicationId, noteText); setNoteText(''); await load(); showToast('Private note added') }
    catch { showToast('Unable to add note.', 'error') }
    finally { setBusy(false) }
  }
  async function saveNote(noteId) {
    setBusy(true)
    try { await applicationService.editNote(applicationId, noteId, editingNote); setEditingNote(''); await load(); showToast('Note updated') }
    catch { showToast('Unable to update note.', 'error') }
    finally { setBusy(false) }
  }
  async function deleteNote(noteId) {
    if (!window.confirm('Delete this private note?')) return
    setBusy(true)
    try { await applicationService.deleteNote(applicationId, noteId); await load(); showToast('Note deleted') }
    catch { showToast('Unable to delete note.', 'error') }
    finally { setBusy(false) }
  }

  if (loading) return <LoadingState label="Loading application" />
  if (error || !application) return <section className="browse-section"><ErrorState message="This application could not be loaded." /><a className="text-link" href={user?.role === 'recruiter' ? '/recruiter/applications' : '/applications'}>Back to applications</a></section>
  const snapshot = application.profileSnapshot || {}
  const job = application.job || {}
  const recruiter = user?.role === 'recruiter'
  const candidateName = snapshot.fullName || application.applicant?.name || 'Candidate'
  const history = application.statusHistory?.length ? application.statusHistory : [{ status: 'APPLIED', changedAt: application.appliedAt, changedBy: 'candidate' }]
  const notes = application.recruiterNoteEntries || []
  const actions = recruiter ? statusActions[application.status] || [] : []

  return <section className="browse-section application-detail-page recruiter-detail-page">
    <a className="text-link detail-back-link" href={recruiter ? '/recruiter/applications' : '/applications'}>Back to {recruiter ? 'applicants' : 'my applications'}</a>
    <header className="candidate-profile-header"><div className="candidate-avatar">{snapshot.profilePhotoUrl ? <img src={profileService.photoUrl(snapshot.profilePhotoUrl)} alt="" /> : candidateName.charAt(0).toUpperCase()}</div><div className="candidate-profile-heading"><p className="eyebrow">{recruiter ? 'CANDIDATE APPLICATION' : 'APPLICATION HISTORY'}</p><h1>{candidateName}</h1><p className="muted">{snapshot.headline || 'Professional profile'}{snapshot.currentLocation ? ` - ${snapshot.currentLocation}` : ''}</p><p className="muted">Applied {date(application.appliedAt)} - {job.title || 'Job unavailable'}</p></div><StatusBadge status={application.status} /></header>
    {application.profileFallback && <p className="profile-fallback-notice">This application predates saved profile snapshots. Details below are from the candidate’s current profile and may have changed since they applied.</p>}
    {recruiter && <div className="candidate-status-actions">{actions.length ? actions.map(([status, label]) => <button key={status} type="button" className={status === 'REJECTED' ? 'danger-button' : 'primary-button'} onClick={() => setConfirmStatus({ status, label })}>{label}</button>) : <p className="muted">{application.status === 'SELECTED' ? 'Candidate selected' : 'This application is closed.'}</p>}</div>}
    <div className="candidate-detail-layout"><main className="candidate-detail-main">
      <JobFitCard match={application.jobFit} title={recruiter ? 'Candidate Job Fit' : 'Your Job Fit'} />
      <section className="application-snapshot"><h2>Contact</h2><div className="detail-facts"><p><span>Email</span><a href={`mailto:${snapshot.email || application.applicant?.email || ''}`}>{snapshot.email || application.applicant?.email || '-'}</a></p><p><span>Phone</span>{snapshot.phone || '-'}</p><p><span>Location</span>{snapshot.currentLocation || '-'}</p></div></section>
      {snapshot.summary && <section className="application-snapshot"><h2>Professional summary</h2><p className="detail-copy">{snapshot.summary}</p></section>}
      <section className="application-snapshot"><h2>Education</h2>{snapshot.education?.length ? <div className="detail-entry-list">{snapshot.education.map((entry, index) => <article key={`${entry.institution}-${index}`}><h3>{entry.degree}{entry.fieldOfStudy ? ` - ${entry.fieldOfStudy}` : ''}</h3><p>{entry.institution}</p><span>{entry.startYear || ''}{entry.endYear ? ` \u2014 ${entry.endYear}` : entry.startYear ? ' \u2014 Present' : ''}{entry.grade ? ` - ${entry.grade}` : ''}</span></article>)}</div> : <p className="muted">No education listed.</p>}</section>
      <section className="application-snapshot"><h2>Skills</h2><div className="job-tags">{snapshot.skills?.length ? snapshot.skills.map((skill) => <span key={skill}>{skill}</span>) : <p className="muted">No skills listed.</p>}</div></section>
      <section className="application-snapshot"><h2>Experience</h2>{snapshot.experience?.length ? <div className="detail-entry-list">{snapshot.experience.map((entry, index) => <article key={`${entry.company}-${index}`}><h3>{entry.jobTitle}</h3><p>{entry.company} - {entry.employmentType?.replace('-', ' ') || 'Role'}</p><span>{date(entry.startDate)} \u2014 {entry.currentlyWorking ? 'Present' : date(entry.endDate)}</span>{entry.description && <p>{entry.description}</p>}</article>)}</div> : <p className="muted">Fresher / No professional experience listed.</p>}</section>
      <section className="application-snapshot"><h2>Projects</h2>{snapshot.projects?.length ? <div className="detail-entry-list">{snapshot.projects.map((entry, index) => <article key={`${entry.name}-${index}`}><h3>{entry.name}</h3>{entry.description && <p>{entry.description}</p>}{entry.technologies?.length > 0 && <span>{entry.technologies.join(' - ')}</span>}{entry.projectUrl && <a href={entry.projectUrl} target="_blank" rel="noreferrer">Project link</a>}{entry.githubUrl && <a href={entry.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}</article>)}</div> : <p className="muted">No projects listed.</p>}</section>
      <section className="application-snapshot"><h2>Certifications</h2>{snapshot.certifications?.length ? <div className="detail-entry-list">{snapshot.certifications.map((entry, index) => <article key={`${entry.name}-${index}`}><h3>{entry.name}</h3><p>{entry.issuer}{entry.issueDate ? ` - ${date(entry.issueDate)}` : ''}</p>{entry.credentialUrl && <a href={entry.credentialUrl} target="_blank" rel="noreferrer">View credential</a>}</article>)}</div> : <p className="muted">No certifications listed.</p>}</section>
      <section className="application-snapshot"><h2>{application.resumeFallback ? 'Current profile resume' : 'Submitted resume'}</h2>{application.resumeSnapshot?.originalName ? <div className="resume-review-card"><span>{application.resumeSnapshot.originalName}</span><div><button className="secondary-button" type="button" onClick={viewResume}>View resume</button><button className="secondary-button" type="button" onClick={downloadResume}>Download</button></div></div> : <p className="muted">No resume is attached to this application.</p>}{resumeError && <p className="form-error" role="alert">{resumeError}</p>}</section>
      <RecruitmentTimeline application={application} recruiter={recruiter} onUpdated={load} />
      
    </main><aside className="candidate-detail-aside"><section className="application-snapshot application-summary-card"><p className="eyebrow">APPLICATION</p><h2>{job.title || 'Job unavailable'}</h2><p className="application-company">{job.company || 'Company not listed'}</p><div className="application-summary-facts"><div><span>Applied</span><strong>{date(application.appliedAt)}</strong></div><div><span>Current status</span><StatusBadge status={application.status} /></div></div></section><section className="application-snapshot application-timeline"><h2>Status history</h2>{history.map((event, index) => <div className="timeline-event" key={`${event.status}-${index}`}><StatusBadge status={event.status} /><time>{new Date(event.changedAt).toLocaleString()}</time></div>)}</section>
      {recruiter && <section className="application-snapshot recruiter-notes"><h2>Internal notes</h2><p className="muted">Private to your recruiting team.</p>{application.recruiterNotes && <article className="legacy-note"><p>{application.recruiterNotes}</p><small>Previous note</small></article>}{notes.map((note) => <article className="recruiter-note" key={note._id}>{editingNote?._id === note._id ? <><textarea value={editingNote.text || ''} onChange={(event) => setEditingNote({ ...editingNote, text: event.target.value })} rows={4} /><div><button className="primary-button" disabled={busy || !editingNote.text?.trim()} type="button" onClick={() => saveNote(note._id)}>Save</button><button className="secondary-button" type="button" onClick={() => setEditingNote('')}>Cancel</button></div></> : <><p>{note.text}</p><time>{date(note.createdAt)}</time><div><button className="text-link" type="button" onClick={() => setEditingNote({ ...note, text: note.text })}>Edit</button><button className="text-link note-delete" type="button" onClick={() => deleteNote(note._id)}>Delete</button></div></>}</article>)}<form onSubmit={addNote}><label htmlFor="new-note">Add a private note</label><textarea id="new-note" value={noteText} onChange={(event) => setNoteText(event.target.value)} maxLength={2000} rows={4} placeholder="Record useful screening observations..." required /><button className="primary-button" disabled={busy || !noteText.trim()} type="submit">Add note</button></form></section>}
    </aside></div>
    {confirmStatus && <div className="dialog-backdrop"><section className="screening-confirm" role="dialog" aria-modal="true"><p className="eyebrow">CONFIRM STATUS CHANGE</p><h2>{confirmStatus.label}?</h2><p>This will move {candidateName} to {confirmStatus.status.replace('_', ' ').toLowerCase()} and notify the candidate.</p><div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => setConfirmStatus(null)}>Cancel</button><button className={confirmStatus.status === 'REJECTED' ? 'danger-button' : 'primary-button'} type="button" disabled={busy} onClick={changeStatus}>{busy ? 'Updating...' : confirmStatus.label}</button></div></section></div>}
  </section>
}

