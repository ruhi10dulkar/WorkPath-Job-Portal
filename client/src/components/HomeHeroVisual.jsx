export default function HomeHeroVisual() {
  return <div className="career-visual" aria-hidden="true">
    <div className="visual-orbit visual-orbit-one" />
    <div className="visual-orbit visual-orbit-two" />
    <div className="visual-core"><span className="visual-core-line" /><span className="visual-core-dot" /><span className="visual-core-label">WORKPATH</span></div>
    <div className="visual-card visual-card-top"><span className="visual-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5h6v2M4 12h16M10 12v2h4v-2"/></svg></span><span><b>Find opportunities</b><small>Search by role and skills</small></span></div>
    <div className="visual-card visual-card-side"><span className="visual-marker">01</span><span><b>Your experience</b><small>Find a role that fits</small></span></div>
    <div className="visual-card visual-card-bottom"><span className="visual-location"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/></svg></span><span><b>Choose your location</b><small>Explore what's nearby</small></span></div>
    <span className="visual-spark visual-spark-one" /><span className="visual-spark visual-spark-two" />
  </div>
}
