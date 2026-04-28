import { LANGUAGES } from '../checkers/index.js'

export default function TopBar({
  language, onLanguageChange,
  errorCount,
  isDark, onToggleTheme,
}) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <h1 className="wordmark">
          <span className="wordmark-primary">Syntax</span>
          <span className="wordmark-secondary">Inspector</span>
        </h1>
        <p className="topbar-tagline">
          A checker for the careful coder &nbsp;·&nbsp; <em>est.</em> 2026
        </p>
      </div>

      <div className="topbar-center">
        <span className="topbar-eyebrow">Inspecting</span>
        <div className="lang-select-wrap">
          <select
            className="lang-select"
            value={language}
            onChange={e => onLanguageChange(e.target.value)}
            aria-label="Select language"
          >
            {LANGUAGES.map(l => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="topbar-right">
        {errorCount > 0 && (
          <span
            className="error-badge"
            aria-label={`${errorCount} error${errorCount > 1 ? 's' : ''}`}
          >
            <span className="error-badge-num">{errorCount}</span>
            <span className="error-badge-label">issue{errorCount > 1 ? 's' : ''}</span>
          </span>
        )}
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span aria-hidden="true">{isDark ? '☀' : '◑'}</span>
        </button>
      </div>
    </header>
  )
}
