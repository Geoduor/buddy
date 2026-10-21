import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ensureSession } from '../lib/session'
import { Loading, ErrorBox } from '../components/Notice'

const pct = (x) => Math.round(Number(x) * 100)

export default function Dashboard() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [fill, setFill] = useState(false)

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    ensureSession()
      .then(() => supabase.rpc('get_readiness'))
      .then(({ data, error: e }) => {
        if (e) throw e
        if (!live) return
        setError(null)
        setRows(data)
        requestAnimationFrame(() => requestAnimationFrame(() => live && setFill(true)))
      })
      .catch((e) => { if (live) setError(e.message || 'Could not load your readiness.') })
    return () => { live = false }
  }, [attempt])

  if (error) return <section><h1>Readiness</h1><ErrorBox onRetry={() => setAttempt((a) => a + 1)}>{error}</ErrorBox></section>
  if (!rows) return <section><h1>Readiness</h1><Loading /></section>

  const overall = rows.find((r) => r.domain_id === 'OVERALL')
  const domains = rows.filter((r) => r.domain_id !== 'OVERALL')
  const scored = domains.filter((d) => d.accuracy !== null)
  const weakest = scored.length >= 2 ? scored.reduce((a, b) => (Number(a.accuracy) <= Number(b.accuracy) ? a : b)) : null
  const noneYet = !overall || Number(overall.attempted) === 0

  return (
    <section>
      <h1>Readiness</h1>
      {noneYet ? (
        <div className="notice">
          <p><strong>Nothing to show yet.</strong></p>
          <p>Answer some quiz questions and your progress for each exam area appears here.</p>
          <Link className="btn btn-primary" to="/quiz?scope=all">Start a quiz</Link>
        </div>
      ) : (
        <>
          <div className="overall">
            {overall.accuracy !== null ? (
              <>
                <p className="big-score">{pct(overall.accuracy)}%</p>
                <p>Overall accuracy across the three exam areas, weighted the way the exam is.</p>
              </>
            ) : (
              <>
                <p className="big-score big-score-empty">Not enough data yet</p>
                <p>The overall score appears once every exam area has enough answered questions.</p>
              </>
            )}
            <p className="muted small">Estimate only, not an official prediction of your exam score. Microsoft's pass mark of 700 is a scaled score, not a percentage.</p>
          </div>

          <ul className="bars">
            {domains.map((d) => (
              <li key={d.domain_id} className="bar-row">
                <div className="bar-head">
                  <h2>{d.domain_title}</h2>
                  <p className="muted small">{d.weight}% of the exam</p>
                </div>
                <div className={`bar ${d.accuracy === null ? 'bar-empty' : ''}`}
                  role="img"
                  aria-label={d.accuracy === null ? 'Not enough data yet' : `${pct(d.accuracy)} percent accuracy`}>
                  <span style={{ width: fill && d.accuracy !== null ? `${pct(d.accuracy)}%` : '0%' }} />
                </div>
                <p className="bar-note">
                  {d.accuracy === null
                    ? <>Not enough data yet. You have answered {d.attempted} different {Number(d.attempted) === 1 ? 'question' : 'questions'} here.</>
                    : <><strong>{pct(d.accuracy)}%</strong> correct. {d.correct} of {d.attempted} questions, counting your latest answer to each.</>}
                  {' '}
                  <Link to={`/quiz?scope=${d.domain_id}`}>Practise this area</Link>
                </p>
              </li>
            ))}
          </ul>

          {weakest && (
            <p className="focus">
              Weakest area so far: <strong>{weakest.domain_title}</strong>. <Link to={`/quiz?scope=${weakest.domain_id}`}>Practise it next</Link>
            </p>
          )}
        </>
      )}
    </section>
  )
}
