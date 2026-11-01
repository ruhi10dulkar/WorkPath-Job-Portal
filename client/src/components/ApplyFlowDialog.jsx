import { useEffect, useRef } from 'react'

function EducationSummary({ education }) {
  if (!education?.length) return <p className="muted">No education details saved.</p>
  return <ul className="review-list">{education.map((entry, index) => <li key={`${entry.institution}-${index}`}><strong>{entry.degree} {entry.fieldOfStudy}</strong><span>{entry.institution} · {entry.startYear}{entry.endYear ? `–${entry.endYear}` : '–Present'}</span></li>)}</ul>
}

export default function ApplyFlowDialog({ step, job, account, profile, readiness, applicationId, submitting, error, onClose, onCompleteProfile, onConfirm, onViewResume }) {
  const closeButton = useRef(null)
  useEffect(() => {
    closeButton.current?.focus()
    function onKeyDown(event) { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const title = step === 'blocked' ? 'Complete your profile before applying' : step === 'success' ? 'Application submitted' : step === 'duplicate' ? "You've already applied" : 'Review your application'
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="apply-dialog" role="dialog" aria-modal="true" aria-labelledby="apply-dialog-title" tabIndex={-1}>
      <div className="apply-dialog-heading"><div><p className="eyebrow">WORKPATH APPLICATION</p><h2 id="apply-dialog-title">{title}</h2></div><button ref={closeButton} className="dialog-close" type="button" aria-label="Close dialog" onClick={onClose}>×</button></div>
      {step === 'blocked' && <div className="dialog-content">
        <p className="muted">Add the missing details once, then you can apply to roles faster.</p>
        <ul className="readiness-checklist">{readiness?.checklist?.map((item) => <li className={item.complete ? 'is-complete' : 'is-missing'} key={item.key}><span aria-hidden="true">{item.complete ? '✓' : '○'}</span>{item.label}</li>)}</ul>
        {readiness?.missingItems?.length > 0 && <p className="form-error">Still needed: {readiness.missingItems.join(', ')}.</p>}
        <div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>Keep browsing</button><button className="primary-button" type="button" onClick={onCompleteProfile}>Complete profile</button></div>
      </div>}
      {step === 'review' && <div className="dialog-content">
        <div className="review-job"><div className="company-mark" aria-hidden="true">{job.company?.trim()?.[0]?.toUpperCase() || 'C'}</div><div><strong>{job.title}</strong><span>{job.company} · {job.location}</span></div></div>
        <div className="review-candidate"><h3>Candidate details</h3><p><strong>{profile?.basicInfo?.fullName || account?.name}</strong>{profile?.basicInfo?.headline ? ` · ${profile.basicInfo.headline}` : ''}</p><p>{account?.email} · {profile?.basicInfo?.phone}</p><p>{profile?.basicInfo?.currentLocation}</p></div>
        <div className="review-candidate"><h3>Education</h3><EducationSummary education={profile?.education} /></div>
        <div className="review-candidate"><h3>Skills</h3><div className="job-tags">{profile?.skills?.map((skill) => <span key={skill}>{skill}</span>)}</div></div>
        <div className="review-resume"><div><h3>Resume</h3><p>{profile?.resume?.originalName}</p></div><button className="text-link-button" type="button" onClick={onViewResume}>View resume</button></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>Back</button><button className="primary-button" type="button" disabled={submitting} onClick={onConfirm}>{submitting ? 'Applying…' : 'Confirm & apply'}</button></div>
      </div>}
      {step === 'success' && <div className="dialog-content"><div className="application-success-mark" aria-hidden="true">✓</div><p className="success-heading">{job.title}</p><p className="muted">{job.company} · {job.location}</p><p className="muted">Your application has been successfully submitted.</p><div className="dialog-actions"><a className="secondary-button" href="/jobs">Browse more jobs</a><a className="primary-button" href={`/applications/${applicationId}`}>View application</a></div></div>}
      {step === 'duplicate' && <div className="dialog-content"><p className="muted">This account already has an application for {job.title} at {job.company}.</p><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>Close</button><a className="primary-button" href={applicationId ? `/applications/${applicationId}` : '/applications'}>View application</a></div></div>}
    </section>
  </div>
}
