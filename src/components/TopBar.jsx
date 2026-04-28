import { LANGUAGES } from '../checkers/index.js'

export default function TopBar({
  language, onLanguageChange,
  errorCount,
  isDark, onToggleTheme,
  onRunCheck,
}) {
  return (
    <header className="topbar">
      <div className="wordmark">
        <span className="wordmark-primary">Syntax</span>
        <span className="wordmark-secondary">Inspector</span>
      </div>

      <div className="topbar-center">
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

      <div className="topbar-right">
        {errorCount > 0 && (
          <span
            className="error-badge"
            aria-label={`${errorCount} error${errorCount > 1 ? 's' : ''}`}
          >
            {errorCount}
          </span>
        )}
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? '☀' : '◑'}
        </button>
        <button className="run-btn" onClick={onRunCheck} aria-label="Run check now">
          Run check <kbd>⌘↵</kbd>
        </button>
      </div>
    </header>
  )
}
