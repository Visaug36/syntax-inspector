import { useState } from 'react'

export default function ErrorCard({ index, diagnostic, code, onJumpTo, onRetry }) {
  const lines      = code.split('\n')
  const lineText   = lines[(diagnostic.line ?? 1) - 1] ?? ''
  const col        = diagnostic.column ?? 0
  const before     = lineText.slice(0, col)
  const token      = lineText.slice(col, col + 1) || ' '
  const after      = lineText.slice(col + 1)
  const num        = String(index + 1).padStart(2, '0')
  const isNetwork  = diagnostic.type === 'Network'

  const [copied, setCopied] = useState(false)
  const handleCopy = async (e) => {
    e.stopPropagation() // don't trigger the jump-to
    try {
      await navigator.clipboard.writeText(diagnostic.message)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch { /* permission denied */ }
  }

  const handleJump = () => {
    if (isNetwork) return // jumping to L1:0 is meaningless for network errors
    onJumpTo?.(diagnostic.line ?? 1, col)
  }

  const handleRetry = (e) => {
    e.stopPropagation()
    onRetry?.()
  }

  return (
    <article
      className={`error-card${isNetwork ? ' error-card--network' : ''}`}
      onClick={handleJump}
      onKeyDown={e => { if (!isNetwork && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleJump() } }}
      role={isNetwork ? 'alert' : 'button'}
      tabIndex={isNetwork ? -1 : 0}
      aria-label={isNetwork
        ? `Network error: ${diagnostic.message}`
        : `Error ${num} on line ${diagnostic.line}, column ${col + 1}: ${diagnostic.message}. Press Enter to jump to this line.`}
    >
      <span className="error-num" aria-hidden="true">{num}</span>
      <div className="error-body">
        <div className="error-meta">
          {!isNetwork && <span className="error-loc">Line {diagnostic.line}, Col {col + 1}</span>}
          <span className="error-type-badge">{diagnostic.type}</span>
          {isNetwork && onRetry ? (
            <button
              className="error-retry-btn"
              onClick={handleRetry}
              aria-label="Retry the syntax check"
            >
              ↻ Retry
            </button>
          ) : (
            <button
              className="error-copy-btn"
              onClick={handleCopy}
              aria-label="Copy error message"
              title="Copy error message"
            >
              {copied ? '✓ copied' : 'Copy'}
            </button>
          )}
        </div>
        <p className="error-message">{diagnostic.message}</p>
        {!isNetwork && lineText.trim() && (
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
