// Static About section - ported from the vanilla markup, with the maker list driven by data
// so a portrait can sit next to each name. Portraits live in public/makers/<name>.jpg; a
// missing file simply hides its own <img>, so the card still renders before every photo lands.
//
// `focus` is a crop hint, not an edit to the photo: the avatar is a 64px circle, and the
// source shots are framed differently (waist-up vs seated full figure). { at, zoom } pans
// and scales the image inside the circular clip so every maker reads at the same size.
// Both numbers are percentages/multipliers - tweak them if a face sits off-centre.

const MAKERS = [
  {
    name: 'Muhammad Ayan Toqeer',
    role: 'Team Lead & Backend Developer',
    email: 'ayan.ak862@gmail.com',
    photo: '/makers/ayan.jpg',
    focus: { at: '38% 24%', zoom: 2.0 },
  },
  {
    name: 'Mamuna Ahmad',
    role: 'Frontend Developer & Product Coordinator',
    email: 'meitrixvision@gmail.com',
    photo: '/makers/mamuna.jpg',
    focus: { at: '50% 26%', zoom: 1.25 },
  },
  {
    name: 'Aleena Noor',
    role: 'Research, Documentation & Domain Expert',
    email: 'nooraleena5@gmail.com',
    photo: '/makers/aleena.jpg',
    focus: { at: '55% 26%', zoom: 1.8 },
  },
]

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
          <ul className="makers">
            {MAKERS.map((m) => (
              <li key={m.email} className="maker">
                <span className="maker-photo">
                  <img
                    src={m.photo}
                    alt={m.name}
                    loading="lazy"
                    style={m.focus ? { transform: 'scale(' + m.focus.zoom + ')', transformOrigin: m.focus.at } : undefined}
                    onLoad={(e) => { e.currentTarget.parentNode.hidden = false }}
                    onError={(e) => { e.currentTarget.parentNode.hidden = true }}
                  />
                </span>
                <div className="maker-meta">
                  <strong>{m.name}</strong>
                  <span className="maker-role">{m.role}</span>
                  <a className="maker-mail" href={'mailto:' + m.email}>{m.email}</a>
                </div>
              </li>
            ))}
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