function postedLabel(date) {
  if (!date) return ''
  const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000))
  if (days === 0) return 'Posted today'
  if (days === 1) return 'Posted yesterday'
  return `Posted ${days} days ago`
}

export default function JobCard({ job, variant = 'list', matchPercentage }) {
  const featured = variant === 'featured'
  const validMatch = Number.isFinite(matchPercentage) && matchPercentage >= 0 && matchPercentage <= 100
  return <article className={`job-card ${featured ? 'featured-job' : 'search-job-card'}`}>
    <div className="company-mark" aria-hidden="true">{job.company?.trim()?.[0]?.toUpperCase() || 'C'}</div>
    <div className="search-job-content">
      <p className="job-company">{job.company}</p>
      <h3><a href={`/jobs/${job._id}`}>{job.title}</a></h3>
      {validMatch && <span className="match-badge">{Math.round(matchPercentage)}% match</span>}
      <p className="job-meta">{job.location} <span aria-hidden="true">·</span> {job.employmentType?.replace('-', ' ')}</p>
      <div className="job-tags"><span>{job.experienceLevel}</span>{job.salary && <span>{job.salary}</span>}{job.skills?.slice(0, featured ? 3 : 4).map((skill) => <span key={skill}>{skill}</span>)}</div>
      {job.createdAt && <p className="job-posted">{postedLabel(job.createdAt)}</p>}
    </div>
    <a className={featured ? 'job-card-link' : 'secondary-button detail-link'} href={`/jobs/${job._id}`}>{featured ? <>View role <span aria-hidden="true">→</span></> : <>View job <span aria-hidden="true">→</span></>}</a>
  </article>
}
