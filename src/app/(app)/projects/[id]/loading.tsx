export default function ProjectEditorLoading() {
  return (
    <div className="editor-loading" aria-label="Loading project editor">
      <header className="editor-loading__command">
        <span />
        <span />
        <span />
      </header>
      <aside className="editor-loading__panel editor-loading__panel--left">
        <div className="editor-loading__line editor-loading__line--short" />
        <div className="editor-loading__block" />
        <div className="editor-loading__block editor-loading__block--tall" />
      </aside>
      <section className="editor-loading__canvas">
        <div className="editor-loading__view-controls" />
        <div className="editor-loading__paper" />
      </section>
      <aside className="editor-loading__panel editor-loading__panel--right">
        <div className="editor-loading__line editor-loading__line--short" />
        <div className="editor-loading__field-grid">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="editor-loading__field" />
          ))}
        </div>
      </aside>
      <footer className="editor-loading__status" />
    </div>
  );
}
