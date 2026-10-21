import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadOutline } from '../lib/outline'
import { Loading, ErrorBox } from '../components/Notice'

export default function Home() {
  const [domains, setDomains] = useState(null)
  const [error, setError] = useState(null)

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    loadOutline()
      .then((d) => { if (live) { setError(null); setDomains(d) } })
      .catch((e) => { if (live) setError(e.message || 'Could not load the exam outline.') })
    return () => { live = false }
  }, [attempt])

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>Practise AZ-900 one topic at a time.</h1>
          <p className="lead">
            Short quizzes that explain every answer, a readiness check for each exam area, and a study buddy that answers only from notes we have checked.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" to="/quiz?scope=all">Start practising</Link>
            <Link className="btn btn-quiet btn-lg" to="/study-buddy">Ask a question</Link>
          </div>
          <p className="muted small">No account needed. Your progress is saved in this browser.</p>
        </div>
        <div className="paper" aria-hidden="true">
          {[1, 2, 3].map((row) => (
            <div key={row} className="paper-row">
              <span className="paper-n">{row}</span>
              {['A', 'B', 'C', 'D'].map((l) => (
                <span key={l} className={`bubble ${(row + (l.charCodeAt(0) - 65)) % 4 === 1 ? `bubble-fill-demo bubble-d${row}` : ''}`}><span>{l}</span></span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="steps" aria-labelledby="how-h">
        <h2 id="how-h">How Buddy helps</h2>
        <ol className="step-list">
          <li>
            <h3>Practise</h3>
            <p>Answer one question at a time, tied to an official exam objective.</p>
            <Link to="/quiz">Open the quiz</Link>
          </li>
          <li>
            <h3>Understand</h3>
            <p>See why the right answer is right and why the others are not, with a link to Microsoft Learn.</p>
            <Link to="/study-buddy">Ask Buddy a question</Link>
          </li>
          <li>
            <h3>Track</h3>
            <p>Watch your accuracy build for each exam area, and see where to practise next.</p>
            <Link to="/dashboard">See your readiness</Link>
          </li>
        </ol>
      </section>

      <section aria-labelledby="topics-h">
        <h2 id="topics-h">Choose what to practise</h2>
        <p className="muted">The three exam areas and their topics, from Microsoft's published AZ-900 skills outline.</p>
        {error && <ErrorBox onRetry={() => setAttempt((a) => a + 1)}>{error}</ErrorBox>}
        {!domains && !error && <Loading>Loading topics</Loading>}
        <div className="domains">
          {domains?.map((d) => (
            <article key={d.id} className="domain">
              <header>
                <h3>{d.title}</h3>
                <p className="muted small">{d.weight_min}% to {d.weight_max}% of the exam</p>
              </header>
              <ul className="topic-list">
                <li><Link to={`/quiz?scope=${d.id}`} className="topic topic-all">Whole area</Link></li>
                {d.groups.map((g) => (
                  <li key={g.id}><Link to={`/quiz?scope=${g.id}`} className="topic">{g.title}</Link></li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
