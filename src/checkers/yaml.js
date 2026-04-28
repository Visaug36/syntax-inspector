import yaml from 'js-yaml'

// loadAll iterates over `---`-separated documents, so multi-document YAML
// (a real, common pattern in Kubernetes manifests, GitHub Actions, etc.)
// no longer false-positives. Single-doc YAML still parses normally.
//
// Duplicate keys are spec-allowed but most consumers treat them as bugs;
// js-yaml with default `json: false` only WARNS, not throws — so it
// doesn't surface here. We accept that trade-off.
export function check(code) {
  if (!code.trim()) return []
  try {
    yaml.loadAll(code, () => {})
    return []
  } catch (err) {
    return [{
      line:     err.mark ? err.mark.line + 1 : 1,
      column:   err.mark ? err.mark.column  : 0,
      severity: 'error',
      message:  err.reason ?? err.message,
      type:     'Parse',
    }]
  }
}
