import { useEffect, useState } from 'react'
import { useAuth } from './context/useAuth'
import AuthPage from './pages/AuthPage'
import ProtectedRoute from './routes/ProtectedRoute'
import RecruiterJobs from './pages/RecruiterJobs'
import Jobs from './pages/Jobs'
import JobDetails from './pages/JobDetails'
import MyApplications from './pages/MyApplications'
import RecruiterApplications from './pages/RecruiterApplications'
import ApplicantDashboard from './pages/ApplicantDashboard'
import RecruiterDashboard from './pages/RecruiterDashboard'
import RoleRoute from './routes/RoleRoute'
import VerifyEmail from './pages/VerifyEmail'
import Profile from './pages/Profile'
import ApplicationDetails from './pages/ApplicationDetails'
import AppLayout from './components/AppLayout'
import JobCard from './components/JobCard'
import HomeHeroVisual from './components/HomeHeroVisual'
import { LoadingState, EmptyState, ErrorState } from './components/PageStates'
import { jobService } from './services/jobService'
import './App.css'

function SearchFieldIcon({ kind }) {
  return <svg className="search-field-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'search' ? <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4 4" /></> : kind === 'location' ? <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.3" /></> : <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V5h6v2M8 12h8M8 15h5" /></>}
  </svg>
}

function HomePage() {
  const [jobs, setJobs] = useState([])
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('')
  const [experienceLevel, setExperienceLevel] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    jobService.getJobs({}).then((items) => { if (active) { setJobs(items); setLoadError(false) } }).catch(() => { if (active) setLoadError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])
  const popularSearches = ['Software Engineer', 'Frontend Developer', 'Data Scientist', 'Java Developer', 'Product Manager']
  const categories = ['Software Engineering', 'Data & Analytics', 'AI / ML', 'Design', 'Product', 'Marketing', 'Finance', 'Internships']
  function submitSearch(event, term = search) {
    event?.preventDefault()
    const query = new URLSearchParams()
    if (term.trim()) query.set('search', term.trim())
    if (location.trim()) query.set('location', location.trim())
    if (experienceLevel) query.set('experienceLevel', experienceLevel)
    window.location.assign(`/jobs${query.size ? `?${query}` : ''}`)
  }

  return <AppLayout>
    <section className="home-hero">
      <div className="hero-copy-column">
        <p className="eyebrow">BUILD YOUR NEXT CAREER</p>
        <h1>Find work that fits your future.</h1>
        <p className="hero-copy">Discover opportunities that match your skills, experience, and career goals.</p>
        <form className="hero-search" onSubmit={submitSearch}>
          <label><span className="search-field-label"><SearchFieldIcon kind="search" />Job title or skills</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Software Engineer, React, Python" /></label>
          <label><span className="search-field-label"><SearchFieldIcon kind="location" />Location</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Pune, Mumbai, Bengaluru" /></label>
          <label><span className="search-field-label"><SearchFieldIcon kind="experience" />Experience</span><select value={experienceLevel} onChange={(event) => setExperienceLevel(event.target.value)}><option value="">Any experience</option><option value="Fresher">Fresher</option><option value="0-2">0-2 years</option><option value="2-5">2-5 years</option><option value="5+">5+ years</option></select></label>
          <button className="primary-button" type="submit">Search jobs <span aria-hidden="true">→</span></button>
        </form>
        <div className="quick-search"><span>Popular searches</span><div className="skill-links">{popularSearches.map((term) => <button key={term} type="button" onClick={() => { setSearch(term); submitSearch(null, term) }}>{term}</button>)}</div></div>
        <p className="hero-note">Thoughtful opportunities. Clear next steps.</p>
      </div>
      <HomeHeroVisual />
    </section>
    <section className="home-section" id="featured-jobs"><div className="section-heading"><div><p className="eyebrow">OPEN OPPORTUNITIES</p><h2>Featured opportunities</h2><p className="section-subtitle">Explore roles posted by recruiters on Workpath.</p></div><a className="text-link" href="/jobs">View all jobs <span aria-hidden="true">→</span></a></div>
      {loading ? <LoadingState label="Loading featured jobs" /> : loadError ? <ErrorState message="Featured jobs could not be loaded." onRetry={() => { setLoading(true); setReload((value) => value + 1) }} /> : jobs.length ? <div className="featured-grid">{jobs.slice(0, 3).map((job) => <JobCard job={job} variant="featured" key={job._id} />)}</div> : <EmptyState title="No open roles yet" message="Browse the job board to see current openings." action="Explore jobs" href="/jobs" />}
    </section>
    <section className="home-section category-section"><div className="section-heading"><div><p className="eyebrow">START EXPLORING</p><h2>Career categories</h2></div></div><div className="category-grid">{categories.map((category) => <a key={category} href={category === 'Internships' ? '/jobs?employmentType=internship' : `/jobs?search=${encodeURIComponent(category)}`}><span>{category}</span><span aria-hidden="true">→</span></a>)}</div></section>
    <section className="home-section how-section" id="career-resources"><div><p className="eyebrow">WHY WORKPATH</p><h2>Everything you need to move forward.</h2><p className="section-subtitle">A clearer way to discover roles and follow your applications.</p></div><div className="how-grid"><article><span aria-hidden="true">01</span><h3>Job discovery</h3><p>Explore openings by title, skills, location, experience, and employment type.</p></article><article><span aria-hidden="true">02</span><h3>Application tracking</h3><p>Review application status updates from your applicant dashboard.</p></article><article><span aria-hidden="true">03</span><h3>Role details</h3><p>Compare the experience, skills, location, and compensation provided by recruiters.</p></article></div></section>
    <section className="home-cta-panel"><div><p className="eyebrow">YOUR NEXT STEP</p><h2>Build your Workpath profile.</h2><p className="muted">Create an account to apply and keep track of your opportunities.</p></div><a className="primary-button" href="/register">Create your account <span aria-hidden="true">→</span></a></section>
  </AppLayout>
}

function DashboardRedirect() {
  const { user, loading, isAuthenticated } = useAuth()
  useEffect(() => {
    if (!loading && !isAuthenticated) window.location.replace('/login')
    else if (!loading && user) window.location.replace(user.role === 'recruiter' ? '/dashboard/recruiter' : '/dashboard/applicant')
  }, [loading, isAuthenticated, user])
  return <main className="auth-shell"><LoadingState label={loading ? 'Checking your session' : 'Redirecting'} /></main>
}

function AppContent() {
  const path = decodeURIComponent(window.location.pathname.replace(/\/$/, '') || '/')
  if (path === '/login') return <AuthPage mode="login" />
  if (path === '/register') return <AuthPage mode="register" />
  if (path === '/verify-email') return <VerifyEmail />
  if (path === '/dashboard') return <DashboardRedirect />
  if (path === '/dashboard/applicant') return <RoleRoute role="applicant"><AppLayout><ApplicantDashboard /></AppLayout></RoleRoute>
  if (path === '/dashboard/recruiter') return <RoleRoute role="recruiter"><AppLayout><RecruiterDashboard /></AppLayout></RoleRoute>
  if (path === '/jobs') return <AppLayout><Jobs /></AppLayout>
  if (path === '/applications') return <RoleRoute role="applicant"><AppLayout><MyApplications /></AppLayout></RoleRoute>
  if (path.startsWith('/applications/')) return <ProtectedRoute><AppLayout><ApplicationDetails applicationId={path.slice('/applications/'.length)} /></AppLayout></ProtectedRoute>
  if (path === '/recruiter/jobs') return <RoleRoute role="recruiter"><AppLayout><RecruiterJobs /></AppLayout></RoleRoute>
  if (path === '/recruiter/applications') return <RoleRoute role="recruiter"><AppLayout><RecruiterApplications /></AppLayout></RoleRoute>
  if (path === '/profile') return <ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>
  if (path.startsWith('/jobs/')) return <AppLayout><JobDetails jobId={path.slice('/jobs/'.length)} /></AppLayout>
  return <HomePage />
}

function App() { return <AppContent /> }

export default App
