export default function EditorPane({
  editorRef,
  onClear,
  onUpload,
}) {
  return (
    <div className="pane pane-input">
      <div className="pane-label">
        <span className="pane-label-text">Input</span>
        <span className="pane-label-rule" aria-hidden="true" />
      </div>

      <div className="editor-wrap" ref={editorRef} />

      <div className="pane-actions">
        <button className="action-link" onClick={onClear}>
          <span className="action-link-glyph" aria-hidden="true">×</span>
          <span>Clear</span>
        </button>

        <label className="action-link">
          <span className="action-link-glyph" aria-hidden="true">↑</span>
          <span>Upload file</span>
          <input
            type="file"
            accept=".js,.jsx,.ts,.tsx,.py,.cpp,.cc,.cxx,.hpp,.h,.c,.java,.rb,.json,.html,.htm,.css,.sql,.yaml,.yml"
            onChange={onUpload}
            hidden
          />
        </label>

        <span className="action-spacer" aria-hidden="true" />

        <span className="action-hint" aria-hidden="true">
          <kbd>⌘</kbd>+<kbd>↵</kbd> to force a check
        </span>
      </div>
    </div>
  )
}
