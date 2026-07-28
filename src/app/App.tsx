import './App.css'

function App() {
  return (
    <main className="shell">
      <header className="shell__header">
        <h1 className="shell__title">Starbound Frontier</h1>
        <p className="shell__subtitle">Project foundation initialized</p>
      </header>

      <section className="status-panel" aria-label="Project status">
        <div className="status-panel__row">
          <span className="status-panel__label">Version</span>
          <span className="status-panel__value">{__APP_VERSION__}</span>
        </div>
        <div className="status-panel__row">
          <span className="status-panel__label">Milestone</span>
          <span className="status-panel__value">Foundation</span>
        </div>
        <div className="status-panel__row">
          <span className="status-panel__label">Status</span>
          <span className="status-panel__value">Scaffolding complete</span>
        </div>
        <p className="status-panel__notice">Gameplay has not been implemented yet.</p>
      </section>
    </main>
  )
}

export default App
