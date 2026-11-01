import { useAuth } from '../context/useAuth'
import CandidateProfileEditor from './CandidateProfileEditor'

export default function Profile() {
  const { user } = useAuth()
  if (user?.role === 'applicant') return <CandidateProfileEditor />
  const roleLabel = user?.role === 'recruiter' ? 'Recruiter account' : 'Applicant account'
  return <section className="profile-page">
    <div className="page-heading"><div><p className="eyebrow">ACCOUNT</p><h1>Profile</h1><p className="muted">Your Workpath account details.</p></div></div>
    <section className="profile-summary" aria-labelledby="profile-name">
      <span className="profile-avatar" aria-hidden="true">{user?.name?.trim()?.[0]?.toUpperCase() || 'U'}</span>
      <div><p className="eyebrow">{roleLabel}</p><h2 id="profile-name">{user?.name}</h2><p className="muted">{user?.email}</p></div>
      <span className={`verification-label${user?.emailVerified ? ' verified' : ''}`}>{user?.emailVerified ? 'Email verified' : 'Email not verified'}</span>
    </section>
    {user?.role === 'applicant' ? <div className="profile-sections">
      <section className="profile-section"><h2>Professional profile</h2><p className="muted">Career details are not part of your account yet. Workpath currently stores your name, email, and account role.</p></section>
      <section className="profile-section"><h2>Skills, education &amp; experience</h2><p className="muted">These details can be added when profile editing becomes available.</p></section>
      <section className="profile-section"><h2>Resume &amp; links</h2><p className="muted">No resume or portfolio links are stored on this account.</p></section>
    </div> : <section className="profile-section recruiter-profile-note"><h2>Recruiter account</h2><p className="muted">Manage your open roles and applicants from your <a href="/dashboard/recruiter">recruiter dashboard</a>.</p></section>}
  </section>
}
