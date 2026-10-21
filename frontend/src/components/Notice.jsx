export function Loading({ children = 'Loading' }) {
  return (
    <div className="skeleton-wrap" role="status" aria-label={children}>
      <span className="skeleton" style={{ width: '60%' }} />
      <span className="skeleton" style={{ width: '90%' }} />
      <span className="skeleton" style={{ width: '75%' }} />
      <span className="sr-only">{children}</span>
    </div>
  )
}

export function ErrorBox({ children, onRetry }) {
  return (
    <div className="notice notice-error" role="alert">
      <p>{children}</p>
      {onRetry && <button className="btn btn-quiet" onClick={onRetry}>Try again</button>}
    </div>
  )
}
