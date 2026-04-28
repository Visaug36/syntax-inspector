export default function EditorPane({
  editorRef,        // forwarded to attach the CodeMirror DOM node
  onPaste, onCopy, onClear, onUpload, onShare, onSample,
  shareStatus, isEmpty,
}) {
  return (
    <div className="pane pane-input">
      <div className="pane-label">Input</div>

      <div className="editor-wrap" ref={editorRef} />

      <div className="pane-actions">
        <button className="action-btn" onClick={onPaste}>Paste</button>
        <button className="action-btn" onClick={onClear}>Clear</button>
        <button className="action-btn" onClick={onCopy}>Copy</button>

        <label className="action-btn upload-label">
          Upload
          <input
            type="file"
            accept=".js,.jsx,.ts,.tsx,.py,.cpp,.cc,.cxx,.hpp,.h,.c,.java,.rb,.json,.html,.htm,.css,.sql,.yaml,.yml"
            onChange={onUpload}
            hidden
          />
        </label>

        <button className="action-btn" onClick={onShare} disabled={isEmpty}>
          {shareStatus ?? 'Share'}
        </button>
        <button className="action-btn sample-btn" onClick={onSample}>
          Try sample
        </button>
      </div>
    </div>
  )
}
