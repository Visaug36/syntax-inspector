export default function ErrorCard({ index, diagnostic, code }) {
  const lines      = code.split('\n')
  const lineText   = lines[(diagnostic.line ?? 1) - 1] ?? ''
  const col        = diagnostic.column ?? 0
  const before     = lineText.slice(0, col)
  const token      = lineText.slice(col, col + 1) || ' '
  const after      = lineText.slice(col + 1)
  const num        = String(index + 1).padStart(2, '0')

  return (
    <article className="error-card">
      <span className="error-num" aria-hidden="true">{num}</span>
      <div className="error-body">
        <div className="error-meta">
          <span className="error-loc">Line {diagnostic.line}, Col {col + 1}</span>
          <span className="error-type-badge">{diagnostic.type}</span>
        </div>
        <p className="error-message">{diagnostic.message}</p>
        {lineText.trim() && (
          <pre className="error-snippet" aria-label="Offending line">
            <span>{before}</span>
            <mark className="error-token">{token}</mark>
            <span>{after}</span>
          </pre>
        )}
      </div>
    </article>
  )
}
