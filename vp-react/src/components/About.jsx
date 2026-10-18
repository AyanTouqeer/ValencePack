// Static About section — ported verbatim from the vanilla markup.
export default function About() {
  return (
    <section id="about" className="about">
      <h2 className="section-title">About ValencePack</h2>
      <div className="about-grid">
        <div className="card">
          <h3>How to use it</h3>
          <ol className="howto">
            <li>Describe your current package, or load the demo scenario to explore.</li>
            <li>Confirm what we understood, then run the analysis.</li>
            <li>Review the ranked, evidence-linked options and the compliance screen.</li>
            <li>Work through the open checks, and ask Vpack questions in the chat below.</li>
            <li>Print or save the report as a PDF to share with your team.</li>
          </ol>
        </div>
        <div className="card">
          <h3>About the makers</h3>
          <p className="muted">ValencePack is a decision-support workspace for sustainable packaging in the EU market, built for AI Builder Cup 2026 by Team Valence Cache.</p>
          <ul className="howto">
            <li><strong>Muhammad Ayan Toqeer</strong> — Team Lead &amp; Backend Developer</li>
            <li><strong>Mamuna Ahmad</strong> — Frontend Developer &amp; Product Coordinator</li>
            <li><strong>Aleena Noor</strong> — Research, Documentation &amp; Domain Expert</li>
          </ul>
          <p className="muted">
            <strong>Repository:</strong>{' '}
            <a href="https://github.com/AyanTouqeer/ValencePack" target="_blank" rel="noopener">github.com/AyanTouqeer/ValencePack</a>
          </p>
        </div>
      </div>
    </section>
  )
}
