export default function ProfileSection({ id, eyebrow, title, description, count, children, className = '' }) {
  return <section id={id} className={`candidate-section ${className}`} aria-labelledby={`${id}-title`}>
    <div className="candidate-section-heading"><div><p className="eyebrow">{eyebrow}</p><h2 id={`${id}-title`}>{title}</h2>{description && <p className="muted">{description}</p>}</div>{count !== undefined && <span className="section-count">{count}</span>}</div>
    {children}
  </section>
}
