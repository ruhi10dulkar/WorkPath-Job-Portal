import { useEffect, useState } from 'react'
import { applicationService } from '../services/applicationService'
import { jobService } from '../services/jobService'
import { useToast } from '../context/useToast'
import { EmptyState, ErrorState, LoadingState } from './PageStates'

const types = [['ASSESSMENT','Assessment'],['APTITUDE_TEST','Aptitude Test'],['CODING_TEST','Coding Test'],['TECHNICAL_INTERVIEW','Technical Interview'],['TECHNICAL_INTERVIEW_2','Technical Interview 2'],['SYSTEM_DESIGN','System Design Interview'],['MANAGERIAL_INTERVIEW','Managerial Interview'],['HR_INTERVIEW','HR Interview'],['GROUP_DISCUSSION','Group Discussion'],['ASSIGNMENT','Assignment'],['CUSTOM','Custom Round']]
const platforms = ['Google Meet', 'Microsoft Teams', 'Zoom', 'HackerRank', 'HackerEarth', 'Codility', 'CodeSignal', 'Company Platform', 'Other']
const emptyStage = () => ({ type: 'ASSESSMENT', title: 'Assessment', description: '', instructions: '', duration: 45, mode: 'ONLINE', platform: '', link: '', scheduledAtLocal: '', location: '', interviewerLabels: '', interviewerInstructions: '', evaluationCriteria: [] })
const dateTimeInput = (value) => value ? new Date(value).toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(' ', 'T') : ''
const migrateLegacySchedule = (instructions = '') => {
  const match = instructions.match(/Date\s*[-:]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})[\s\S]*?Time\s*[-:]\s*(\d{1,2})[.:](\d{2})\s*(AM|PM)/i)
  if (!match) return { scheduledAtLocal: '', instructions }
  const [, day, month, year, rawHour, minute, meridiem] = match
  const hour = (Number(rawHour) % 12) + (meridiem.toUpperCase() === 'PM' ? 12 : 0)
  const scheduledAtLocal = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(hour).padStart(2, '0')}:${minute}`
  return { scheduledAtLocal, instructions: instructions.replace(match[0], '').trim() }
}
const toDraft = (round) => {
  const legacySchedule = migrateLegacySchedule(round.instructions || '')
  return { ...emptyStage(), ...round, id: round._id || round.id, instructions: legacySchedule.instructions, scheduledAtLocal: dateTimeInput(round.scheduledAt) || legacySchedule.scheduledAtLocal, interviewerLabels: round.interviewerLabels || '', interviewerInstructions: round.interviewerInstructions || '', evaluationCriteria: round.evaluationCriteria || [] }
}
const dateTime = (value) => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''

export default function RecruitmentPipelinePanel({ job, onSaved }) {
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('pipeline')
  const [draft, setDraft] = useState(() => (job.recruitmentPipeline || []).map(toDraft))
  const [editingIndex, setEditingIndex] = useState(null)
  const [stageForm, setStageForm] = useState(emptyStage())
  const [saving, setSaving] = useState(false)
  const [stageManagement, setStageManagement] = useState([])
  const [candidatesBusy, setCandidatesBusy] = useState(false)
  const [candidatesError, setCandidatesError] = useState(false)
  const [candidateReload, setCandidateReload] = useState(0)
  const [stageFilter, setStageFilter] = useState('')
  const [stageBucket, setStageBucket] = useState('eligible')

  useEffect(() => {
    if (!open || tab !== 'candidates') return
    let active = true
    applicationService.getForRecruiter({ jobId: job._id, limit: 50, includeStageData: true })
      .then((result) => { if (active) { setStageManagement(result.stageManagement || []); setStageFilter((value) => value || String(result.stageManagement?.[0]?.roundId || '')); setCandidatesError(false) } })
      .catch(() => { if (active) setCandidatesError(true) })
      .finally(() => { if (active) setCandidatesBusy(false) })
    return () => { active = false }
  }, [open, tab, job._id, candidateReload])

  function editStage(index) {
    setEditingIndex(index)
    setStageForm(toDraft(draft[index]))
  }
  function addStage() {
    setEditingIndex(draft.length)
    setStageForm(emptyStage())
  }
  function saveStage(event) {
    event.preventDefault()
    const next = [...draft]
    const { scheduledAtLocal, ...stage } = stageForm
    next[editingIndex] = { ...stage, scheduledAt: scheduledAtLocal ? new Date(`${scheduledAtLocal}:00+05:30`).toISOString() : '', ...(next[editingIndex]?.id ? { id: next[editingIndex].id } : {}) }
    setDraft(next)
    setEditingIndex(null)
    showToast('Stage draft saved. Save the recruitment process to apply its schedule and notify eligible candidates.')
  }
  function moveStage(index, offset) {
    setDraft((items) => {
      const next = [...items]
      const target = index + offset
      if (target < 0 || target >= next.length) return items
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }
  function duplicateStage(index) {
    const copy = { ...draft[index], id: undefined, title: `${draft[index].title} copy`, evaluationCriteria: [...(draft[index].evaluationCriteria || [])] }
    setDraft((items) => [...items.slice(0, index + 1), copy, ...items.slice(index + 1)])
  }
  function deleteStage(index) {
    const stage = draft[index]
    if (!window.confirm(`Delete “${stage.title}” from this pipeline?`)) return
    setDraft((items) => items.filter((_, itemIndex) => itemIndex !== index))
  }
  async function savePipeline() {
    setSaving(true)
    try {
      const result = await jobService.saveRecruitmentPipeline(job._id, draft)
      onSaved(job._id, result.pipeline)
      setDraft((result.pipeline || []).map(toDraft))
      showToast(result.notificationCount ? `Recruitment process saved. Notifications triggered for ${result.notificationCount} eligible candidate${result.notificationCount === 1 ? '' : 's'}.` : 'Recruitment process saved. No candidates are currently eligible for the schedule.')
    } catch (error) { showToast(error.message || 'Unable to save this recruitment process.', 'error') }
    finally { setSaving(false) }
  }

  return <section className="recruitment-panel">
    <div className="recruitment-panel-heading">
      <div><p className="eyebrow">HIRING PROCESS</p><h3>Recruitment Process</h3><p>Define the hiring stages candidates will go through for this role.</p></div>
      <button type="button" className="secondary-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? 'Close process' : `Configure · ${draft.length} stages`}</button>
    </div>
    {open && <>
      <div className="recruitment-tabs" role="tablist" aria-label={`${job.title} recruitment process`}>
        <button type="button" role="tab" aria-selected={tab === 'pipeline'} className={tab === 'pipeline' ? 'is-active' : ''} onClick={() => setTab('pipeline')}>Pipeline</button>
        <button type="button" role="tab" aria-selected={tab === 'candidates'} className={tab === 'candidates' ? 'is-active' : ''} onClick={() => { setCandidatesBusy(true); setTab('candidates') }}>Candidates <span>{job.applicationCount || 0}</span></button>
      </div>
      {tab === 'pipeline' ? <div className="pipeline-config-view">
        <div className="pipeline-view-heading"><div><h4>Recruitment Pipeline</h4><p>Set the round schedule here. After editing a stage, select “Save recruitment process” below to save it and notify candidates shortlisted for that stage.</p></div><span className="pipeline-stage-count">{draft.length} {draft.length === 1 ? 'stage' : 'stages'}</span></div>
        {draft.length ? <div className="pipeline-stage-list">{draft.map((round, index) => <article className="pipeline-stage-card" key={round.id || `new-${index}`}>
          <span className="pipeline-stage-number">{String(index + 1).padStart(2, '0')}</span>
          <div className="pipeline-stage-content"><div className="pipeline-stage-title-row"><div><h5>{round.title || 'Untitled stage'}</h5><p>{types.find(([value]) => value === round.type)?.[1] || 'Custom'} <span>·</span> {round.mode === 'IN_PERSON' ? 'In person' : 'Online'}</p></div>
            <details className="pipeline-stage-menu"><summary aria-label={`Actions for ${round.title}`}>⋮</summary><div className="pipeline-stage-menu-items"><button type="button" disabled={index === 0} onClick={() => moveStage(index, -1)}>Move up</button><button type="button" disabled={index === draft.length - 1} onClick={() => moveStage(index, 1)}>Move down</button><button type="button" onClick={() => editStage(index)}>Edit stage</button><button type="button" onClick={() => duplicateStage(index)}>Duplicate</button><button type="button" className="is-danger" onClick={() => deleteStage(index)}>Delete</button></div></details>
          </div></div>
          <div className="pipeline-stage-meta"><span>{round.duration || 45} min</span>{round.platform && <span>{round.platform}</span>}</div>
          {round.instructions && <div className="pipeline-stage-preview"><strong>Candidate instructions</strong><p>{round.instructions}</p></div>}
          <div className="pipeline-schedule-note"><span>Schedule</span><strong>{round.scheduledAt ? dateTime(round.scheduledAt) : 'Not scheduled'}</strong></div>
          <button className="pipeline-edit-button" type="button" onClick={() => editStage(index)}>Edit stage</button>
        </article>)}</div> : <div className="pipeline-empty"><p>No stages configured yet.</p><span>Add stages to define this role’s hiring process.</span></div>}
        <div className="pipeline-panel-actions"><button type="button" className="secondary-button" onClick={addStage}>+ Add stage</button><button type="button" className="primary-button" disabled={saving} onClick={savePipeline}>{saving ? 'Saving…' : 'Save process & notify candidates'}</button></div>
      </div> : <div className="pipeline-candidates-view">
        <div className="pipeline-view-heading"><div><h4>Stage candidate management</h4><p>Each round has its own candidate pool. A candidate becomes eligible for the next round only after an explicit shortlist decision.</p></div></div>
        {candidatesError ? <ErrorState message="Candidates could not be loaded." onRetry={() => { setCandidatesBusy(true); setCandidateReload((value) => value + 1) }} /> : candidatesBusy ? <LoadingState label="Loading candidates" /> : !stageManagement.length ? <EmptyState title="No stages configured" message="Add recruitment stages to manage candidate pools." /> : <>
          <div className="pipeline-stage-list" role="tablist" aria-label="Recruitment stages">{stageManagement.map((stage) => <button type="button" role="tab" aria-selected={stageFilter === String(stage.roundId)} className={`pipeline-stage-card ${stageFilter === String(stage.roundId) ? 'is-active' : ''}`} key={stage.roundId} onClick={() => { setStageFilter(String(stage.roundId)); setStageBucket('eligible') }}><span className="pipeline-stage-number">{String(stage.order + 1).padStart(2, '0')}</span><div className="pipeline-stage-content"><h5>{stage.title}</h5><p>{stage.counts.eligible} Eligible <span>·</span> {stage.counts.shortlisted} Shortlisted</p></div></button>)}</div>
          {(() => { const active = stageManagement.find((stage) => String(stage.roundId) === stageFilter) || stageManagement[0]; const buckets = [['eligible','Eligible'],['scheduled','Scheduled'],['completed','Completed'],['shortlisted','Shortlisted'],['notShortlisted','Not Shortlisted']]; const rows = active.candidates[stageBucket] || []; return <><div className="recruitment-tabs" role="tablist" aria-label={`${active.title} candidates`}>{buckets.map(([key,label]) => <button type="button" role="tab" aria-selected={stageBucket === key} className={stageBucket === key ? 'is-active' : ''} key={key} onClick={() => setStageBucket(key)}>{label} <span>{active.counts[key] || 0}</span></button>)}</div>{!rows.length ? <EmptyState title={`No ${stageBucket === 'notShortlisted' ? 'not shortlisted' : stageBucket} candidates`} message={`Candidates in ${active.title} will appear here as the recruitment process progresses.`} /> : <div className="pipeline-candidate-table-wrap"><table className="pipeline-candidate-table"><thead><tr><th>Candidate</th><th>Stage status</th><th>Result</th><th>Schedule</th><th>Action</th></tr></thead><tbody>{rows.map((candidate) => <tr key={candidate._id}><td><strong>{candidate.profileSnapshot?.fullName || candidate.applicant?.name || 'Candidate'}</strong><span>{candidate.applicant?.email || job.title}</span></td><td><span className="pipeline-status-pill">{candidate.stage.eligibility === 'NOT_SHORTLISTED' ? 'Not Shortlisted' : candidate.stage.status?.replaceAll('_', ' ') || 'Eligible'}</span></td><td>{candidate.stage.result?.replaceAll('_', ' ') || 'Pending'}</td><td>{candidate.stage.scheduledAt ? dateTime(candidate.stage.scheduledAt) : 'Not scheduled'}</td><td><a className="row-action" href={`/applications/${candidate._id}`}>{candidate.stage.result === 'PASSED' && stageBucket === 'completed' ? 'Review candidate' : 'View'}</a></td></tr>)}</tbody></table></div>}</> })()}
        </>}
      </div>}
    </>}
    {editingIndex !== null && <div className="stage-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingIndex(null) }}><section className="stage-editor-modal" role="dialog" aria-modal="true" aria-labelledby="stage-editor-title"><header><div><p className="eyebrow">STAGE SETTINGS</p><h3 id="stage-editor-title">{draft[editingIndex] ? 'Edit stage' : 'Add stage'}</h3></div><button type="button" className="stage-modal-close" aria-label="Close" onClick={() => setEditingIndex(null)}>×</button></header>
      <form onSubmit={saveStage} className="stage-editor-form"><div className="stage-editor-grid"><label>Round type<select value={stageForm.type} onChange={(event) => { const type = event.target.value; setStageForm((value) => ({ ...value, type, title: type === 'CUSTOM' ? value.title : types.find(([key]) => key === type)?.[1] || value.title })) }}>{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Round name<input value={stageForm.title} onChange={(event) => setStageForm((value) => ({ ...value, title: event.target.value }))} maxLength="100" required /></label><label className="stage-editor-wide">Stage description<textarea rows="3" placeholder="What does this stage evaluate?" value={stageForm.description} onChange={(event) => setStageForm((value) => ({ ...value, description: event.target.value }))} /></label><label>Date and time (IST)<input type="datetime-local" min={new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(' ', 'T')} value={stageForm.scheduledAtLocal || ''} onChange={(event) => setStageForm((value) => ({ ...value, scheduledAtLocal: event.target.value }))} /><small>Set a date and time to notify eligible candidates when you save the process.</small></label><label>Duration (minutes)<input type="number" min="5" max="480" value={stageForm.duration} onChange={(event) => setStageForm((value) => ({ ...value, duration: Number(event.target.value) }))} required /></label><label>Mode<select value={stageForm.mode} onChange={(event) => setStageForm((value) => ({ ...value, mode: event.target.value }))}><option value="ONLINE">Online</option><option value="IN_PERSON">In person</option></select></label><label>Platform<select value={stageForm.platform} onChange={(event) => setStageForm((value) => ({ ...value, platform: event.target.value }))}><option value="">Select a platform</option>{stageForm.platform && !platforms.includes(stageForm.platform) && <option value={stageForm.platform}>{stageForm.platform}</option>}{platforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}</select></label><label>Platform / assessment link<input type="url" placeholder="https://" value={stageForm.link} onChange={(event) => setStageForm((value) => ({ ...value, link: event.target.value }))} /></label><label>In-person location<input value={stageForm.location || ''} onChange={(event) => setStageForm((value) => ({ ...value, location: event.target.value }))} /></label><label className="stage-editor-wide">Candidate instructions<textarea rows="3" placeholder="Instructions visible to candidates" value={stageForm.instructions} onChange={(event) => setStageForm((value) => ({ ...value, instructions: event.target.value }))} /></label>
        {stageForm.type.includes('INTERVIEW') || stageForm.type === 'SYSTEM_DESIGN' || stageForm.type === 'MANAGERIAL_INTERVIEW' ? <><label className="stage-editor-wide">Interviewers<input value={stageForm.interviewerLabels} onChange={(event) => setStageForm((value) => ({ ...value, interviewerLabels: event.target.value }))} placeholder="Names, separated by commas" /></label><label className="stage-editor-wide">Private interviewer instructions<textarea rows="3" value={stageForm.interviewerInstructions} onChange={(event) => setStageForm((value) => ({ ...value, interviewerInstructions: event.target.value }))} placeholder="Visible to the recruiting team only" /></label></> : null}
        <fieldset className="stage-editor-wide evaluation-config"><legend>Evaluation criteria</legend>{(stageForm.evaluationCriteria || []).map((criterion, index) => <div key={index}><input aria-label={`Criterion ${index + 1}`} placeholder="Criterion name" value={criterion.name || ''} onChange={(event) => setStageForm((value) => ({ ...value, evaluationCriteria: value.evaluationCriteria.map((entry, i) => i === index ? { ...entry, name: event.target.value } : entry) }))} /><input aria-label={`Criterion ${index + 1} description`} placeholder="What good looks like (optional)" value={criterion.description || ''} onChange={(event) => setStageForm((value) => ({ ...value, evaluationCriteria: value.evaluationCriteria.map((entry, i) => i === index ? { ...entry, description: event.target.value } : entry) }))} /><button type="button" onClick={() => setStageForm((value) => ({ ...value, evaluationCriteria: value.evaluationCriteria.filter((_, i) => i !== index) }))}>Remove</button></div>)}<button type="button" className="text-link" onClick={() => setStageForm((value) => ({ ...value, evaluationCriteria: [...(value.evaluationCriteria || []), { name: '', description: '' }] }))}>+ Add criterion</button></fieldset></div>
        <footer><button type="button" className="secondary-button" onClick={() => setEditingIndex(null)}>Cancel</button><button type="submit" className="primary-button">Save stage draft</button></footer></form>
      </section></div>}
  </section>
}
