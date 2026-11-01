export function LoadingState({ label = 'Loading' }) {
  return <div className="skeleton-list" role="status" aria-label={label}><span className="skeleton skeleton-heading" /><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line short" /><span className="sr-only">{label}…</span></div>
}

export function EmptyState({ title, message, action, href }) {
  return <div className="empty-state"><span className="empty-rule" aria-hidden="true" /><h3>{title}</h3><p>{message}</p>{action && <a className="secondary-button" href={href}>{action}</a>}</div>
}

export function ErrorState({ message = 'We could not load this information.', onRetry }) {
  return <div className="error-state" role="alert"><strong>Something went wrong</strong><p>{message}</p>{onRetry && <button className="secondary-button" type="button" onClick={onRetry}>Try again</button>}</div>
}

export function StatusBadge({ status }) {
  const normalized = ({ applied: 'APPLIED', reviewed: 'UNDER_REVIEW', shortlisted: 'SHORTLISTED', accepted: 'SELECTED', rejected: 'REJECTED' })[status] || status
  const labels = { APPLIED: 'Applied', UNDER_REVIEW: 'Under review', SHORTLISTED: 'Shortlisted', INTERVIEW: 'Interview', SELECTED: 'Selected', REJECTED: 'Rejected' }
  return <span className={`status-badge status-${normalized.toLowerCase()}`}>{labels[normalized] || normalized}</span>
}
