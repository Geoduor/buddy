import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ensureSession } from '../lib/session'
import { loadOutline, scopeLabel } from '../lib/outline'
import Bubble from '../components/Bubble'
import { Loading, ErrorBox } from '../components/Notice'

const SESSION_SIZE = 10
const LETTERS = ['A', 'B', 'C', 'D']

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Quiz() {
  const [params] = useSearchParams()
  const scope = params.get('scope')
  return scope ? <Practice key={scope} scope={scope} /> : <Picker />
}

function Picker() {
  const [domains, setDomains] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    loadOutline().then(setDomains).catch((e) => setError(e.message || 'Could not load topics.'))
  }, [])
  return (
    <section>
      <h1>Quiz</h1>
      <p className="lead">Pick a topic. You get up to {SESSION_SIZE} questions, one at a time, with an explanation after each answer.</p>
      {error && <ErrorBox>{error}</ErrorBox>}
      {!domains && !error && <Loading />}
      {domains && (
        <>
          <Link className="btn btn-primary" to="/quiz?scope=all">All topics mixed</Link>
          <div className="domains">
            {domains.map((d) => (
              <article key={d.id} className="domain">
                <h3>{d.title}</h3>
                <ul className="topic-list">
                  <li><Link className="topic topic-all" to={`/quiz?scope=${d.id}`}>Whole area</Link></li>
                  {d.groups.map((g) => (
                    <li key={g.id}><Link className="topic" to={`/quiz?scope=${g.id}`}>{g.title}</Link></li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function Practice({ scope }) {
  const [state, setState] = useState({ status: 'loading' })
  const [label, setLabel] = useState('')
  const [round, setRound] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await ensureSession()
        loadOutline().then((d) => !cancelled && setLabel(scopeLabel(scope, d))).catch(() => {})
        let q = supabase
          .from('questions')
          .select('id, objective_id, stem, options, correct_index, explanation, why_wrong, source_url, objectives(text)')
        if (scope !== 'all') q = q.like('objective_id', `${scope}.%`)
        const { data, error } = await q
        if (error) throw error
        if (cancelled) return
        setState({ status: 'ready', questions: shuffle(data).slice(0, SESSION_SIZE) })
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: e.message || 'Could not load questions.' })
      }
    })()
    return () => { cancelled = true }
  }, [scope, round])

  const restart = () => { setState({ status: 'loading' }); setRound((r) => r + 1) }

  if (state.status === 'loading') return <section><Loading>Loading questions</Loading></section>
  if (state.status === 'error') return <section><h1>Quiz</h1><ErrorBox onRetry={restart}>{state.message}</ErrorBox></section>
  if (!state.questions.length) {
    return (
      <section>
        <h1>{label || 'Quiz'}</h1>
        <div className="notice">
          <p><strong>No checked questions here yet.</strong></p>
          <p>Questions appear only after a second person has verified them against Microsoft Learn. Try another topic, or come back soon.</p>
          <Link className="btn btn-quiet" to="/quiz">Choose another topic</Link>
        </div>
      </section>
    )
  }
  return <Session questions={state.questions} label={label} onAgain={restart} />
}

function Session({ questions, label, onAgain }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [results, setResults] = useState([])
  const [saveError, setSaveError] = useState(false)

  const q = questions[index]
  const done = index >= questions.length
  const answered = picked !== null

  const choose = useCallback(async (i) => {
    if (picked !== null || !q) return
    setPicked(i)
    setSaveError(false)
    setResults((r) => [...r, { id: q.id, correct: i === q.correct_index }])
    const { error } = await supabase.from('attempts').insert({ question_id: q.id, selected_index: i })
    if (error) setSaveError(true)
  }, [picked, q])

  const next = useCallback(() => { setPicked(null); setSaveError(false); setIndex((n) => n + 1) }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return
      const k = e.key.toUpperCase()
      if (!answered && ['A', 'B', 'C', 'D', '1', '2', '3', '4'].includes(k)) {
        choose(LETTERS.includes(k) ? LETTERS.indexOf(k) : Number(k) - 1)
      } else if (answered && e.key === 'Enter' && e.target.tagName !== 'A') {
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answered, choose, next])

  const score = useMemo(() => results.filter((r) => r.correct).length, [results])

  if (done) {
    return (
      <section className="summary">
        <h1>Round finished</h1>
        <p className="big-score">{score} of {questions.length} correct</p>
        <p className="muted">Your answers are saved and count toward your readiness estimate.</p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={onAgain}>Practise again</button>
          <Link className="btn btn-quiet" to="/dashboard">See readiness</Link>
          <Link className="btn btn-quiet" to="/quiz">Change topic</Link>
        </div>
      </section>
    )
  }

  const wrongText = picked !== null && picked !== q.correct_index ? q.why_wrong?.[picked] : null
  const stateOf = (i) => {
    if (!answered) return 'idle'
    if (i === q.correct_index) return 'correct'
    if (i === picked) return 'wrong'
    return 'idle'
  }

  return (
    <section className="quiz">
      <div className="quiz-head">
        <p className="muted small">{label}</p>
        <p className="progress-text" aria-live="polite">Question {index + 1} of {questions.length}</p>
      </div>
      <div className="progress" role="progressbar" aria-valuemin="0" aria-valuemax={questions.length} aria-valuenow={index + (answered ? 1 : 0)}>
        <span style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <div className="sheet">
        {q.objectives?.text && <p className="objective">Exam objective: {q.objectives.text}</p>}
        <h1 className="stem">{q.stem}</h1>
        <div className="options" role="group" aria-label="Answer options">
          {q.options.map((text, i) => (
            <Bubble key={i} letter={LETTERS[i]} text={text} state={stateOf(i)} disabled={answered} onPick={() => choose(i)} />
          ))}
        </div>
        {!answered && <p className="muted small hint">Tip: press A, B, C or D on a keyboard.</p>}
      </div>

      {answered && (
        <div className={`feedback ${picked === q.correct_index ? 'feedback-right' : 'feedback-wrong'}`} aria-live="polite">
          <h2>{picked === q.correct_index ? 'Correct' : 'Not quite'}</h2>
          {picked !== q.correct_index && <p>The right answer is <strong>{LETTERS[q.correct_index]}</strong>.</p>}
          {q.explanation && <p>{q.explanation}</p>}
          {wrongText && <p><strong>Why {LETTERS[picked]} is wrong:</strong> {wrongText}</p>}
          {q.source_url && <p><a href={q.source_url} target="_blank" rel="noreferrer">Read this on Microsoft Learn</a></p>}
          {saveError && <p className="save-warning" role="alert">This answer could not be saved, so it will not count toward readiness.</p>}
          <button className="btn btn-primary" onClick={next} autoFocus>
            {index + 1 === questions.length ? 'Finish round' : 'Next question'}
          </button>
        </div>
      )}
    </section>
  )
}
