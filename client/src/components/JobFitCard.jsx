import { useEffect, useRef, useState } from 'react'

const metrics = [
  { key: 'skills', label: 'Skills', icon: <><path d="M4 7h10M4 12h6M4 17h8" /><path d="m16 15 2 2 4-5" /></> },
  { key: 'experience', label: 'Experience', icon: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></> },
  { key: 'education', label: 'Education', icon: <><path d="m3 9 9-5 9 5-9 5-9-5Z" /><path d="M7 12v5c3 2 7 2 10 0v-5M21 9v6" /></> },
  { key: 'location', label: 'Location', icon: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></> },
]

function quality(score) {
  if (score >= 90) return 'Excellent Match'
  if (score >= 75) return 'Strong Match'
  if (score >= 60) return 'Good Match'
  if (score >= 40) return 'Moderate Match'
  return 'Low Match'
}

function metricNote(key, match) {
  if (key === 'skills') {
    const total = (match.skills?.matched?.length || 0) + (match.skills?.missing?.length || 0)
    return total ? `${match.skills.matched.length} of ${total} required matched` : 'No required skills listed'
  }
  if (key === 'experience') return match.experience?.matchType === 'NOT_REQUIRED' ? 'No experience requirement' : match.experience?.matchType === 'EXCEEDS' ? 'Experience exceeds the range' : match.experience?.matchType === 'MEETS' ? 'Meets the experience range' : 'Based on listed experience'
  if (key === 'education') return match.education?.required?.length ? `${match.education.matched?.length || 0} of ${match.education.required.length} requirements matched` : 'No education requirement'
  return match.location?.required ? match.location.matched ? 'Location is a match' : 'Location may differ' : 'Location is flexible'
}

export default function JobFitCard({ match, title = 'Job Fit' }) {
  const [showMethod, setShowMethod] = useState(false)
  const closeButton = useRef(null)
  useEffect(() => {
    if (!showMethod) return undefined
    const previousFocus = document.activeElement
    closeButton.current?.focus()
    const handleKeyDown = (event) => { if (event.key === 'Escape') setShowMethod(false) }
    document.addEventListener('keydown', handleKeyDown)
    return () => { document.removeEventListener('keydown', handleKeyDown); previousFocus?.focus?.() }
  }, [showMethod])
  if (!match) return null
  const score = Math.max(0, Math.min(100, Number(match.score) || 0))
  const skills = match.skills || { matched: [], missing: [], preferredMatched: [] }
  return <section className="job-fit-card" aria-label={title}>
    <header className="job-fit-topline"><div><p className="eyebrow">PROFILE MATCH</p><h2>{title}</h2></div><span className="job-fit-version">WorkPath Match</span></header>
    <div className="job-fit-overview">
      <div className="job-fit-ring" style={{ '--fit-score': `${score}%` }} role="img" aria-label={`${score}% ${quality(score)}`}>
        <div className="job-fit-ring-inner"><strong>{score}<small>%</small></strong><span>{quality(score)}</span></div>
      </div>
      <div className="job-fit-summary"><span className="job-fit-kicker">CANDIDATE JOB FIT</span><h3>{quality(score)}</h3><p>Your match is calculated from the information in your profile and the requirements of this job.</p><button className="job-fit-method-link" type="button" aria-expanded={showMethod} onClick={() => setShowMethod(true)}>How is this calculated? <span aria-hidden="true">↗</span></button></div>
    </div>
    <div className="job-fit-metrics" aria-label="Match breakdown">{metrics.map(({ key, label, icon }) => {
      const value = Math.max(0, Math.min(100, Number(match.components?.[key]) || 0))
      return <article className="job-fit-metric" key={key}>
        <div className="job-fit-metric-head"><span className="job-fit-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icon}</svg></span><span>{label}</span></div>
        <strong className="job-fit-metric-score">{value}<small>%</small></strong>
        <div className="job-fit-meter" role="progressbar" aria-label={`${label} match`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={value}><i style={{ width: `${value}%` }} /></div>
        <p>{metricNote(key, match)}</p>
      </article>
    })}</div>
    <div className="job-fit-skills">
      <section className="job-fit-skill-group matched"><div className="job-fit-section-heading"><span className="job-fit-section-mark" aria-hidden="true">✓</span><div><h3>Matched Skills</h3><p>Strengths that align with this role</p></div></div>
        {skills.matched?.length || skills.preferredMatched?.length ? <div className="fit-chips">{[...skills.matched, ...skills.preferredMatched].map((skill, index) => <span key={`${skill}-${index}`}>{skill}</span>)}</div> : <p className="job-fit-empty">No matching skills found yet.</p>}
      </section>
      <section className="job-fit-skill-group build"><div className="job-fit-section-heading"><span className="job-fit-section-mark" aria-hidden="true">+</span><div><h3>Skills to Build</h3><p>Potential areas to strengthen</p></div></div>
        {skills.missing?.length ? <><div className="fit-chips">{skills.missing.map((skill) => <span key={skill}>{skill}</span>)}</div><p className="job-fit-help">Adding these skills could improve your match for this role.</p></> : <p className="job-fit-empty">No required skills to build for this role.</p>}
      </section>
    </div>
    {match.explanation?.length > 0 && <p className="job-fit-explanation">{match.explanation.join(' ')}</p>}
    {showMethod && <div className="job-fit-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowMethod(false) }}><section className="job-fit-modal" role="dialog" aria-modal="true" aria-labelledby="job-fit-modal-title"><button ref={closeButton} type="button" className="job-fit-modal-close" aria-label="Close explanation" onClick={() => setShowMethod(false)}>×</button><p className="eyebrow">MATCH BREAKDOWN</p><h3 id="job-fit-modal-title">How your match is calculated</h3><p>WorkPath compares the information in your profile with the requirements listed for this job.</p><ul>{metrics.map(({ key, label }) => <li key={key}><strong>{label} · {match.components?.[key] ?? 0}%</strong><span>{metricNote(key, match)}</span></li>)}</ul><p className="job-fit-modal-note">This score is informational and does not make a hiring decision.</p></section></div>}
  </section>
}
