export function Loading({ children = 'Loading' }) {
  return <p className="muted" role="status">{children}…</p>
}

export function ErrorBox({ children, onRetry }) {
  return (
    <div className="notice notice-error" role="alert">
      <p>{children}</p>
      {onRetry && <button className="btn btn-quiet" onClick={onRetry}>Try again</button>}
    </div>
  )
}
