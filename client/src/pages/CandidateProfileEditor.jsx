import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { useToast } from '../context/useToast'
import { ErrorState, LoadingState } from '../components/PageStates'
import ProfileField from '../components/profile/ProfileField'
import ProfileSection from '../components/profile/ProfileSection'
import { profileService } from '../services/profileService'
import { openPrivateFile } from '../utils/openPrivateFile'

const blankProfile = {
  basicInfo: { fullName: '', phone: '', currentLocation: '', headline: '', summary: '', portfolioUrl: '', githubUrl: '', linkedInUrl: '' },
  education: [], skills: [], isFresher: true, experience: [], projects: [], certifications: [], resume: null,
  preferences: { preferredJobTitles: [], preferredLocations: [], workModes: [], employmentTypes: [], expectedSalary: '' },
}
const employmentOptions = [
  { value: 'full-time', label: 'Full-time' }, { value: 'part-time', label: 'Part-time' },
  { value: 'internship', label: 'Internship' }, { value: 'contract', label: 'Contract' }, { value: 'freelance', label: 'Freelance' },
]
function mergeProfile(profile) {
  return { ...blankProfile, ...profile, basicInfo: { ...blankProfile.basicInfo, ...profile.basicInfo }, preferences: { ...blankProfile.preferences, ...profile.preferences } }
}
function updateListItem(setProfile, list, index, key, value) {
  setProfile((current) => ({ ...current, [list]: current[list].map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }))
}
function removeListItem(setProfile, list, index) {
  setProfile((current) => ({ ...current, [list]: current[list].filter((_, itemIndex) => itemIndex !== index) }))
}
function toggleValue(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

export default function CandidateProfileEditor() {
  const { refreshCurrentUser } = useAuth()
  const { showToast } = useToast()
  const fileInput = useRef(null)
  const [profile, setProfile] = useState(blankProfile)
  const [account, setAccount] = useState(null)
  const [readiness, setReadiness] = useState(null)
  const [newSkill, setNewSkill] = useState('')
  const [newSkillError, setNewSkillError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(true)
  const [saveError, setSaveError] = useState('')
  const [resumeError, setResumeError] = useState('')
  const [photoDialog, setPhotoDialog] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [photoSaving, setPhotoSaving] = useState(false)
  const photoInput = useRef(null)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const result = await profileService.getMine()
      setProfile(mergeProfile(result.profile))
      setAccount(result.account)
      setReadiness(result.readiness)
      setEditing(!result.readiness.ready)
    } catch { setLoadError(true) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    const request = window.setTimeout(loadProfile, 0)
    return () => window.clearTimeout(request)
  }, [loadProfile])

  const initials = useMemo(() => (profile.basicInfo.fullName || account?.name || 'U').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(''), [profile.basicInfo.fullName, account?.name])
  function updateBasic(key, value) { setProfile((current) => ({ ...current, basicInfo: { ...current.basicInfo, [key]: value } })) }
  function updatePreference(key, value) { setProfile((current) => ({ ...current, preferences: { ...current.preferences, [key]: value } })) }

  function validateCollections() {
    const incompleteEducation = profile.education.some((item) => !item.degree.trim() || !item.fieldOfStudy.trim() || !item.institution.trim() || !item.startYear || (item.endYear && Number(item.endYear) < Number(item.startYear)))
    if (incompleteEducation) return 'Finish each education entry and check the year range before saving.'
    const incompleteExperience = profile.experience.some((item) => !item.company.trim() || !item.jobTitle.trim() || !item.startDate || (!item.currentlyWorking && (!item.endDate || item.endDate < item.startDate)))
    if (incompleteExperience) return 'Finish each experience entry and check the date range before saving.'
    if (profile.projects.some((item) => !item.name.trim())) return 'Add a project name or remove the empty project entry.'
    if (profile.certifications.some((item) => !item.name.trim() || !item.issuer.trim())) return 'Add a certificate name and issuing organization or remove the empty entry.'
    return ''
  }

  async function saveProfile() {
    const validationMessage = validateCollections()
    if (validationMessage) { setSaveError(validationMessage); return }
    setSaving(true)
    setSaveError('')
    try {
      const result = await profileService.update({
        basicInfo: profile.basicInfo,
        education: profile.education,
        skills: profile.skills,
        isFresher: profile.isFresher,
        experience: profile.experience,
        projects: profile.projects.map((item) => ({ ...item, technologies: typeof item.technologies === 'string' ? item.technologies.split(',').map((value) => value.trim()).filter(Boolean) : item.technologies })),
        certifications: profile.certifications,
        preferences: { ...profile.preferences, preferredJobTitles: typeof profile.preferences.preferredJobTitles === 'string' ? profile.preferences.preferredJobTitles.split(',').map((value) => value.trim()).filter(Boolean) : profile.preferences.preferredJobTitles, preferredLocations: typeof profile.preferences.preferredLocations === 'string' ? profile.preferences.preferredLocations.split(',').map((value) => value.trim()).filter(Boolean) : profile.preferences.preferredLocations },
      })
      setProfile(mergeProfile(result.profile))
      setReadiness(result.readiness)
      setEditing(false)
      await refreshCurrentUser()
      showToast('Profile updated successfully.')
    } catch (error) {
      setSaveError(error.message?.startsWith('Enter ') || error.message?.includes('cannot') || error.message?.includes('must') ? error.message : "We couldn't save your changes. Please try again.")
    } finally { setSaving(false) }
  }

  function addSkill(event) {
    event.preventDefault()
    const skill = newSkill.trim().replace(/\s+/g, ' ')
    if (!skill) return
    if (profile.skills.some((existing) => existing.toLocaleLowerCase() === skill.toLocaleLowerCase())) { setNewSkillError('That skill is already in your profile.'); return }
    setProfile((current) => ({ ...current, skills: [...current.skills, skill] }))
    setNewSkill('')
    setNewSkillError('')
  }

  async function uploadResume(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setResumeError('')
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'doc', 'docx'].includes(extension) || file.size > 5 * 1024 * 1024) {
      setResumeError('Choose a PDF, DOC, or DOCX file under 5 MB.')
      event.target.value = ''
      return
    }
    setUploading(true)
    try {
      const result = await profileService.uploadResume(file)
      setProfile(mergeProfile(result.profile))
      setReadiness(result.readiness)
      showToast('Resume uploaded successfully.')
    } catch { setResumeError("Couldn't upload your resume. Check the file type and size, then try again.") }
    finally { setUploading(false); event.target.value = '' }
  }

  async function viewResume() {
    try { await openPrivateFile(() => profileService.downloadResume()) }
    catch { setResumeError('Unable to open your resume. Please try again.') }
  }

  async function deleteResume() {
    if (!window.confirm('Remove this resume from your profile? Previous applications keep their submitted resume version.')) return
    setResumeError('')
    try {
      const result = await profileService.removeResume()
      setProfile((current) => ({ ...current, resume: null }))
      setReadiness(result.readiness)
      showToast('Resume removed from your profile.')
    } catch { setResumeError('Unable to remove your resume. Please try again.') }
  }

  function choosePhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setPhotoError('Please upload a JPG, PNG, or WebP image under 5 MB.')
      return
    }
    setPhotoError('')
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function savePhoto() {
    if (!photoFile) return
    setPhotoSaving(true)
    setPhotoError('')
    try {
      const result = await profileService.uploadProfilePhoto(photoFile)
      setProfile((current) => ({ ...current, profilePhoto: result.profile.profilePhoto }))
      window.dispatchEvent(new CustomEvent('workpath-profile-photo-updated', { detail: result.profile.profilePhoto?.url || '' }))
      setPhotoDialog(false)
      showToast('Profile photo updated.')
    } catch { setPhotoError('Unable to upload photo. Please try again.') }
    finally { setPhotoSaving(false); setPhotoFile(null); setPhotoPreview('') }
  }

  function closePhotoDialog() {
    if (photoSaving) return
    setPhotoDialog(false)
    setPhotoFile(null)
    setPhotoPreview('')
    setPhotoError('')
  }

  async function removePhoto() {
    setPhotoSaving(true)
    setPhotoError('')
    try {
      await profileService.removeProfilePhoto()
      setProfile((current) => ({ ...current, profilePhoto: null }))
      window.dispatchEvent(new CustomEvent('workpath-profile-photo-updated', { detail: '' }))
      setPhotoDialog(false)
      showToast('Profile photo removed.')
    } catch { setPhotoError('Unable to remove photo. Please try again.') }
    finally { setPhotoSaving(false) }
  }

  if (loading) return <section className="profile-page"><LoadingState label="Loading candidate profile" /></section>
  if (loadError) return <section className="profile-page"><ErrorState message="Your profile could not be loaded." onRetry={loadProfile} /></section>

  return <section className="profile-page candidate-profile-page">
    <div className="page-heading"><div><p className="eyebrow">CANDIDATE WORKSPACE</p><h1>Your profile</h1><p className="muted">Complete your profile once and apply to jobs faster.</p></div><div className="profile-heading-actions">{readiness?.ready && <span className="profile-ready-badge">✓ Profile ready</span>}{editing ? <button className="primary-button" type="button" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button> : <button className="secondary-button" type="button" onClick={() => setEditing(true)}>Edit profile</button>}</div></div>
    {saveError && <p className="profile-form-alert" role="alert">{saveError}</p>}
    <div className="candidate-profile-layout">
      <aside className="candidate-profile-sidebar">
        <section className="candidate-summary-card"><button className="candidate-avatar candidate-avatar-button" type="button" onClick={() => { setPhotoDialog(true); setPhotoError('') }} aria-label="Change profile photo"><span className="candidate-avatar-content">{profile.profilePhoto?.url ? <img src={profileService.photoUrl(profile.profilePhoto.url)} alt="" /> : initials}</span><span className="candidate-avatar-overlay"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg><span>Change photo</span></span></button><div className="candidate-summary-main"><h2>{profile.basicInfo.fullName || account?.name || 'Your name'}</h2><p>{profile.basicInfo.headline || 'Add a professional headline'}</p><span>{profile.basicInfo.currentLocation || 'Add your location'}</span></div><div className="candidate-progress"><div className="candidate-progress-label"><span>Profile completion</span><strong>{readiness?.completionPercentage || 0}%</strong></div><div className="readiness-progress" role="progressbar" aria-valuenow={readiness?.completionPercentage || 0} aria-valuemin="0" aria-valuemax="100" aria-label="Profile completion"><span style={{ width: `${readiness?.completionPercentage || 0}%` }} /></div><p>{readiness?.ready ? 'Your profile is ready for job applications.' : 'Complete the required details before applying.'}</p></div><ul className="readiness-checklist">{readiness?.checklist?.map((item) => <li key={item.key} className={item.complete ? 'is-complete' : 'is-missing'}><span aria-hidden="true">{item.complete ? '✓' : '○'}</span>{item.label}</li>)}</ul><a className="secondary-button" href="/jobs">Explore jobs</a></section>
        <nav className="profile-section-nav" aria-label="Profile sections">{[['basic-information', 'Basic information'], ['education', 'Education'], ['skills', 'Skills'], ['experience', 'Experience'], ['projects', 'Projects'], ['certifications', 'Certifications'], ['resume', 'Resume'], ['preferences', 'Job preferences']].map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}</nav>
      </aside>
      <div className="candidate-profile-sections">
        <ProfileSection id="basic-information" eyebrow="REQUIRED" title="Basic information" description="Your verified account email is read-only.">
          <div className="profile-fields-grid">
            <ProfileField label="Full name" value={profile.basicInfo.fullName} disabled={!editing || saving} onChange={(value) => updateBasic('fullName', value)} />
            <ProfileField label="Email address" value={account?.email || ''} readOnly />
            <ProfileField label="Phone number" value={profile.basicInfo.phone} type="tel" placeholder="+91 98765 43210" disabled={!editing || saving} onChange={(value) => updateBasic('phone', value)} />
            <ProfileField label="Current city" value={profile.basicInfo.currentLocation} placeholder="Pune, Maharashtra" disabled={!editing || saving} onChange={(value) => updateBasic('currentLocation', value)} />
            <ProfileField label="Professional headline" value={profile.basicInfo.headline} placeholder="Computer Engineering student" disabled={!editing || saving} onChange={(value) => updateBasic('headline', value)} />
            <ProfileField label="Professional summary" value={profile.basicInfo.summary} type="textarea" placeholder="A short introduction about your goals and strengths" disabled={!editing || saving} onChange={(value) => updateBasic('summary', value)} />
            <ProfileField label="Portfolio URL" value={profile.basicInfo.portfolioUrl} type="url" placeholder="https://…" disabled={!editing || saving} onChange={(value) => updateBasic('portfolioUrl', value)} />
            <ProfileField label="GitHub URL" value={profile.basicInfo.githubUrl} type="url" placeholder="https://github.com/…" disabled={!editing || saving} onChange={(value) => updateBasic('githubUrl', value)} />
            <ProfileField label="LinkedIn URL" value={profile.basicInfo.linkedInUrl} type="url" placeholder="https://linkedin.com/in/…" disabled={!editing || saving} onChange={(value) => updateBasic('linkedInUrl', value)} />
          </div>
        </ProfileSection>

        <ProfileSection id="education" eyebrow="REQUIRED" title="Education" description="Add at least one completed or current education record." count={profile.education.length}>
          {profile.education.map((item, index) => <div className="profile-entry-card" key={item._id || index}><div className="profile-entry-heading"><strong>Education {index + 1}</strong>{editing && <button className="text-button remove-entry" type="button" onClick={() => removeListItem(setProfile, 'education', index)}>Remove</button>}</div><div className="profile-fields-grid"><ProfileField label="Degree" value={item.degree} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'education', index, 'degree', value)} /><ProfileField label="Field of study" value={item.fieldOfStudy} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'education', index, 'fieldOfStudy', value)} /><ProfileField label="Institution" value={item.institution} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'education', index, 'institution', value)} /><ProfileField label="Start year" type="number" min="1950" max={new Date().getFullYear() + 15} value={item.startYear ?? ''} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'education', index, 'startYear', value)} /><ProfileField label="End year" type="number" min={item.startYear || 1950} max={new Date().getFullYear() + 15} placeholder="Leave blank if current" value={item.endYear ?? ''} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'education', index, 'endYear', value)} /><ProfileField label="CGPA / percentage" value={item.grade} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'education', index, 'grade', value)} /></div></div>)}
          {editing && <button className="add-entry-button" type="button" onClick={() => setProfile((current) => ({ ...current, education: [...current.education, { degree: '', fieldOfStudy: '', institution: '', startYear: '', endYear: '', grade: '' }] }))}>+ Add education</button>}
        </ProfileSection>

        <ProfileSection id="skills" eyebrow="REQUIRED" title="Skills" description="Add skills you can discuss and demonstrate." count={profile.skills.length}>
          <form className="skill-entry-form" onSubmit={addSkill}><label className="profile-field"><span>Add a skill</span><input value={newSkill} onChange={(event) => { setNewSkill(event.target.value); setNewSkillError('') }} placeholder="e.g. React" disabled={!editing || saving} /></label><button className="secondary-button" type="submit" disabled={!editing || saving}>Add skill</button></form>
          {newSkillError && <p className="form-error" role="alert">{newSkillError}</p>}
          <div className="profile-skill-list">{profile.skills.map((skill) => <span className="profile-skill" key={skill}>{skill}{editing && <button type="button" aria-label={`Remove ${skill}`} onClick={() => setProfile((current) => ({ ...current, skills: current.skills.filter((item) => item !== skill) }))}>×</button>}</span>)}</div>
          {!profile.skills.length && <p className="muted">Your skills will appear here when you add them.</p>}
        </ProfileSection>

        <ProfileSection id="experience" eyebrow="OPTIONAL" title="Experience" description="Freshers can skip this section." count={profile.isFresher ? 'Fresher' : profile.experience.length}>
          <fieldset className="fresher-choice" disabled={!editing || saving}><legend>Are you a fresher?</legend><label><input type="radio" name="fresher" checked={profile.isFresher} onChange={() => setProfile((current) => ({ ...current, isFresher: true }))} />Yes</label><label><input type="radio" name="fresher" checked={!profile.isFresher} onChange={() => setProfile((current) => ({ ...current, isFresher: false }))} />No</label></fieldset>
          {!profile.isFresher && <>{profile.experience.map((item, index) => <div className="profile-entry-card" key={item._id || index}><div className="profile-entry-heading"><strong>Experience {index + 1}</strong>{editing && <button className="text-button remove-entry" type="button" onClick={() => removeListItem(setProfile, 'experience', index)}>Remove</button>}</div><div className="profile-fields-grid"><ProfileField label="Company" value={item.company} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'experience', index, 'company', value)} /><ProfileField label="Job title" value={item.jobTitle} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'experience', index, 'jobTitle', value)} /><ProfileField label="Employment type" type="select" value={item.employmentType} options={employmentOptions} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'experience', index, 'employmentType', value)} /><ProfileField label="Start date" type="date" value={item.startDate} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'experience', index, 'startDate', value)} />{!item.currentlyWorking && <ProfileField label="End date" type="date" value={item.endDate} min={item.startDate} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'experience', index, 'endDate', value)} />}<label className="profile-checkbox profile-field-wide"><input type="checkbox" checked={Boolean(item.currentlyWorking)} disabled={!editing || saving} onChange={(event) => setProfile((current) => ({ ...current, experience: current.experience.map((row, rowIndex) => rowIndex === index ? { ...row, currentlyWorking: event.target.checked, endDate: event.target.checked ? '' : row.endDate } : row) }))} />I currently work here</label><ProfileField label="Description" type="textarea" value={item.description} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'experience', index, 'description', value)} /></div></div>)}{editing && <button className="add-entry-button" type="button" onClick={() => setProfile((current) => ({ ...current, isFresher: false, experience: [...current.experience, { company: '', jobTitle: '', employmentType: 'full-time', startDate: '', endDate: '', currentlyWorking: false, description: '' }] }))}>+ Add experience</button>}</>}
        </ProfileSection>

        <ProfileSection id="projects" eyebrow="OPTIONAL" title="Projects" description="Projects can help show your work, especially when you are starting out." count={profile.projects.length}>
          {profile.projects.map((item, index) => <div className="profile-entry-card" key={item._id || index}><div className="profile-entry-heading"><strong>Project {index + 1}</strong>{editing && <button className="text-button remove-entry" type="button" onClick={() => removeListItem(setProfile, 'projects', index)}>Remove</button>}</div><div className="profile-fields-grid"><ProfileField label="Project name" value={item.name} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'projects', index, 'name', value)} /><ProfileField label="Technologies (comma separated)" value={Array.isArray(item.technologies) ? item.technologies.join(', ') : item.technologies} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'projects', index, 'technologies', value)} /><ProfileField label="Project URL" type="url" value={item.projectUrl} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'projects', index, 'projectUrl', value)} /><ProfileField label="GitHub URL" type="url" value={item.githubUrl} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'projects', index, 'githubUrl', value)} /><ProfileField label="Description" type="textarea" value={item.description} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'projects', index, 'description', value)} /></div></div>)}
          {editing && <button className="add-entry-button" type="button" onClick={() => setProfile((current) => ({ ...current, projects: [...current.projects, { name: '', description: '', technologies: [], projectUrl: '', githubUrl: '' }] }))}>+ Add project</button>}
        </ProfileSection>

        <ProfileSection id="certifications" eyebrow="OPTIONAL" title="Certifications" count={profile.certifications.length}>
          {profile.certifications.map((item, index) => <div className="profile-entry-card" key={item._id || index}><div className="profile-entry-heading"><strong>Certification {index + 1}</strong>{editing && <button className="text-button remove-entry" type="button" onClick={() => removeListItem(setProfile, 'certifications', index)}>Remove</button>}</div><div className="profile-fields-grid"><ProfileField label="Certificate name" value={item.name} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'certifications', index, 'name', value)} /><ProfileField label="Issuing organization" value={item.issuer} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'certifications', index, 'issuer', value)} /><ProfileField label="Issue date" type="date" value={item.issueDate} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'certifications', index, 'issueDate', value)} /><ProfileField label="Credential URL" type="url" value={item.credentialUrl} disabled={!editing || saving} onChange={(value) => updateListItem(setProfile, 'certifications', index, 'credentialUrl', value)} /></div></div>)}
          {editing && <button className="add-entry-button" type="button" onClick={() => setProfile((current) => ({ ...current, certifications: [...current.certifications, { name: '', issuer: '', issueDate: '', credentialUrl: '' }] }))}>+ Add certification</button>}
        </ProfileSection>

        <ProfileSection id="resume" eyebrow="REQUIRED TO APPLY" title="Resume" description="One primary resume stays on your profile. Replace it when you want to use a newer version." className="resume-profile-section">
          {profile.resume ? <div className="resume-file-card"><span className="resume-file-icon" aria-hidden="true">PDF</span><div className="resume-file-details"><strong>{profile.resume.originalName}</strong><span>Uploaded {new Date(profile.resume.uploadedAt).toLocaleDateString()} · {(profile.resume.size / (1024 * 1024)).toFixed(1)} MB</span></div><div className="resume-file-actions"><button className="text-link-button" type="button" onClick={viewResume}>View resume</button><button className="text-button remove-entry" type="button" onClick={deleteResume}>Remove</button></div></div> : <p className="resume-empty">No resume uploaded yet. A PDF, DOC, or DOCX file under 5 MB is required to apply.</p>}
          <div className="resume-upload-control"><input ref={fileInput} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={uploadResume} disabled={uploading} aria-label="Upload a PDF, DOC, or DOCX resume" /><button className="secondary-button" type="button" onClick={() => fileInput.current?.click()} disabled={uploading}>{uploading ? 'Uploading…' : profile.resume ? 'Replace resume' : 'Upload resume'}</button></div>
          {resumeError && <p className="form-error" role="alert">{resumeError}</p>}
          <p className="muted resume-privacy-note">Only you and recruiters reviewing your applications can access submitted resume copies.</p>
        </ProfileSection>

        <ProfileSection id="preferences" eyebrow="OPTIONAL" title="Job preferences" description="Save preferences for future discovery features.">
          <div className="profile-fields-grid"><ProfileField label="Preferred job titles (comma separated)" value={profile.preferences.preferredJobTitles.join(', ')} disabled={!editing || saving} onChange={(value) => updatePreference('preferredJobTitles', value)} /><ProfileField label="Preferred locations (comma separated)" value={profile.preferences.preferredLocations.join(', ')} disabled={!editing || saving} onChange={(value) => updatePreference('preferredLocations', value)} /><ProfileField label="Expected salary" value={profile.preferences.expectedSalary} placeholder="e.g. ₹8–10 LPA" disabled={!editing || saving} onChange={(value) => updatePreference('expectedSalary', value)} /></div>
          <fieldset className="preference-checks" disabled={!editing || saving}><legend>Work mode</legend>{[['remote', 'Remote'], ['hybrid', 'Hybrid'], ['on-site', 'On-site']].map(([value, label]) => <label key={value}><input type="checkbox" checked={profile.preferences.workModes.includes(value)} onChange={() => updatePreference('workModes', toggleValue(profile.preferences.workModes, value))} />{label}</label>)}</fieldset>
          <fieldset className="preference-checks" disabled={!editing || saving}><legend>Employment type</legend>{employmentOptions.filter(({ value }) => value !== 'freelance').map(({ value, label }) => <label key={value}><input type="checkbox" checked={profile.preferences.employmentTypes.includes(value)} onChange={() => updatePreference('employmentTypes', toggleValue(profile.preferences.employmentTypes, value))} />{label}</label>)}</fieldset>
        </ProfileSection>
        {editing && <div className="profile-bottom-actions"><p className="muted">Your changes stay in this form until saved.</p><button className="primary-button" type="button" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>}
      </div>
    </div>
    {photoDialog && <div className="profile-photo-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePhotoDialog() }}><section className="profile-photo-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-photo-title"><h2 id="profile-photo-title">Profile photo</h2><div className="profile-photo-preview">{photoPreview ? <img src={photoPreview} alt="Preview of selected profile photo" /> : profile.profilePhoto?.url ? <img src={profileService.photoUrl(profile.profilePhoto.url)} alt="Current profile photo" /> : <span>{initials}</span>}</div><input ref={photoInput} className="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} aria-label="Choose a profile photo" /><button className="text-link-button" type="button" onClick={() => photoInput.current?.click()} disabled={photoSaving}>{photoFile ? 'Choose another' : 'Choose photo'}</button>{photoError && <p className="form-error" role="alert">{photoError}</p>}<div className="profile-photo-actions"><button className="secondary-button" type="button" onClick={closePhotoDialog} disabled={photoSaving}>Cancel</button>{profile.profilePhoto?.url && !photoFile && <button className="text-button remove-entry" type="button" onClick={removePhoto} disabled={photoSaving}>Remove photo</button>}<button className="primary-button" type="button" onClick={savePhoto} disabled={!photoFile || photoSaving}>{photoSaving ? 'Saving…' : 'Save photo'}</button></div></section></div>}
  </section>
}
