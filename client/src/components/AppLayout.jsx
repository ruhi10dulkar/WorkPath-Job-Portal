import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import NotificationBell from './NotificationBell'
import { profileService } from '../services/profileService'

export default function AppLayout({ children }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  useEffect(() => {
    if (user?.role !== 'applicant') return undefined
    let active = true
    const loadPhoto = () => profileService.getMine().then((result) => { if (active) setPhotoUrl(profileService.photoUrl(result.profile?.profilePhoto?.url)) }).catch(() => {})
    loadPhoto()
    const refreshPhoto = (event) => setPhotoUrl(profileService.photoUrl(event.detail || ''))
    window.addEventListener('workpath-profile-photo-updated', refreshPhoto)
    return () => { active = false; window.removeEventListener('workpath-profile-photo-updated', refreshPhoto) }
  }, [user?.id, user?.role])
  async function handleLogout() {
    await logout()
    window.location.assign('/')
  }

  const homeAnchor = (id) => window.location.pathname === '/' ? `#${id}` : `/#${id}`
  const links = !user
    ? [{ href: '/jobs', label: 'Find jobs' }, { href: homeAnchor('featured-jobs'), label: 'Featured roles' }, { href: homeAnchor('career-resources'), label: 'Career resources' }, { href: '/register?role=recruiter', label: 'For employers' }]
    : user.role === 'recruiter'
      ? [{ href: '/dashboard/recruiter', label: 'Overview' }, { href: '/recruiter/jobs', label: 'Jobs' }, { href: '/recruiter/applications', label: 'Applicants' }]
      : [{ href: '/jobs', label: 'Find jobs' }, { href: '/applications', label: 'Applications' }]
  const activeLink = (href) => href === '/jobs' ? window.location.pathname.startsWith('/jobs') : href.startsWith('#') ? window.location.hash === href : window.location.pathname === href

  return <main className="dashboard-shell">
    <header className="site-header">
      <a className="wordmark" href={user ? '/dashboard' : '/'} aria-label="Workpath home">workpath<span>.</span></a>
      <button className="mobile-nav-toggle" type="button" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen((open) => !open)}>
        <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{menuOpen ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
      </button>
      <nav id="primary-navigation" className={`primary-navigation${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
        {links.map((link) => <a className={`nav-link${activeLink(link.href) ? ' is-active' : ''}`} aria-current={activeLink(link.href) ? 'page' : undefined} key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</a>)}
        {user && <><NotificationBell /><div className="account-menu"><a className="account-link" href="/profile"><span className="avatar-mark" aria-hidden="true">{photoUrl ? <img src={photoUrl} alt="" /> : user.name?.trim()?.[0]?.toUpperCase() || 'U'}</span><span className="account-name">{user.name}</span></a><button className="text-button signout-button" type="button" onClick={handleLogout}>Sign out</button></div></>}
        {!user && <><a className="nav-link sign-in-link" href="/login">Sign in</a><a className="nav-cta" href="/register">Get started</a></>}
      </nav>
    </header>
    <div className="page-content">{children}</div>
    <footer className="site-footer">
      <div className="footer-brand"><a className="wordmark" href="/">workpath<span>.</span></a><p>Helping people find work that moves them forward.</p></div>
      <div className="footer-column"><strong>Explore</strong><a href="/jobs">Find jobs</a><a href="/#featured-jobs">Featured opportunities</a></div>
      <div className="footer-column"><strong>For candidates</strong><a href={user?.role === 'applicant' ? '/applications' : '/register'}>Applications</a><a href="/register">Create an account</a></div>
      <div className="footer-column"><strong>For employers</strong><a href="/register?role=recruiter">Post a role</a><a href={user?.role === 'recruiter' ? '/recruiter/applications' : '/register?role=recruiter'}>Manage applicants</a></div>
      <span className="footer-copyright">© {new Date().getFullYear()} Workpath</span>
    </footer>
  </main>
}
