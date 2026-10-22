import { useEffect, useRef, useState } from 'react'
import { askBuddy, friendlyError } from '../lib/api'
import { learnUrl } from '../lib/safeUrl'

const MIN = 3
const MAX = 500

// Turn "[1]" markers into links that jump to the matching source.
function Answer({ text, sources, id }) {
  const parts = text.split(/(\[\d+\])/g)
  return (
    <p className="answer-text">
      {parts.map((p, i) => {
        const m = /^\[(\d+)\]$/.exec(p)
        if (!m) return <span key={i}>{p}</span>
        const n = Number(m[1])
        return sources.some((s) => s.n === n)
          ? <a key={i} className="cite" href={`#${id}-src-${n}`} onClick={(e) => { e.preventDefault(); document.getElementById(`${id}-src-${n}`)?.focus() }}>[{n}]</a>
          : null
      })}
    </p>
  )
}

export default function StudyBuddy() {
  const [text, setText] = useState('')
  const [thread, setThread] = useState([])
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [thread, busy])

  const trimmed = text.trim()
  const valid = trimmed.length >= MIN && trimmed.length <= MAX

  async function send(e) {
    e.preventDefault()
    if (!valid || busy || locked) return
    const question = trimmed
    setText('')
    setBusy(true)
    const id = `m${thread.length}`
    setThread((t) => [...t, { id, question }])
    try {
      const { status, data } = await askBuddy(question)
      if (status === 200 && data?.ok) {
        setThread((t) => t.map((m) => (m.id === id ? { ...m, reply: data } : m)))
      } else {
        if (status === 429) setLocked(true)
        setThread((t) => t.map((m) => (m.id === id ? { ...m, error: friendlyError(status, data) } : m)))
      }
    } catch {
      setThread((t) => t.map((m) => (m.id === id ? { ...m, error: 'Could not reach the Study Buddy. Check your connection and try again.' } : m)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="chat">
      <h1>Ask Buddy</h1>
      <p className="lead">Ask about an AZ-900 idea in your own words. Buddy answers only from notes that have been checked against Microsoft Learn, and shows where each answer came from.</p>

      <div className="thread" aria-live="polite">
        {thread.length === 0 && (
          <p className="muted">Nothing asked yet. If the notes do not cover your question, Buddy says so instead of guessing.</p>
        )}
        {thread.map((m) => (
          <div key={m.id} className="exchange">
            <p className="you">{m.question}</p>
            {!m.reply && !m.error && (
              <div className="buddy-row">
                <img className="avatar" src="/brand/buddy-mark.png" alt="" width="32" height="26" />
                <p className="typing" role="status"><span className="sr-only">Checking the notes</span><i /><i /><i /></p>
              </div>
            )}
            {m.error && <p className="notice notice-error" role="alert">{m.error}</p>}
            {m.reply && (
              <div className="buddy-row">
              <img className="avatar" src="/brand/buddy-mark.png" alt="" width="32" height="26" />
              <div className={`buddy ${m.reply.outside_notes ? 'buddy-outside' : ''}`}>
                {m.reply.outside_notes
                  ? <><p className="answer-text">{m.reply.answer}</p></>
                  : <Answer text={m.reply.answer} sources={m.reply.sources} id={m.id} />}
                {m.reply.sources?.length > 0 && (
                  <div className="sources">
                    <h2>{m.reply.outside_notes ? 'Where to look' : 'Sources'}</h2>
                    <ul>
                      {m.reply.sources.map((s, i) => (
                        <li key={i} id={`${m.id}-src-${s.n ?? 'x'}`} tabIndex={-1}>
                          {s.n != null && <span className="src-n">[{s.n}]</span>}{' '}
                          {learnUrl(s.source_url)
                            ? <a href={learnUrl(s.source_url)} target="_blank" rel="noreferrer">{s.objective_text || s.title || 'Microsoft Learn'}</a>
                            : <span>{s.objective_text || s.title || 'Microsoft Learn'}</span>}
                          {s.objective_id && <span className="muted small"> (objective {s.objective_id})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={send}>
        <label htmlFor="q" className="sr-only">Your question</label>
        <textarea id="q" rows={2} value={text} maxLength={MAX} disabled={locked}
          placeholder={locked ? 'Daily limit reached. Come back tomorrow.' : 'Ask about an AZ-900 concept'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e) }} />
        <div className="composer-row">
          <span className="muted small">{text.length} / {MAX}</span>
          <button className="btn btn-primary" type="submit" disabled={!valid || busy || locked}>{busy ? 'Checking' : 'Ask'}</button>
        </div>
      </form>
    </section>
  )
}
