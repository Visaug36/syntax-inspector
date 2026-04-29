import { useState } from 'react'
import ErrorCard from './ErrorCard.jsx'
import { buildMarkdownReport, downloadText } from '../lib/exportReport.js'

export default function ResultsPane({
  language,
  diagnostics,
  isEmpty, isClean, showLoading, isRemote,
  onJumpTo, onSample, onRetry,
  codeRef,
}) {
  const errorCount = diagnostics.length
  const langLabel  = language === 'cpp' ? 'C++' : language[0].toUpperCase() + language.slice(1)
  const [exportStatus, setExportStatus] = useState(null)

  const handleExport = async () => {
    const md = buildMarkdownReport({ language, code: codeRef.current, diagnostics })
    // Prefer clipboard for one-click paste; fall back to file download.
    try {
      await navigator.clipboard.writeText(md)
      setExportStatus('Copied to clipboard')
    } catch {
      downloadText(`syntax-inspector-${language}-${Date.now()}.md`, md)
      setExportStatus('Downloaded')
    }
    setTimeout(() => setExportStatus(null), 1800)
  }

  return (
    <div className="pane pane-results">
      <div className="pane-label">
        <span className="pane-label-text">Diagnostics</span>
        <span className="pane-label-rule" aria-hidden="true" />
        {errorCount > 0 && (
          <>
            <span className="diag-count">{errorCount} issue{errorCount > 1 ? 's' : ''}</span>
            <button
              className="diag-export"
              onClick={handleExport}
              aria-label="Copy diagnostic report"
              title="Copy a markdown report of all errors"
            >
              {exportStatus ?? 'Copy report'}
            </button>
          </>
        )}
      </div>

      <div
        className="results-scroll"
        role="region"
        aria-live="polite"
        aria-atomic="false"
      >
        {isEmpty ? (
          <EmptyState langLabel={langLabel} onSample={onSample} />
        ) : showLoading ? (
          <LoadingState langLabel={langLabel} isRemote={isRemote} />
        ) : isClean ? (
          <CleanState langLabel={langLabel} />
        ) : (
          <ErrorList
            diagnostics={diagnostics}
            codeRef={codeRef}
            onJumpTo={onJumpTo}
            onRetry={onRetry}
          />
        )}
      </div>
    </div>
  )
}

function EmptyState({ langLabel, onSample }) {
  return (
    <div className="empty-state">
      <p className="empty-heading">Ready to inspect.</p>
      <p className="empty-sub">
        Currently checking <strong>{langLabel}</strong>. Paste code, upload a file, or
        load a broken sample to see errors surface inline as you type.
      </p>
      <div className="empty-actions">
        <button
          className="empty-cta"
          onClick={onSample}
          aria-label={`Load broken ${langLabel} sample`}
        >
          <span className="empty-cta-arrow" aria-hidden="true">→</span>
          Load broken {langLabel} sample
        </button>
      </div>
      <ul className="empty-tips" aria-label="Quick tips">
        <li><kbd>⌘</kbd>+<kbd>↵</kbd> forces an immediate check</li>
        <li>Drop a file onto the editor to detect its language automatically</li>
        <li>Click any error card to jump to that line</li>
      </ul>
    </div>
  )
}

function LoadingState({ langLabel, isRemote }) {
  return (
    <div className="loading-state" role="status">
      <div className="loading-pulse" aria-hidden="true">
        <span /><span /><span />
      </div>
      <p className="loading-heading">
        {isRemote ? `Checking with the ${langLabel} compiler…` : `Checking ${langLabel}…`}
      </p>
      {isRemote && (
        <p className="loading-sub">
          First check after idle takes about 30 seconds — the syntax server is waking up.
        </p>
      )}
    </div>
  )
}

function CleanState({ langLabel }) {
  return (
    <div className="clean-state">
      <span className="clean-icon">✓</span>
      <p className="clean-heading">No syntax errors found</p>
      <p className="clean-sub">{langLabel} — looks good.</p>
    </div>
  )
}

function ErrorList({ diagnostics, codeRef, onJumpTo, onRetry }) {
  return (
    <div className="error-list">
      {diagnostics.map((d, i) => (
        <ErrorCard
          key={`${d.line}-${d.column}-${i}`}
          index={i}
          diagnostic={d}
          code={codeRef.current}
          onJumpTo={onJumpTo}
          onRetry={onRetry}
        />
      ))}
    </div>
  )
}
