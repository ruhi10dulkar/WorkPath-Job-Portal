import { useEffect, useState } from 'react'
import { jobService } from '../services/jobService'
import JobCard from '../components/JobCard'
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates'

const emptyFilters = { search: '', location: '', employmentType: '', experienceLevel: '' }
function readFilters() {
  const query = new URLSearchParams(window.location.search)
  return { search: query.get('search') || '', location: query.get('location') || '', employmentType: query.get('employmentType') || '', experienceLevel: query.get('experienceLevel') || '' }
}
function filterLabel(key, value) {
  if (key === 'employmentType') return value.replaceAll('-', ' ')
  if (key === 'experienceLevel') return `${value} experience`
  return value
}

export default function Jobs() {
  const initialFilters = readFilters()
  const [filters, setFilters] = useState(initialFilters)
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)

  async function loadJobs(values = filters) {
    setLoading(true)
    setError(false)
    try { setJobs(await jobService.getJobs(values)) } catch { setError(true) } finally { setLoading(false) }
  }

  useEffect(() => {
    let active = true
    jobService.getJobs(initialFilters).then((items) => { if (active) setJobs(items) }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  // Initial query parameters seed the first request; subsequent searches are submitted explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(field, value) { setFilters((current) => ({ ...current, [field]: value })) }
  function syncUrl(values) {
    const query = new URLSearchParams(Object.entries(values).filter(([, value]) => value))
    window.history.replaceState({}, '', `/jobs${query.size ? `?${query}` : ''}`)
  }
  function applyFilters(event) {
    event?.preventDefault()
    syncUrl(filters)
    setFiltersOpen(false)
    loadJobs(filters)
  }
  function clearFilters() {
    setFilters(emptyFilters)
    syncUrl(emptyFilters)
    loadJobs(emptyFilters)
  }
  function removeFilter(field) {
    const next = { ...filters, [field]: '' }
    setFilters(next)
    syncUrl(next)
    loadJobs(next)
  }
  const selectedFilters = Object.entries(filters).filter(([, value]) => value)
  const summary = [filters.search && `“${filters.search}”`, filters.location && `in ${filters.location}`].filter(Boolean).join(' ')

  return <section className="browse-section">
    <div className="page-heading"><div><p className="eyebrow">OPPORTUNITIES</p><h1>Find your next opportunity</h1><p className="muted">Explore roles from recruiters looking for their next teammate.</p></div></div>
    <form className="search-toolbar" onSubmit={applyFilters}>
      <label><span>Job title, skills or company</span><input value={filters.search} onChange={(event) => update('search', event.target.value)} placeholder="e.g. Frontend developer" /></label>
      <label><span>Location</span><input value={filters.location} onChange={(event) => update('location', event.target.value)} placeholder="City or region" /></label>
      <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search jobs'}</button>
    </form>
    <div className="discovery-layout">
      <button className="filter-toggle" type="button" aria-expanded={filtersOpen} aria-controls="job-filters" onClick={() => setFiltersOpen((open) => !open)}>{filtersOpen ? 'Close filters' : 'Filters'} <span aria-hidden="true">{filtersOpen ? '×' : '+'}</span></button>
      <aside id="job-filters" className={`filter-panel${filtersOpen ? ' filters-open' : ''}`} aria-label="Job filters">
        <div className="filter-panel-heading"><h2>Refine results</h2><button className="text-button" type="button" onClick={clearFilters}>Clear all</button></div>
        <label className="filter-control">Employment type<select value={filters.employmentType} onChange={(event) => update('employmentType', event.target.value)}><option value="">Any type</option><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="internship">Internship</option><option value="contract">Contract</option></select></label>
        <label className="filter-control">Experience level<select value={filters.experienceLevel} onChange={(event) => update('experienceLevel', event.target.value)}><option value="">Any experience</option><option value="Fresher">Fresher</option><option value="0-2">0-2 years</option><option value="2-5">2-5 years</option><option value="5+">5+ years</option></select></label>
        <p className="filter-hint">Results match the experience text provided by each recruiter.</p>
        <button className="secondary-button apply-filters" type="button" onClick={() => applyFilters()}>Apply filters</button>
      </aside>
      <div className="job-results">
        <div className="results-heading"><div><h2>Open roles</h2><span>{loading ? 'Updating results…' : error ? 'Results unavailable' : `${jobs.length} ${jobs.length === 1 ? 'opportunity' : 'opportunities'}${summary ? ` for ${summary}` : ''}`}</span></div><span className="sort-note">Newest first</span></div>
        {selectedFilters.length > 0 && <div className="active-filters" aria-label="Selected filters">{selectedFilters.map(([key, value]) => <button className="filter-chip" type="button" key={key} onClick={() => removeFilter(key)} aria-label={`Remove ${filterLabel(key, value)} filter`}>{filterLabel(key, value)} <span aria-hidden="true">×</span></button>)}<button className="clear-filter-link" type="button" onClick={clearFilters}>Clear all</button></div>}
        {error ? <ErrorState message="We couldn't load jobs right now." onRetry={() => loadJobs()} /> : loading ? <LoadingState label="Loading jobs" /> : jobs.length === 0 ? <div className="empty-search"><EmptyState title="No opportunities found" message="Try removing a filter or searching for a different role." /><button className="secondary-button" type="button" onClick={clearFilters}>Clear filters</button></div> : <div className="job-list">{jobs.map((job) => <JobCard job={job} key={job._id} />)}</div>}
      </div>
      {filtersOpen && <button className="filter-backdrop" type="button" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />}
    </div>
  </section>
}
